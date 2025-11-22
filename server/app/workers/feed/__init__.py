"""Feed worker operations.

This package contains the business logic for feed-related background tasks.
The actual Taskiq task definitions are in app.workers.feed_tasks.
"""

from app.workers.feed.compaction import compact_old_articles, compact_unread_articles
from app.workers.feed.enrichment import batch_enrich_feeds
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
]
