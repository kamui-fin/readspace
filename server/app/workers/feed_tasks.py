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
from app.workers.common import ensure_uuid
from app.workers.feed import (
    batch_enrich_feeds,
    compact_old_articles,
    compact_unread_articles,
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
    
    The service function manages its own database sessions internally:
    Phase 1: Quick metadata fetch (<10ms) + COMMIT → connection released
    Phase 2: Network I/O without DB connection (0-30s)
    Phase 3: Quick database write (<500ms) + COMMIT → connection released

    Args:
        feed_id: Feed UUID (may be string from serialization)
    """
    feed_id = ensure_uuid(feed_id)

    # Service function manages its own sessions - NO session passed
    await refresh_single_feed(feed_id=feed_id)


@broker.task(
    task_name="feed_tasks.schedule_all_feed_refreshes",
    schedule=[{"cron": "*/30 * * * *"}],  # Every 30 minutes
)
async def schedule_all_feed_refreshes_task() -> dict[str, Any]:
    """Schedule all feeds needing refresh - Taskiq task wrapper.
    
    This is a quick orchestration task that:
    1. Queries feeds needing refresh (single quick query)
    2. Dispatches individual refresh tasks to the queue
    
    Total DB time: <100ms for querying feed IDs

    Returns:
        Dictionary with scheduling statistics
    """
    start_time = time.perf_counter()
    
    # Service function manages its own session - NO session passed
    result = await schedule_all_feeds()

    total_duration = time.perf_counter() - start_time

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
    
    LONG-RUNNING TASK: Processes feeds in batches to avoid holding connections.
    Pattern: Load batch → Process (AI calls) → Save batch → Repeat
    
    Each batch cycle:
    - DB time: ~100ms (load + save)
    - AI time: ~5-10s (no DB connection held)
    - Connection released between batches

    Returns:
        Dictionary with enrichment statistics
    """
    # Service function manages its own sessions in batches
    return await batch_enrich_feeds()


@broker.task(
    task_name="feed_tasks.compact_unread_articles",
    schedule=[{"cron": "0 2 * * *"}],  # Run daily at 2 AM UTC
)
async def compact_unread_articles_task() -> dict[str, int]:
    """Compact unread articles - Taskiq task wrapper.
    
    LONG-RUNNING TASK: Processes subscriptions in batches.
    Pattern: Load batch → Process → Save batch → Repeat

    Returns:
        Dictionary with updated_subscriptions count
    """
    # Service function manages its own sessions in batches
    return await compact_unread_articles()


@broker.task(
    task_name="feed_tasks.compact_old_articles",
    schedule=[{"cron": "0 3 * * 0"}],  # Run weekly on Sunday at 3 AM UTC
)
async def compact_old_articles_task() -> dict[str, int]:
    """Compact old articles - Taskiq task wrapper.
    
    LONG-RUNNING TASK: Processes articles in batches.
    Pattern: Load batch → Delete → Load next batch → Repeat

    Returns:
        Dictionary with deleted_articles count
    """
    # Service function manages its own sessions in batches
    return await compact_old_articles()