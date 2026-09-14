"""Article compaction worker operations."""

from datetime import datetime, timedelta, timezone

import structlog

from app.core.constants import (
    ARTICLE_RETENTION_DAYS,
    MIN_ARTICLES_PER_FEED,
    UNREAD_RETENTION_DAYS,
)
from app.crud.article.actions import delete_old_article_contents, purge_stale_user_entries
from app.crud.feed.subscription import compact_unread_subscriptions
from app.workers.common import worker_db

logger = structlog.get_logger(__name__)


async def compact_unread_articles() -> dict[str, int]:
    """Update last_read_cutoff for stale subscriptions."""
    cutoff_date = datetime.now(timezone.utc) - timedelta(days=UNREAD_RETENTION_DAYS)
    logger.info("Starting unread compaction", cutoff=cutoff_date.isoformat())

    async with worker_db() as db:
        updated_count = await compact_unread_subscriptions(db, cutoff_date=cutoff_date)

    logger.info("Unread compaction completed", updated=updated_count)
    return {"updated_subscriptions": updated_count}


async def compact_old_articles() -> dict[str, int]:
    """Purge stale user entries and hard delete old article content.

    Saved articles are never expired for any tier - Basic users are capped on count at save
    time instead (see enforce_saved_articles_limit).
    """
    logger.info(
        "Starting article compaction",
        retention=ARTICLE_RETENTION_DAYS,
        min_keep=MIN_ARTICLES_PER_FEED,
    )

    async with worker_db() as db:
        # 1. Purge user entries with no remaining interaction (never touches saved entries)
        purged_entries = await purge_stale_user_entries(db)

        # 2. Hard delete old article content
        deleted_count = await delete_old_article_contents(
            db,
            retention_days=ARTICLE_RETENTION_DAYS,
            min_articles_per_feed=MIN_ARTICLES_PER_FEED,
        )

    logger.info("Article compaction completed", deleted=deleted_count, purged_user_entries=purged_entries)
    return {"deleted_articles": deleted_count, "purged_user_entries": purged_entries}
