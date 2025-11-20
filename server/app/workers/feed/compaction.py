"""Article compaction worker operations."""

from datetime import datetime, timedelta, timezone

import structlog
from sqlalchemy import func, text, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import ARTICLE_RETENTION_DAYS, MIN_ARTICLES_PER_FEED, UNREAD_RETENTION_DAYS
from app.models import FeedSubscription

logger = structlog.get_logger(__name__)


async def compact_unread_articles(db: AsyncSession) -> dict[str, int]:
    """Compact unread articles by updating last_read_cutoff.

    Args:
        db: Database session

    Returns:
        Dictionary with updated_subscriptions count
    """
    logger.info("Starting unread compaction", retention_days=UNREAD_RETENTION_DAYS)

    cutoff_date = datetime.now(timezone.utc) - timedelta(days=UNREAD_RETENTION_DAYS)

    stmt = (
        update(FeedSubscription)
        .values(
            last_read_cutoff=func.greatest(
                func.coalesce(FeedSubscription.last_read_cutoff, cutoff_date),
                cutoff_date,
            )
        )
        .execution_options(synchronize_session=False)
    )

    result = await db.execute(stmt)
    updated_count = result.rowcount

    logger.info(
        "Unread compaction completed",
        updated_subscriptions=updated_count,
        cutoff_date=cutoff_date.isoformat(),
    )

    return {"updated_subscriptions": updated_count}


async def compact_old_articles(db: AsyncSession) -> dict[str, int]:
    """Compact old articles by deleting eligible article_contents.

    IMPORTANT: This deletes article_contents (which cascade deletes feed_articles),
    not feed_articles directly. Deleting feed_articles would leave orphaned content.

    Args:
        db: Database session

    Returns:
        Dictionary with deleted_articles count
    """
    logger.info(
        "Starting article compaction",
        retention_days=ARTICLE_RETENTION_DAYS,
        min_articles_per_feed=MIN_ARTICLES_PER_FEED,
    )

    # Set timeout first (must be separate statement for asyncpg)
    await db.execute(text("SET LOCAL statement_timeout = '120min'"))

    # Execute the deletion query
    deletion_query = text(
        """
        WITH ranked_articles AS (
            SELECT
                ac.id AS content_id,
                fa.feed_id,
                ac.published_at AS published_or_created,
                ROW_NUMBER() OVER (
                    PARTITION BY fa.feed_id
                    ORDER BY ac.published_at DESC
                ) AS rn
            FROM feed_articles fa
            JOIN article_contents ac ON fa.content_id = ac.id
        ),
        eligible_contents AS (
            SELECT ra.content_id
            FROM ranked_articles ra
            LEFT JOIN user_article_states uas
                ON uas.article_id = (
                    SELECT fa2.id FROM feed_articles fa2 WHERE fa2.content_id = ra.content_id LIMIT 1
                )
                AND (uas.is_read_later = TRUE OR uas.is_favorite = TRUE)
            LEFT JOIN clipped_articles ca
                ON ca.content_id = ra.content_id
            WHERE ra.published_or_created < NOW() - MAKE_INTERVAL(days => :retention_days)
              AND uas.id IS NULL       -- no saved states
              AND ca.id IS NULL        -- not clipped
              AND ra.rn > :min_articles -- not in top N newest
        )
        DELETE FROM article_contents
        WHERE id IN (SELECT content_id FROM eligible_contents)
    """
    )

    result = await db.execute(
        deletion_query,
        {
            "retention_days": ARTICLE_RETENTION_DAYS,
            "min_articles": MIN_ARTICLES_PER_FEED,
        },
    )
    deleted_count = result.rowcount

    logger.info(
        "Article compaction completed",
        deleted_contents=deleted_count,
        retention_days=ARTICLE_RETENTION_DAYS,
        min_articles_per_feed=MIN_ARTICLES_PER_FEED,
    )

    return {"deleted_articles": deleted_count}
