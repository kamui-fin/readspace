"""Feed-related Taskiq tasks.

This module defines Taskiq task wrappers that handle:
- Database session management via get_worker_db()
- Task scheduling and retry configuration
- Metrics recording

The actual business logic is in app.workers.feed package.
"""

import time
from typing import Any
from uuid import UUID

import structlog

from app.core.taskiq_app import broker
from app.workers.common import ensure_uuid, get_worker_db, log_pool_stats
from app.workers.feed import (
    batch_enrich_feeds,
    batch_scheduling_duration,
    compact_old_articles,
    compact_unread_articles,
    feeds_scheduled_last_cycle,
    refresh_single_feed,
    schedule_all_feeds,
)

logger = structlog.get_logger(__name__)


@broker.task(
    task_name="feed_tasks.refresh_single_feed",
    # Retry handled by SmartRetryMiddleware with exponential backoff
    # Retries: 3 attempts with delays ~30s, ~1min, ~2min (with jitter)
)
async def refresh_single_feed_task(feed_id: UUID | str) -> None:
    """Refresh a single feed - Taskiq task wrapper.

    Args:
        feed_id: Feed UUID (may be string from serialization)
    """
    feed_id = ensure_uuid(feed_id)

    async for session in get_worker_db():
        await refresh_single_feed(feed_id=feed_id, db=session)


@broker.task(
    task_name="feed_tasks.schedule_all_feed_refreshes",
    schedule=[{"cron": "*/30 * * * *"}],  # Every 30 minutes
)
async def schedule_all_feed_refreshes_task() -> dict[str, Any]:
    """Schedule all feeds needing refresh - Taskiq task wrapper.

    Returns:
        Dictionary with scheduling statistics
    """
    start_time = time.perf_counter()
    async for session in get_worker_db():
        result = await schedule_all_feeds(db=session)

    total_duration = time.perf_counter() - start_time
    batch_scheduling_duration.observe(total_duration)
    feeds_scheduled_last_cycle.set(result.get("dispatched_count", 0))

    logger.info(
        "Feed refresh scheduling cycle completed",
        total_duration_seconds=round(total_duration, 3),
        **result,
    )
    return result


@broker.task(
    task_name="feed_tasks.batch_enrich_feeds",
    schedule=[{"cron": "0 4 * * 0"}],  # Run weekly on Sunday at 4 AM UTC
    # Retry handled by SmartRetryMiddleware with exponential backoff
)
async def batch_enrich_feeds_task() -> dict[str, Any]:
    """Batch enrich all feeds without embeddings - Taskiq task wrapper.

    Returns:
        Dictionary with enrichment statistics
    """
    async for session in get_worker_db():
        return await batch_enrich_feeds(db=session)


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
        return await compact_unread_articles(db=session)


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
        return await compact_old_articles(db=session)


@broker.task(
    task_name="feed_tasks.log_connection_pool_stats",
    schedule=[{"cron": "*/5 * * * *"}],  # Run every 5 minutes
)
async def log_connection_pool_stats_task() -> dict[str, int]:
    """Log database connection pool statistics - Taskiq task wrapper.

    Monitors connection pool health for debugging and capacity planning.
    Logs warnings when utilization exceeds 80%, critical when >95%.

    Returns:
        Dictionary with pool statistics
    """
    return await log_pool_stats()
