"""Feed worker operations.

This package contains the business logic for feed-related background tasks.
The actual Taskiq task definitions are in app.workers.feed_tasks.
"""

from app.workers.feed.compaction import compact_old_articles, compact_unread_articles
from app.workers.feed.enrichment import batch_enrich_feeds
from app.workers.feed.metrics import (
    batch_scheduling_duration,
    feed_refresh_duration,
    feeds_failed_total,
    feeds_in_progress,
    feeds_refreshed_total,
    feeds_scheduled_last_cycle,
)
from app.workers.feed.refresh import refresh_single_feed, schedule_all_feeds

__all__ = [
    # Refresh operations
    "refresh_single_feed",
    "schedule_all_feeds",
    # Enrichment operations
    "batch_enrich_feeds",
    # Compaction operations
    "compact_unread_articles",
    "compact_old_articles",
    # Metrics
    "feeds_refreshed_total",
    "feeds_failed_total",
    "feeds_in_progress",
    "feed_refresh_duration",
    "feeds_scheduled_last_cycle",
    "batch_scheduling_duration",
]
