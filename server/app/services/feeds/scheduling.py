"""
Adaptive feed scheduling service.

Intelligently calculates optimal fetch intervals based on feed publication patterns.
"""

import random
from datetime import datetime

import structlog
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import (
    DEFAULT_REFRESH_INTERVAL_MINUTES,
    MAX_ERROR_BACKOFF_MINUTES,
    MAX_REFRESH_INTERVAL_MINUTES,
    MIN_REFRESH_INTERVAL_MINUTES,
)
from app.crud.feed.core import get_recent_article_publication_times
from app.models.feed import Feed

logger = structlog.get_logger(__name__)


def calculate_interval_from_pub_times(pub_times: list[datetime]) -> int:
    """
    Pure logic to calculate optimal fetch interval from publication times.

    Args:
        pub_times: List of publication datetimes, ordered by most recent first

    Returns:
        Optimal fetch interval in minutes
    """
    if len(pub_times) < 2:
        return DEFAULT_REFRESH_INTERVAL_MINUTES

    # Calculate posting frequency
    time_span_hours = (pub_times[0] - pub_times[-1]).total_seconds() / 3600
    if time_span_hours <= 0:
        return DEFAULT_REFRESH_INTERVAL_MINUTES

    posts_per_hour = len(pub_times) / time_span_hours

    # Calculate average gap between consecutive posts
    gaps_minutes = [(pub_times[i] - pub_times[i + 1]).total_seconds() / 60 for i in range(len(pub_times) - 1)]
    avg_gap = sum(gaps_minutes) / len(gaps_minutes) if gaps_minutes else DEFAULT_REFRESH_INTERVAL_MINUTES

    # Determine interval based on posting frequency
    if posts_per_hour >= 1.0:
        # Very frequent: ≥1 post/hour (news sites, active blogs)
        interval = 10  # Check every 10 minutes
    elif posts_per_hour <= 0.01:
        # Very infrequent: ≤1 post/100 hours (inactive blogs, monthly newsletters)
        interval = MAX_REFRESH_INTERVAL_MINUTES  # 24 hours
    else:
        # Typical frequency: Check ~3x per average posting interval
        # This ensures we catch new content without too much waste
        interval = int(avg_gap * 0.33)

    # Enforce system-wide bounds
    return max(MIN_REFRESH_INTERVAL_MINUTES, min(interval, MAX_REFRESH_INTERVAL_MINUTES))


async def calculate_optimal_interval(db: AsyncSession, feed: Feed) -> int:
    """
    Analyze publication patterns from recent articles to determine optimal fetch interval.

    This leverages existing data - no new database fields required!
    Analyzes last 30 articles to calculate:
    - Posts per hour (frequency metric)
    - Average gap between posts

    Args:
        db: Database session
        feed: Feed to analyze

    Returns:
        Optimal fetch interval in minutes, bounded by MIN/MAX constants
    """
    # Query recent article publication times (use existing tables!)
    pub_times = await get_recent_article_publication_times(db, feed_id=feed.id, limit=30)

    if len(pub_times) < 2:
        logger.debug(
            "Insufficient articles for analysis",
            feed_id=feed.id,
            article_count=len(pub_times),
        )
        return DEFAULT_REFRESH_INTERVAL_MINUTES

    interval = calculate_interval_from_pub_times(pub_times)

    logger.info(
        "Calculated adaptive interval",
        feed_id=feed.id,
        calculated_interval=interval,
    )

    return interval


def calculate_error_backoff_interval(consecutive_errors: int) -> int:
    """
    Calculate exponential backoff interval for failing feeds.

    Uses existing fetch_error_count field (reinterpreted as consecutive errors).
    Implements: 2^n * 60 minutes, capped at 12 hours, with jitter.

    Args:
        consecutive_errors: Number of consecutive fetch failures

    Returns:
        Backoff interval in minutes
    """
    if consecutive_errors == 0:
        return DEFAULT_REFRESH_INTERVAL_MINUTES

    # Exponential backoff: 2^n * 5 minutes
    # 1 error → 10 mins
    # 2 errors → 20 mins
    # 3 errors → 40 mins
    # ...
    # 8 errors → ~21 hours (capped at 12 hours)
    base_delay_minutes = min((2**consecutive_errors) * 5, MAX_ERROR_BACKOFF_MINUTES)

    # Add jitter (±25%) to prevent thundering herd when many feeds fail/recover simultaneously
    jitter_multiplier = random.uniform(0.75, 1.25)  # noqa: S311 - non-cryptographic jitter for load distribution
    final_interval = int(base_delay_minutes * jitter_multiplier)

    logger.info(
        "Calculated error backoff",
        consecutive_errors=consecutive_errors,
        base_delay_minutes=base_delay_minutes,
        jitter_multiplier=round(jitter_multiplier, 3),
        final_interval=final_interval,
    )

    return final_interval
