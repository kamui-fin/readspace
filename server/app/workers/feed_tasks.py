"""Feed-related Taskiq tasks."""

from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import UUID

import structlog
from sqlalchemy import func, text, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import ARTICLE_RETENTION_DAYS, MAX_FEEDS_BATCH_SIZE, MIN_ARTICLES_PER_FEED, UNREAD_RETENTION_DAYS
from app.core.taskiq_app import broker
from app.models import FeedSubscription
from app.services.feeds.enrichment.feed_enrichment import FeedEnrichmentService
from app.services.feeds.feed import FeedService
from app.workers.common import ensure_uuid, get_worker_db

logger = structlog.get_logger(__name__)


# ============================================================================
# ASYNC HELPER FUNCTIONS (for testing and reuse)
# ============================================================================


async def async_refresh_single_feed(feed_id: UUID, db: AsyncSession) -> None:
    """Refresh a single feed - async implementation for testing.

    Args:
        feed_id: Feed UUID
        db: Database session
    """
    logger.info("Starting feed refresh", feed_id=str(feed_id))
    feed_service = FeedService(db=db)
    await feed_service.refresh_feed(feed_id=feed_id)
    logger.info("Successfully refreshed feed", feed_id=str(feed_id))


async def async_schedule_all_feeds(db: AsyncSession, test_mode: bool = False) -> None:
    """Schedule all feeds needing refresh - async implementation for testing.

    Args:
        db: Database session
        test_mode: If True, directly calls async functions instead of dispatching tasks
    """
    logger.info("Starting schedule all feed refreshes")

    feed_service = FeedService(db=db)
    feeds_to_check = await feed_service.get_feeds_needing_refresh(limit=MAX_FEEDS_BATCH_SIZE)

    logger.info("Found feeds to refresh", feed_count=len(feeds_to_check))

    if feeds_to_check:
        feed_ids = [feed.id for feed in feeds_to_check]

        if test_mode:
            # In test mode, refresh feeds directly
            for feed_id in feed_ids:
                await async_refresh_single_feed(feed_id=feed_id, db=db)
        else:
            # In production mode, kick tasks
            for feed_id in feed_ids:
                await refresh_single_feed_task.kiq(feed_id)

        logger.info(
            "Dispatched feed refresh tasks",
            task_count=len(feed_ids),
        )


async def async_enrich_feed(feed_id: UUID, db: AsyncSession) -> dict[str, Any]:
    """Enrich a feed with AI metadata - async implementation for testing.

    Args:
        feed_id: Feed UUID
        db: Database session

    Returns:
        Enrichment result dictionary
    """
    logger.info("Starting feed enrichment", feed_id=str(feed_id))

    try:
        enrichment_service = FeedEnrichmentService(db=db)
        result = await enrichment_service.enrich_feed(str(feed_id))

        if result.get("success"):
            logger.info(
                "Feed enrichment completed",
                feed_id=str(feed_id),
                enrichment_data=result.get("enrichment_data", {}),
            )
        else:
            logger.error(
                "Feed enrichment failed",
                feed_id=str(feed_id),
                error=result.get("error"),
            )

        return result
    except Exception as exc:
        logger.error(
            "Feed enrichment task failed",
            feed_id=str(feed_id),
            error=str(exc),
            exc_info=True,
        )
        return {
            "success": False,
            "feed_id": feed_id,
            "error": str(exc),
            "status": "task_failed",
        }


async def async_compact_unread_articles(db: AsyncSession) -> dict[str, int]:
    """Compact unread articles - async implementation for testing.

    Args:
        db: Database session

    Returns:
        Dictionary with updated_subscriptions count
    """
    logger.info("Starting unread compaction", retention_days=UNREAD_RETENTION_DAYS)

    cutoff_date = datetime.now(timezone.utc) - timedelta(days=UNREAD_RETENTION_DAYS)

    stmt = (
        update(FeedSubscription)
        .values(
            last_read_cutoff=func.greatest(
                func.coalesce(FeedSubscription.last_read_cutoff, cutoff_date),
                cutoff_date,
            )
        )
        .execution_options(synchronize_session=False)
    )

    result = await db.execute(stmt)
    updated_count = result.rowcount
    await db.commit()

    logger.info(
        "Unread compaction completed",
        updated_subscriptions=updated_count,
        cutoff_date=cutoff_date.isoformat(),
    )

    return {"updated_subscriptions": updated_count}


async def async_compact_old_articles(db: AsyncSession) -> dict[str, int]:
    """Compact old articles - async implementation for testing.

    Args:
        db: Database session

    Returns:
        Dictionary with deleted_articles count
    """
    logger.info(
        "Starting article compaction",
        retention_days=ARTICLE_RETENTION_DAYS,
        min_articles_per_feed=MIN_ARTICLES_PER_FEED,
    )

    # Set statement timeout to 15 minutes for safety
    await db.execute(text("SET statement_timeout = '15min'"))

    # Execute the deletion query using CTE for efficiency
    deletion_query = text("""
        WITH ranked_articles AS (
            SELECT
                fa.id AS article_id,
                fa.feed_id,
                ac.published_at AS published_or_created,
                ROW_NUMBER() OVER (
                    PARTITION BY fa.feed_id
                    ORDER BY ac.published_at DESC
                ) AS rn
            FROM feed_articles fa
            JOIN article_contents ac ON fa.content_id = ac.id
        ),
        eligible_articles AS (
            SELECT ra.article_id
            FROM ranked_articles ra
            LEFT JOIN user_article_states uas
                ON uas.article_id = ra.article_id
                AND (uas.is_read_later = TRUE OR uas.is_favorite = TRUE)
            WHERE ra.published_or_created < NOW() - MAKE_INTERVAL(days => :retention_days)
              AND uas.id IS NULL       -- no saved states
              AND ra.rn > :min_articles -- not in top N newest
        )
        DELETE FROM feed_articles
        WHERE id IN (SELECT article_id FROM eligible_articles)
    """)

    result = await db.execute(
        deletion_query,
        {
            "retention_days": ARTICLE_RETENTION_DAYS,
            "min_articles": MIN_ARTICLES_PER_FEED,
        },
    )
    deleted_count = result.rowcount

    # Commit the transaction
    await db.commit()

    # Reset statement timeout to default
    await db.execute(text("RESET statement_timeout"))

    logger.info(
        "Article compaction completed",
        deleted_articles=deleted_count,
        retention_days=ARTICLE_RETENTION_DAYS,
        min_articles_per_feed=MIN_ARTICLES_PER_FEED,
    )

    return {"deleted_articles": deleted_count}


# ============================================================================
# TASKIQ TASK WRAPPERS
# ============================================================================


@broker.task(
    task_name="feed_tasks.refresh_single_feed",
    retry_on_error=True,
    max_retries=2,
)
async def refresh_single_feed_task(feed_id: UUID | str) -> None:
    """Refresh a single feed - Taskiq task wrapper.

    Args:
        feed_id: Feed UUID (may be string from serialization)
    """
    feed_id = ensure_uuid(feed_id)

    async for session in get_worker_db():
        await async_refresh_single_feed(feed_id=feed_id, db=session)


@broker.task(
    task_name="feed_tasks.schedule_all_feed_refreshes",
    schedule=[{"cron": "*/30 * * * *"}],  # Every 30 minutes
)
async def schedule_all_feed_refreshes_task() -> None:
    """Schedule all feeds needing refresh - Taskiq task wrapper."""
    async for session in get_worker_db():
        await async_schedule_all_feeds(db=session, test_mode=False)


@broker.task(
    task_name="feed_tasks.enrich_feed",
    retry_on_error=True,
    max_retries=2,
)
async def enrich_feed_task(feed_id: UUID | str) -> dict[str, Any]:
    """Enrich a feed with AI metadata - Taskiq task wrapper.

    Args:
        feed_id: Feed UUID (may be string from serialization)

    Returns:
        Enrichment result dictionary
    """
    feed_id = ensure_uuid(feed_id)

    async for session in get_worker_db():
        return await async_enrich_feed(feed_id=feed_id, db=session)


@broker.task(
    task_name="feed_tasks.compact_unread_articles",
    schedule=[{"cron": "0 2 * * *"}],  # Run daily at 2 AM UTC
)
async def compact_unread_articles_task() -> dict[str, int]:
    """Compact unread articles - Taskiq task wrapper.

    Returns:
        Dictionary with updated_subscriptions count
    """
    async for session in get_worker_db():
        return await async_compact_unread_articles(db=session)


@broker.task(
    task_name="feed_tasks.compact_old_articles",
    schedule=[{"cron": "0 3 * * 0"}],  # Run weekly on Sunday at 3 AM UTC
)
async def compact_old_articles_task() -> dict[str, int]:
    """Compact old articles - Taskiq task wrapper.

    Returns:
        Dictionary with deleted_articles count
    """
    async for session in get_worker_db():
        return await async_compact_old_articles(db=session)
