"""Feed refresh worker operations."""

import time
from uuid import UUID

import structlog

from app.core.constants import MAX_FEEDS_BATCH_SIZE
from app.crud.feed.core import get_feeds_for_worker
from app.services.feeds.service import refresh_feed
from app.workers.common import worker_db_factory

logger = structlog.get_logger(__name__)


async def refresh_single_feed(feed_id: UUID) -> None:
    """Execute refresh for a single feed using the service layer."""
    start_time = time.perf_counter()
    logger.info("Starting feed refresh", feed_id=str(feed_id))

    # refresh_feed handles its own sessions via the factory
    await refresh_feed(worker_db_factory, feed_id=feed_id)

    duration = time.perf_counter() - start_time
    logger.info("Refreshed feed", feed_id=str(feed_id), duration=round(duration, 3))


async def schedule_all_feeds() -> None:
    """Identify stale feeds and dispatch refresh tasks."""
    # 1. Surgical DB Query
    async with worker_db_factory() as db:
        feeds = await get_feeds_for_worker(db, limit=MAX_FEEDS_BATCH_SIZE)
        feed_ids = [feed.id for feed in feeds]

    if not feed_ids:
        logger.info("No feeds to refresh")
        return

    logger.info("Dispatching refresh tasks", count=len(feed_ids))

    # 2. Dispatch Tasks (Lazy import to avoid circular dependency)
    from app.workers.feed_tasks import refresh_single_feed_task

    for feed_id in feed_ids:
        await refresh_single_feed_task.kiq(feed_id)
