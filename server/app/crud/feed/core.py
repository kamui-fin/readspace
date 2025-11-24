"""
Global Feed CRUD and Management.

Handles:
1. Basic CRUD (Get/Create)
2. URL Normalization
3. Worker Scheduling (calculating next_fetch_at)
4. Metadata/Enrichment Updates
"""

from datetime import datetime, timedelta, timezone
from urllib.parse import urlparse, urlunparse
from uuid import UUID

import structlog
from sqlalchemy import select, update, func, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import Settings
from app.models.feed import Feed, FeedCategory
from app.schemas.feeds import FeedBase

logger = structlog.get_logger(__name__)

# Constants for Scheduling
MIN_REFRESH_MINUTES = 15
MAX_REFRESH_MINUTES = 1440  # 24 hours
MAX_BACKOFF_MINUTES = 720  # 12 hours

# ==========================================
# Pure Python Helpers (Logic)
# ==========================================


def normalize_url(url: str) -> str:
    """Canonicalize URL to prevent duplicates (functional version)."""
    try:
        parsed = urlparse(url)
        scheme = "https" if parsed.scheme in ("http", "https") else parsed.scheme
        netloc = parsed.netloc.lower()
        path = parsed.path.rstrip("/") if parsed.path else ""
        return urlunparse((scheme, netloc, path, parsed.params, parsed.query, parsed.fragment))
    except Exception:
        return url


def calculate_next_fetch(feed: Feed) -> datetime:
    """
    Determines the next fetch time based on errors, TTL, and adaptive history.
    This logic moves OUT of the SQL query and INTO Python.
    """
    now = datetime.now(timezone.utc)

    # 1. Exponential Backoff for Errors
    if feed.fetch_error_count > 0:
        # 2^error_count * 60 minutes, capped at 12 hours
        backoff = min(pow(2, feed.fetch_error_count) * 60, MAX_BACKOFF_MINUTES)
        return now + timedelta(minutes=backoff)

    # 2. Determine Interval
    interval = MIN_REFRESH_MINUTES
    if feed.adaptive_fetch_interval_minutes:
        interval = feed.adaptive_fetch_interval_minutes
    elif feed.ttl:
        # Respect Publisher TTL, clamped between 15 mins and 24 hours
        interval = max(MIN_REFRESH_MINUTES, min(feed.ttl, MAX_REFRESH_MINUTES))

    next_fetch = now + timedelta(minutes=interval)

    # 3. Simple Skip Logic (Optimization: Don't do complex day matching here if unnecessary)
    # If strictly needed, check feed.skip_hours/days here and bump `next_fetch`

    return next_fetch


# ==========================================
# Database Operations (Async)
# ==========================================


async def get_feed_by_url(db: AsyncSession, *, url: str) -> Feed | None:
    """Get feed by normalized URL."""
    normalized = normalize_url(url)
    result = await db.execute(select(Feed).filter(Feed.url == normalized))
    return result.scalars().first()


async def get_feed_by_id(db: AsyncSession, *, feed_id: UUID) -> Feed | None:
    result = await db.execute(select(Feed).filter(Feed.id == feed_id))
    return result.scalars().first()


async def create_feed(db: AsyncSession, *, feed_data: FeedBase) -> Feed:
    """Create a new global feed."""
    normalized = normalize_url(str(feed_data.url))

    # Check existence to avoid IntegrityError if caller didn't check
    existing = await get_feed_by_url(db, url=normalized)
    if existing:
        return existing

    feed_dict = feed_data.model_dump(exclude_unset=True)
    feed_dict["url"] = normalized

    # Initialize scheduling
    now = datetime.now(timezone.utc)
    db_feed = Feed(**feed_dict)
    db_feed.last_fetched_at = None
    db_feed.next_fetch_at = now  # Fetch immediately

    db.add(db_feed)
    await db.flush()
    await db.refresh(db_feed)
    return db_feed


async def get_feeds_for_worker(db: AsyncSession, *, limit: int = 100) -> list[Feed]:
    """
    Get feeds due for update.

    Optimized: Uses a simple index scan on `next_fetch_at` instead of
    calculating logic at read-time.
    """
    now = datetime.now(timezone.utc)

    stmt = (
        select(Feed)
        .where(Feed.next_fetch_at <= now)
        .where(Feed.subscriber_count > 0)  # Don't refresh ghost feeds
        .order_by(Feed.subscriber_count.desc())  # Prioritize popular feeds
        .limit(limit)
        .with_for_update(skip_locked=True)  # Concurrency safety
    )

    result = await db.execute(stmt)
    return list(result.scalars().all())


async def update_feed_after_fetch(
    db: AsyncSession, *, feed: Feed, success: bool, metadata: dict | None = None, error_msg: str | None = None
) -> Feed:
    """
    Unified handler for post-fetch state updates.
    Updates metadata AND recalculates the next schedule.
    """
    if success:
        feed.fetch_error_count = 0
        feed.last_error_message = None
        feed.last_fetched_at = datetime.now(timezone.utc)

        if metadata:
            # Update standard fields
            for key in ["title", "description", "link", "language", "image_url"]:
                if val := metadata.get(key):
                    setattr(feed, key, str(val))

            # Update Technical/RSS fields
            if "ttl" in metadata:
                feed.ttl = int(metadata["ttl"])
            if "etag" in metadata:
                feed.etag_header = metadata["etag"]
            if "last_modified" in metadata:
                feed.last_modified_header = metadata["last_modified"]

    else:
        feed.fetch_error_count += 1
        feed.last_error_message = error_msg or "Unknown error"

    # CRITICAL: Calculate next fetch time immediately and save it
    # This keeps the "get_feeds_for_worker" query fast
    feed.next_fetch_at = calculate_next_fetch(feed)

    db.add(feed)
    # Note: Commit is left to the caller/worker
    return feed


async def update_enrichment_data(db: AsyncSession, *, feed: Feed, enrichment: dict) -> Feed:
    """Update AI-derived metadata (Categories, Tags)."""
    if "top_level_category" in enrichment:
        try:
            feed.top_level_category = FeedCategory(enrichment["top_level_category"])
        except ValueError:
            pass

    if "tags" in enrichment and isinstance(enrichment["tags"], list):
        feed.tags = enrichment["tags"]

    if "popularity_score" in enrichment:
        feed.popularity_score = float(enrichment["popularity_score"])

    db.add(feed)
    return feed
