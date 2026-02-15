"""Feed-related Taskiq tasks."""

from typing import Any
from uuid import UUID

import structlog

from app.core.taskiq_app import broker
from app.workers.common import ensure_uuid
from app.workers.feed.compaction import compact_old_articles, compact_unread_articles
from app.workers.feed.enrichment import batch_enrich_feeds
from app.workers.feed.refresh import refresh_single_feed, schedule_all_feeds

logger = structlog.get_logger(__name__)


@broker.task(task_name="feed_tasks.refresh_single_feed")
async def refresh_single_feed_task(feed_id: UUID | str) -> None:
    """Refresh single feed (Wrapper)."""
    await refresh_single_feed(feed_id=ensure_uuid(feed_id))


@broker.task(
    task_name="feed_tasks.schedule_all_feed_refreshes",
    schedule=[{"cron": "*/30 * * * *"}],
)
async def schedule_all_feed_refreshes_task() -> None:
    """Cron: Schedule refreshes (Wrapper)."""
    await schedule_all_feeds()


@broker.task(
    task_name="feed_tasks.batch_enrich_feeds",
    schedule=[{"cron": "0 4 * * 0"}],
)
async def batch_enrich_feeds_task() -> dict[str, Any]:
    """Cron: Batch enrichment (Wrapper)."""
    return await batch_enrich_feeds()


@broker.task(
    task_name="feed_tasks.compact_unread_articles",
    schedule=[{"cron": "0 2 * * *"}],
)
async def compact_unread_articles_task() -> dict[str, int]:
    """Cron: Unread compaction (Wrapper)."""
    return await compact_unread_articles()


@broker.task(
    task_name="feed_tasks.compact_old_articles",
    schedule=[{"cron": "0 3 * * 0"}],
)
async def compact_old_articles_task() -> dict[str, int]:
    """Cron: Article cleanup (Wrapper)."""
    return await compact_old_articles()
