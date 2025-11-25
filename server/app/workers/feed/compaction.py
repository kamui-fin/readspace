"""Article compaction worker operations."""

from datetime import datetime, timedelta, timezone

import structlog

from app.core.constants import ARTICLE_RETENTION_DAYS, MIN_ARTICLES_PER_FEED, UNREAD_RETENTION_DAYS
from app.crud.article.actions import delete_old_article_contents
from app.crud.feed.subscription import compact_unread_subscriptions
from app.workers.common import worker_db

logger = structlog.get_logger(__name__)


async def compact_unread_articles() -> dict[str, int]:
    """Compact unread articles by updating last_read_cutoff.

    Worker manages its own database session and orchestrates the compaction.
    Business logic (cutoff calculation) stays here, database operations in CRUD.

    Returns:
        Dictionary with updated_subscriptions count
    """
    logger.info("Starting unread compaction", retention_days=UNREAD_RETENTION_DAYS)

    cutoff_date = datetime.now(timezone.utc) - timedelta(days=UNREAD_RETENTION_DAYS)

    async with worker_db() as db:
        updated_count = await compact_unread_subscriptions(db, cutoff_date=cutoff_date)

        logger.info(
            "Unread compaction completed",
            updated_subscriptions=updated_count,
            cutoff_date=cutoff_date.isoformat(),
        )

        return {"updated_subscriptions": updated_count}


async def compact_old_articles() -> dict[str, int]:
    """Compact old articles by deleting eligible article_contents.

    IMPORTANT: This deletes article_contents (which cascade deletes feed_articles),
    not feed_articles directly. Deleting feed_articles would leave orphaned content.

    Worker manages its own database session and orchestrates the compaction.
    Business logic (retention parameters) stays here, database operations in CRUD.

    Returns:
        Dictionary with deleted_articles count
    """
    logger.info(
        "Starting article compaction",
        retention_days=ARTICLE_RETENTION_DAYS,
        min_articles_per_feed=MIN_ARTICLES_PER_FEED,
    )

    async with worker_db() as db:
        deleted_count = await delete_old_article_contents(
            db, retention_days=ARTICLE_RETENTION_DAYS, min_articles_per_feed=MIN_ARTICLES_PER_FEED
        )

        logger.info(
            "Article compaction completed",
            deleted_contents=deleted_count,
            retention_days=ARTICLE_RETENTION_DAYS,
            min_articles_per_feed=MIN_ARTICLES_PER_FEED,
        )

        return {"deleted_articles": deleted_count}
