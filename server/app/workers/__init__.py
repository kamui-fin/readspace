"""Taskiq worker tasks."""

from app.workers.feed_tasks import (
    batch_enrich_feeds_task,
    compact_old_articles_task,
    compact_unread_articles_task,
    refresh_single_feed_task,
    schedule_all_feed_refreshes_task,
)
from app.workers.opml_tasks import import_opml_task, import_single_feed_task

__all__ = [
    "refresh_single_feed_task",
    "schedule_all_feed_refreshes_task",
    "batch_enrich_feeds_task",
    "compact_unread_articles_task",
    "compact_old_articles_task",
    "import_single_feed_task",
    "import_opml_task",
]
