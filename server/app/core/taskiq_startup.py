"""Taskiq startup module - imports all tasks for worker discovery.

This module must be imported when starting taskiq workers to ensure
all tasks are registered with the broker.
"""

from app.core.taskiq_app import broker, scheduler  # noqa: F401

# Import all task modules to register tasks with the broker
from app.workers import (  # noqa: F401
    batch_enrich_feeds_task,
    compact_old_articles_task,
    compact_unread_articles_task,
    import_opml_task,
    import_single_feed_task,
    refresh_single_feed_task,
    schedule_all_feed_refreshes_task,
)

__all__ = ["broker", "scheduler"]
