"""Feed-related Celery tasks."""

from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import UUID

import structlog
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.celery_app import celery
from app.core.constants import ARTICLE_RETENTION_DAYS, MAX_FEEDS_BATCH_SIZE, MIN_ARTICLES_PER_FEED
from app.services.feeds.enrichment.feed_enrichment import FeedEnrichmentService
from app.services.feeds.feed import FeedService
from app.workers.common import ensure_uuid, get_task_event_loop, get_worker_db

logger = structlog.get_logger(__name__)


# ============================================================================
# ASYNC IMPLEMENTATIONS
# ============================================================================


async def async_refresh_single_feed(feed_id: UUID, db: AsyncSession | None = None) -> None:
    """Refresh a single feed - async implementation.

    Args:
        feed_id: Feed UUID
        db: Optional database session. If not provided, creates a new session.
    """
    logger.info("Starting feed refresh", feed_id=str(feed_id))

    # Use provided session or create new one
    if db is not None:
        feed_service = FeedService(db=db)
        await feed_service.refresh_feed(feed_id=feed_id)
        logger.info("Successfully refreshed feed", feed_id=str(feed_id))
        return

    # Create a new session (for production use)
    async for session in get_worker_db():
        feed_service = FeedService(db=session)
        await feed_service.refresh_feed(feed_id=feed_id)
        logger.info("Successfully refreshed feed", feed_id=str(feed_id))


async def async_schedule_all_feeds(db: AsyncSession | None = None, test_mode: bool = False) -> None:
    """Schedule all feeds needing refresh - async implementation.

    Uses Celery group() for parallel task dispatch, reducing overhead from 5-10ms per task
    to a single batch dispatch operation.

    Args:
        db: Optional database session. If not provided, creates a new session.
        test_mode: If True, directly calls async functions instead of dispatching Celery tasks.
                   This avoids hanging in tests when Celery workers aren't running.
    """
    from celery import group  # type: ignore[import-untyped]

    logger.info("Starting schedule all feed refreshes")

    # Use provided session or create new one
    if db is not None:
        feed_service = FeedService(db=db)
        feeds_to_check = await feed_service.get_feeds_needing_refresh(limit=MAX_FEEDS_BATCH_SIZE)

        logger.info("Found feeds to refresh", feed_count=len(feeds_to_check))

        if feeds_to_check:
            feed_ids = [feed.id for feed in feeds_to_check]

            # In test mode, call async functions directly instead of dispatching Celery tasks
            if test_mode:
                logger.info("Test mode: directly refreshing feeds", task_count=len(feed_ids))
                for feed_id in feed_ids:
                    try:
                        await async_refresh_single_feed(feed_id=feed_id, db=db)
                    except Exception as exc:
                        logger.warning(
                            "Feed refresh failed in test mode",
                            feed_id=str(feed_id),
                            error=str(exc),
                        )
                return

            try:
                # Use Celery group for parallel task dispatch
                # This dispatches all tasks in a single batch operation instead of individual .delay() calls
                task_group = group(refresh_single_feed_task.s(feed_id) for feed_id in feed_ids)
                result = task_group.apply_async()

                logger.info(
                    "Dispatched feed refresh tasks using group",
                    task_count=len(feed_ids),
                    group_id=result.id if hasattr(result, "id") else None,
                )
            except Exception as exc:
                logger.error(
                    "Failed to dispatch feed refresh task group",
                    task_count=len(feed_ids),
                    error=str(exc),
                    exc_info=True,
                )
                raise
        return

    # Create a new session (for production use)
    async for session in get_worker_db():
        feed_service = FeedService(db=session)
        feeds_to_check = await feed_service.get_feeds_needing_refresh(limit=MAX_FEEDS_BATCH_SIZE)

        logger.info("Found feeds to refresh", feed_count=len(feeds_to_check))

        if feeds_to_check:
            feed_ids = [feed.id for feed in feeds_to_check]

            try:
                # Use Celery group for parallel task dispatch
                # This dispatches all tasks in a single batch operation instead of individual .delay() calls
                task_group = group(refresh_single_feed_task.s(feed_id) for feed_id in feed_ids)
                result = task_group.apply_async()

                logger.info(
                    "Dispatched feed refresh tasks using group",
                    task_count=len(feed_ids),
                    group_id=result.id if hasattr(result, "id") else None,
                )
            except Exception as exc:
                logger.error(
                    "Failed to dispatch feed refresh task group",
                    task_count=len(feed_ids),
                    error=str(exc),
                    exc_info=True,
                )
                raise


async def async_enrich_feed(feed_id: UUID, db: AsyncSession | None = None) -> dict[str, Any]:
    """Enrich a feed with AI metadata - async implementation.

    Args:
        feed_id: Feed UUID
        db: Optional database session. If not provided, creates a new session.

    Returns:
        Enrichment result dictionary
    """
    logger.info("Starting feed enrichment", feed_id=str(feed_id))

    # Use provided session or create new one
    if db is not None:
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

    # Create a new session (for production use)
    async for session in get_worker_db():
        enrichment_service = FeedEnrichmentService(db=session)
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


# ============================================================================
# CELERY TASK WRAPPERS
# ============================================================================


@celery.task(
    name="app.workers.feed_tasks.refresh_single_feed_task",
    bind=True,
    max_retries=2,
    default_retry_delay=30,
)
def refresh_single_feed_task(self: Any, feed_id: UUID | str) -> None:
    """Celery task wrapper for refreshing a single feed.

    Args:
        feed_id: Feed UUID (may be string from serialization)
    """
    loop = get_task_event_loop()
    feed_id = ensure_uuid(feed_id)

    try:
        return loop.run_until_complete(async_refresh_single_feed(feed_id=feed_id))
    except Exception as exc:
        # Attempt retry with exponential backoff if under max retries
        if self.request.retries < (self.max_retries or 2):
            logger.info(
                "Retrying refresh_single_feed_task",
                feed_id=str(feed_id),
                attempt=self.request.retries + 1,
                error=str(exc),
            )
            raise self.retry(exc=exc, countdown=60 * (self.request.retries + 1)) from exc

        # Max retries reached, log and re-raise
        logger.error(
            "Max retries reached for refresh_single_feed_task",
            feed_id=str(feed_id),
            error=str(exc),
            exc_info=True,
        )
        raise


@celery.task(name="app.workers.feed_tasks.schedule_all_feed_refreshes_task")
def schedule_all_feed_refreshes_task() -> None:
    """Celery task wrapper for scheduling all feed refreshes."""
    loop = get_task_event_loop()
    return loop.run_until_complete(async_schedule_all_feeds())


@celery.task(
    name="app.workers.feed_tasks.enrich_feed_task",
    bind=True,
    max_retries=2,
    default_retry_delay=300,
)
def enrich_feed_task(self: Any, feed_id: UUID | str) -> dict[str, Any]:
    """Celery task wrapper for enriching a feed with AI metadata.

    Args:
        feed_id: Feed UUID (may be string from serialization)
    """
    loop = get_task_event_loop()
    feed_id = ensure_uuid(feed_id)

    try:
        return loop.run_until_complete(async_enrich_feed(feed_id=feed_id))
    except Exception as exc:
        if self.request.retries < (self.max_retries or 2):
            logger.info(
                "Retrying feed enrichment task",
                feed_id=feed_id,
                attempt=self.request.retries + 1,
            )
            raise self.retry(exc=exc, countdown=300 * (self.request.retries + 1)) from exc
        else:
            logger.error(
                "Max retries reached for feed enrichment task",
                feed_id=feed_id,
                error=str(exc),
                exc_info=True,
            )
            return {
                "success": False,
                "feed_id": feed_id,
                "error": str(exc),
                "status": "task_failed",
            }


# ============================================================================
# UNREAD COMPACTION TASK
# ============================================================================


async def async_compact_unread_articles(db: AsyncSession | None = None) -> dict[str, int]:
    """Compact unread articles by advancing last_read_cutoff for old subscriptions.

    This prevents unread counts from ballooning by automatically marking articles
    older than UNREAD_RETENTION_DAYS as read. Uses Feedly's approach of advancing
    the cutoff timestamp rather than creating individual read states.

    Args:
        db: Optional database session. If not provided, creates a new session.

    Returns:
        Dictionary with updated_subscriptions count
    """

    from sqlalchemy import func, update

    from app.core.constants import UNREAD_RETENTION_DAYS
    from app.models import FeedSubscription

    logger.info("Starting unread compaction", retention_days=UNREAD_RETENTION_DAYS)

    cutoff_date = datetime.now(timezone.utc) - timedelta(days=UNREAD_RETENTION_DAYS)

    # Use provided session or create new one
    if db is not None:
        # Use the provided session directly (for testing)
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

    # Create a new session (for production use)
    async for session in get_worker_db():
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

        result = await session.execute(stmt)
        updated_count = result.rowcount
        await session.commit()

        logger.info(
            "Unread compaction completed",
            updated_subscriptions=updated_count,
            cutoff_date=cutoff_date.isoformat(),
        )

        return {"updated_subscriptions": updated_count}


@celery.task(name="app.workers.feed_tasks.compact_unread_articles_task")
def compact_unread_articles_task() -> dict[str, int]:
    """Celery task wrapper for compacting unread articles.

    This task should be scheduled to run daily via Celery Beat to prevent
    unread counts from growing unbounded over time.
    """
    loop = get_task_event_loop()
    return loop.run_until_complete(async_compact_unread_articles())


# ============================================================================
# ARTICLE COMPACTION TASK
# ============================================================================


async def async_compact_old_articles(db: AsyncSession | None = None) -> dict[str, int]:
    """Compact old articles by deleting articles beyond retention policy.

    Deletes old articles per feed while preserving:
    - At least the newest MIN_ARTICLES_PER_FEED articles per feed
    - Anything published within ARTICLE_RETENTION_DAYS
    - Anything the user has saved (is_read_later=true OR is_favorite=true)

    Uses COALESCE(published_at, created_at) to handle articles with NULL published dates.
    Cascade deletion to article_contents is handled automatically by database triggers.

    Args:
        db: Optional database session. If not provided, creates a new session.

    Returns:
        Dictionary with deleted_articles count
    """
    from sqlalchemy import text

    logger.info(
        "Starting article compaction",
        retention_days=ARTICLE_RETENTION_DAYS,
        min_articles_per_feed=MIN_ARTICLES_PER_FEED,
    )

    # Helper function to execute compaction logic
    async def execute(session: AsyncSession) -> dict[str, int]:
        # Set statement timeout to 15 minutes for safety
        await session.execute(text("SET statement_timeout = '15min'"))

        # Execute the deletion query using CTE for efficiency
        # Note: INTERVAL must be constructed using MAKE_INTERVAL for parameterization
        deletion_query = text("""
            WITH ranked_articles AS (
                SELECT
                    fa.id AS article_id,
                    fa.feed_id,
                    COALESCE(ac.published_at, fa.created_at) AS published_or_created,
                    ROW_NUMBER() OVER (
                        PARTITION BY fa.feed_id
                        ORDER BY COALESCE(ac.published_at, fa.created_at) DESC
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

        result = await session.execute(
            deletion_query,
            {
                "retention_days": ARTICLE_RETENTION_DAYS,
                "min_articles": MIN_ARTICLES_PER_FEED,
            },
        )
        deleted_count = result.rowcount

        # Commit the transaction
        await session.commit()

        # Reset statement timeout to default
        await session.execute(text("RESET statement_timeout"))

        logger.info(
            "Article compaction completed",
            deleted_articles=deleted_count,
            retention_days=ARTICLE_RETENTION_DAYS,
            min_articles_per_feed=MIN_ARTICLES_PER_FEED,
        )

        return {"deleted_articles": deleted_count}

    # Use provided session or create new one
    if db is not None:
        # Use the provided session directly (for testing)
        # The caller manages the transaction
        return await execute(db)

    # Create a new session (for production use)
    result = None
    async for session in get_worker_db():
        result = await execute(session)
        # Don't return here - let the context manager complete properly
        break
    return result


@celery.task(name="app.workers.feed_tasks.compact_old_articles_task")
def compact_old_articles_task() -> dict[str, int]:
    """Celery task wrapper for compacting old articles.

    This task should be scheduled to run weekly via Celery Beat to keep
    the database size manageable while preserving important articles.

    Returns:
        Dictionary with deleted_articles count
    """
    loop = get_task_event_loop()
    return loop.run_until_complete(async_compact_old_articles())
