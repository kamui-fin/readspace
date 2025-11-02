"""Feed-related Celery tasks."""

from typing import Any
from uuid import UUID

import structlog

from app.core.celery_app import celery
from app.core.constants import MAX_FEEDS_BATCH_SIZE
from app.services.feeds.enrichment.feed_enrichment import FeedEnrichmentService
from app.services.feeds.feed import FeedService
from app.workers.common import ensure_uuid, get_task_event_loop, get_worker_db

logger = structlog.get_logger(__name__)


# ============================================================================
# ASYNC IMPLEMENTATIONS
# ============================================================================


async def async_refresh_single_feed(feed_id: UUID) -> None:
    """Refresh a single feed - async implementation.

    Args:
        feed_id: Feed UUID
    """
    logger.info("Starting feed refresh", feed_id=str(feed_id))

    async for db in get_worker_db():
        feed_service = FeedService(db=db)
        await feed_service.refresh_feed(feed_id=feed_id)
        logger.info("Successfully refreshed feed", feed_id=str(feed_id))


async def async_schedule_all_feeds() -> None:
    """Schedule all feeds needing refresh - async implementation.

    Uses Celery group() for parallel task dispatch, reducing overhead from 5-10ms per task
    to a single batch dispatch operation.
    """
    from celery import group  # type: ignore[import-untyped]

    logger.info("Starting schedule all feed refreshes")

    async for db in get_worker_db():
        feed_service = FeedService(db=db)
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


async def async_enrich_feed(feed_id: UUID) -> dict[str, Any]:
    """Enrich a feed with AI metadata - async implementation.

    Args:
        feed_id: Feed UUID

    Returns:
        Enrichment result dictionary
    """
    logger.info("Starting feed enrichment", feed_id=str(feed_id))

    async for db in get_worker_db():
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
