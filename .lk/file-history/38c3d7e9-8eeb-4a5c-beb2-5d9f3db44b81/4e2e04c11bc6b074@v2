"""Feed-related Celery tasks."""

from typing import Any
from uuid import UUID

import structlog

from app.core.celery_app import celery
from app.core.constants import MAX_FEEDS_BATCH_SIZE
from app.services.feed_enrichment_service import FeedEnrichmentService
from app.services.feed_service import FeedService
from app.workers.common import get_persistent_db_engine, get_task_event_loop

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

    _, session_maker = await get_persistent_db_engine()
    async with session_maker() as db:
        feed_service = FeedService(db=db)
        await feed_service.refresh_feed(feed_id=feed_id)
        logger.info("Successfully refreshed feed", feed_id=str(feed_id))


async def async_schedule_all_feeds() -> None:
    """Schedule all feeds needing refresh - async implementation."""
    logger.info("Starting schedule all feed refreshes")

    _, session_maker = await get_persistent_db_engine()
    async with session_maker() as db:
        feed_service = FeedService(db=db)
        feeds_to_check = await feed_service.get_feeds_needing_refresh(limit=MAX_FEEDS_BATCH_SIZE)

        logger.info(f"Found {len(feeds_to_check)} feeds to refresh")

        if feeds_to_check:
            feed_ids = [str(feed.id) for feed in feeds_to_check]
            tasks = [refresh_single_feed_task.delay(feed_id) for feed_id in feed_ids]
            logger.info(f"Bulk dispatched {len(tasks)} feed refresh tasks")


async def async_enrich_feed(feed_id: UUID) -> dict[str, Any]:
    """Enrich a feed with AI metadata - async implementation.

    Args:
        feed_id: Feed UUID

    Returns:
        Enrichment result dictionary
    """
    logger.info("Starting feed enrichment", feed_id=str(feed_id))

    _, session_maker = await get_persistent_db_engine()
    async with session_maker() as db:
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
def refresh_single_feed_task(self: Any, feed_id: str) -> None:
    """Celery task wrapper for refreshing a single feed."""
    loop = get_task_event_loop()

    try:
        return loop.run_until_complete(async_refresh_single_feed(feed_id=UUID(feed_id)))
    except Exception as exc:
        error_str = str(exc).lower()

        # Categorize errors for better handling
        if "dataerror" in error_str or "invalid input for query argument" in error_str:
            logger.error(
                "SQL type conversion error for refresh_single_feed_task",
                feed_id=feed_id,
                error=str(exc),
            )
            if self.request.retries < (self.max_retries or 2):
                logger.info(
                    f"Retrying refresh_single_feed_task after SQL error, attempt {self.request.retries + 1}",
                    feed_id=feed_id,
                )
                raise self.retry(exc=exc, countdown=60 * (self.request.retries + 1)) from exc
            else:
                logger.error(
                    "Max retries reached for refresh_single_feed_task with SQL error",
                    feed_id=feed_id,
                    error=str(exc),
                )
                raise ConnectionError("Feed data contains invalid types") from exc

        elif "timeout" in error_str or "timed out" in error_str:
            raise ConnectionError("Feed timed out during refresh") from exc

        elif "connection" in error_str:
            raise ConnectionError("Connection failed during feed refresh") from exc

        else:
            # General errors - retry with backoff
            if self.request.retries < (self.max_retries or 2):
                logger.info(
                    f"Retrying refresh_single_feed_task, attempt {self.request.retries + 1}",
                    feed_id=feed_id,
                )
                raise self.retry(exc=exc, countdown=60 * (self.request.retries + 1)) from exc
            else:
                logger.error(
                    "Max retries reached for refresh_single_feed_task",
                    feed_id=feed_id,
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
def enrich_feed_task(self: Any, feed_id: str) -> dict[str, Any]:
    """Celery task wrapper for enriching a feed with AI metadata."""
    loop = get_task_event_loop()

    try:
        return loop.run_until_complete(async_enrich_feed(feed_id=UUID(feed_id)))
    except Exception as exc:
        if self.request.retries < (self.max_retries or 2):
            logger.info(
                f"Retrying feed enrichment task, attempt {self.request.retries + 1}",
                feed_id=feed_id,
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
