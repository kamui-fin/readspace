"""Feed refresh worker operations."""

import time
from uuid import UUID

import structlog

from app.core.constants import MAX_FEEDS_BATCH_SIZE
from app.crud.feed.core import get_feeds_for_worker
from app.services.feeds.service import refresh_feed
from app.workers.common import worker_db_factory
from app.workers.feed_tasks import refresh_single_feed_task

logger = structlog.get_logger(__name__)


async def refresh_single_feed(feed_id: UUID) -> None:
    """Refresh a single feed.

    Args:
        feed_id: Feed UUID
    """
    start_time = time.perf_counter()
    logger.info("Starting feed refresh", feed_id=str(feed_id))

    await refresh_feed(worker_db_factory, feed_id=feed_id)

    duration = time.perf_counter() - start_time
    logger.info(
        "Successfully refreshed feed",
        feed_id=str(feed_id),
        duration_seconds=round(duration, 3),
        duration_ms=round(duration * 1000, 1),
    )


async def schedule_all_feeds() -> None:
    """Schedule all feeds needing refresh.

    Args:
        test_mode: If True, directly calls async functions instead of dispatching tasks

    Returns:
        Dictionary with scheduling statistics
    """
    # Surgical session: quick DB query, then close
    async with worker_db_factory() as db:
        feeds = await get_feeds_for_worker(db, limit=MAX_FEEDS_BATCH_SIZE)
        feed_ids = [feed.id for feed in feeds]

    logger.info("Found feeds to refresh", feed_count=len(feed_ids))

    if not feed_ids:
        logger.info("No feeds to refresh")
        return

    for feed_id in feed_ids:
        await refresh_single_feed_task.kiq(feed_id)
