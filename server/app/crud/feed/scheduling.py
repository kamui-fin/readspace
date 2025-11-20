"""Feed scheduling and refresh management."""

from datetime import datetime, timedelta, timezone

import structlog
from sqlalchemy import case, func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import (
    DEFAULT_REFRESH_INTERVAL_MINUTES,
    MAX_ERROR_BACKOFF_MINUTES,
    MAX_REFRESH_INTERVAL_MINUTES,
    MIN_REFRESH_INTERVAL_MINUTES,
)
from app.models import Feed

logger = structlog.get_logger(__name__)


async def get_feeds_needing_refresh(db: AsyncSession, *, limit: int = 100) -> list[Feed]:
    """Get global feeds that need refreshing, prioritized by subscriber count."""
    logger.info(
        "get_feeds_needing_refresh called (filtering feeds with 0 subscribers)",
        limit=limit,
    )
    now = datetime.now(timezone.utc)
    current_utc_hour = now.hour
    current_utc_weekday = now.weekday()

    # Never fetched feeds (top priority) - only refresh feeds with subscribers
    # Use SELECT FOR UPDATE SKIP LOCKED to prevent duplicate refreshes by multiple workers
    never_fetched_stmt = (
        select(Feed)
        .filter(Feed.last_fetched_at.is_(None))
        .filter(Feed.subscriber_count > 0)
        .filter((Feed.skip_hours.is_(None)) | (~Feed.skip_hours.contains([current_utc_hour])))
        .filter(
            (Feed.skip_days.is_(None))
            | (
                ~Feed.skip_days.contains(
                    [
                        [
                            "Monday",
                            "Tuesday",
                            "Wednesday",
                            "Thursday",
                            "Friday",
                            "Saturday",
                            "Sunday",
                        ][current_utc_weekday]
                    ]
                )
            )
        )
        .order_by(Feed.created_at.asc())
        .limit(limit)
        .with_for_update(skip_locked=True)  # Skip feeds already locked by other workers
    )

    never_fetched_result = await db.execute(never_fetched_stmt)
    feeds_needing_refresh = list(never_fetched_result.scalars().all())
    logger.info("Found never_fetched feeds", count=len(feeds_needing_refresh))

    remaining_limit = limit - len(feeds_needing_refresh)

    if remaining_limit > 0:
        min_interval_ago = now - timedelta(minutes=MIN_REFRESH_INTERVAL_MINUTES)

        # Calculate effective delay using SQL with new priority order:
        # 1. Error backoff (if errors > 0) - exponential backoff
        # 2. Adaptive interval (if calculated) - learned optimal
        # 3. TTL hint (if provided by feed publisher)
        # 4. Default interval (fallback)
        effective_delay = case(
            # Priority 1: Error backoff - exponential: min((2^errors * 60), 720)
            (
                Feed.fetch_error_count > 0,
                func.least(
                    func.power(2, Feed.fetch_error_count) * 60,  # 2^n hours in minutes
                    MAX_ERROR_BACKOFF_MINUTES,  # Cap at 12 hours
                ),
            ),
            # Priority 2: Use learned adaptive interval if available
            (
                Feed.adaptive_fetch_interval_minutes.is_not(None),
                Feed.adaptive_fetch_interval_minutes,
            ),
            # Priority 3: Respect feed's TTL hint
            (
                Feed.ttl.is_not(None),
                func.greatest(
                    MIN_REFRESH_INTERVAL_MINUTES,
                    func.least(Feed.ttl, MAX_REFRESH_INTERVAL_MINUTES),
                ),
            ),
            # Priority 4: Default interval
            else_=DEFAULT_REFRESH_INTERVAL_MINUTES,
        )

        next_fetch_time = Feed.last_fetched_at + (effective_delay * text("INTERVAL '1 minute'"))

        # OPTIMIZATION: Bind 'now' as a parameter instead of using literal_column("NOW()")
        # to allow PostgreSQL to cache the query plan
        # Use SELECT FOR UPDATE SKIP LOCKED to prevent duplicate refreshes by multiple workers
        due_feeds_stmt = (
            select(Feed)
            .filter(Feed.last_fetched_at.is_not(None))
            .filter(Feed.subscriber_count > 0)
            .filter(Feed.last_fetched_at < min_interval_ago)
            .filter((Feed.skip_hours.is_(None)) | (~Feed.skip_hours.contains([current_utc_hour])))
            .filter(
                (Feed.skip_days.is_(None))
                | (
                    ~Feed.skip_days.contains(
                        [
                            [
                                "Monday",
                                "Tuesday",
                                "Wednesday",
                                "Thursday",
                                "Friday",
                                "Saturday",
                                "Sunday",
                            ][current_utc_weekday]
                        ]
                    )
                )
            )
            .filter(next_fetch_time <= now)
            .order_by(
                # Prioritize feeds with more subscribers, then by last fetch time
                Feed.subscriber_count.desc(),
                Feed.last_fetched_at.asc(),
            )
            .limit(remaining_limit)
            .with_for_update(skip_locked=True)  # Skip feeds already locked by other workers
        )

        due_result = await db.execute(due_feeds_stmt)
        due_feeds = list(due_result.scalars().all())

        logger.info("Found due feeds", count=len(due_feeds))
        feeds_needing_refresh.extend(due_feeds)

    return feeds_needing_refresh[:limit]


async def update_feed_error(db: AsyncSession, *, feed_db: Feed, error_message: str) -> Feed:
    """Update feed error count and message after a failed fetch.

    Uses explicit UPDATE statement to avoid greenlet errors from lazy-loading
    attributes on potentially detached ORM objects.
    """
    from sqlalchemy import update

    # Use explicit UPDATE statement instead of ORM attribute access
    # This prevents greenlet errors when feed_db is detached after a failed transaction
    stmt = (
        update(Feed)
        .where(Feed.id == feed_db.id)
        .values(
            fetch_error_count=Feed.fetch_error_count + 1,
            last_error_message=error_message,
            updated_at=datetime.now(timezone.utc),
        )
        .returning(Feed)
    )

    result = await db.execute(stmt)
    # NOTE: No commit here - let caller (task wrapper) handle transaction commit
    # This prevents transaction state conflicts when called from get_worker_db()
    updated_feed = result.scalar_one()

    logger.warning(
        "Feed error count updated",
        feed_id=updated_feed.id,
        error_count=updated_feed.fetch_error_count,
        error_message=error_message,
    )

    return updated_feed
