"""Feed refresh worker operations."""

import time
from typing import Any
from uuid import UUID

import structlog

from app.core.constants import MAX_FEEDS_BATCH_SIZE
from app.services.feeds.feed import FeedService
from app.workers.common import worker_db_factory

logger = structlog.get_logger(__name__)


async def refresh_single_feed(feed_id: UUID) -> None:
    """Refresh a single feed.

    Args:
        feed_id: Feed UUID
    """
    start_time = time.perf_counter()
    logger.info("Starting feed refresh", feed_id=str(feed_id))

    feed_service = FeedService()
    await feed_service.refresh_feed(worker_db_factory, feed_id=feed_id)

    duration = time.perf_counter() - start_time

    logger.info(
        "Successfully refreshed feed",
        feed_id=str(feed_id),
        duration_seconds=round(duration, 3),
        duration_ms=round(duration * 1000, 1),
    )


async def schedule_all_feeds(test_mode: bool = False) -> dict[str, Any]:
    """Schedule all feeds needing refresh.

    Args:
        test_mode: If True, directly calls async functions instead of dispatching tasks

    Returns:
        Dictionary with scheduling statistics
    """

    start_time = time.perf_counter()
    logger.info("Starting schedule all feed refreshes")

    feed_service = FeedService()
    feeds_to_check = await feed_service.get_feeds_needing_refresh(worker_db_factory, limit=MAX_FEEDS_BATCH_SIZE)

    logger.info("Found feeds to refresh", feed_count=len(feeds_to_check))

    dispatched_count = 0
    if feeds_to_check:
        feed_ids = [feed.id for feed in feeds_to_check]

        if test_mode:
            # In test mode, refresh feeds directly
            for feed_id in feed_ids:
                await refresh_single_feed(feed_id=feed_id)
                dispatched_count += 1
        else:
            # In production mode, kick tasks
            # Import here to avoid circular dependency
            from app.workers.feed_tasks import refresh_single_feed_task

            for feed_id in feed_ids:
                await refresh_single_feed_task.kiq(feed_id)
                dispatched_count += 1

        duration = time.perf_counter() - start_time
        feeds_per_second = round(dispatched_count / duration, 2) if duration > 0 else 0

        logger.info(
            "Dispatched feed refresh tasks",
            task_count=dispatched_count,
            duration_seconds=round(duration, 3),
            feeds_per_second=feeds_per_second,
        )

        return {
            "dispatched_count": dispatched_count,
            "duration_seconds": round(duration, 3),
            "feeds_per_second": feeds_per_second,
        }

    return {"dispatched_count": 0, "duration_seconds": 0, "feeds_per_second": 0}
