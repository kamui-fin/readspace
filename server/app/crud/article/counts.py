"""Article count queries"""

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.article import FeedArticle, UserEntry
from app.models.feed import FeedSubscription


async def get_unread_counts_per_feed(
    db: AsyncSession,
    *,
    user_id: UUID,
) -> dict[UUID, int]:
    """
    Get unread article counts for each feed subscription.

    Returns a dict mapping feed_id -> unread_count.
    Uses cutoff-based logic: articles after cutoff that aren't explicitly marked read.
    """
    stmt = (
        select(
            FeedArticle.feed_id,
            func.count(FeedArticle.id).label("unread_count"),
        )
        .join(FeedSubscription, FeedArticle.feed_id == FeedSubscription.feed_id)
        .outerjoin(
            UserEntry,
            and_(
                UserEntry.content_id == FeedArticle.content_id,
                UserEntry.user_id == user_id,
            ),
        )
        .where(
            FeedSubscription.user_id == user_id,
            FeedArticle.published_at > FeedSubscription.last_read_cutoff,
            or_(
                UserEntry.is_read.is_(None),  # Not marked at all
                ~UserEntry.is_read,  # Explicitly marked unread
            ),
        )
        .group_by(FeedArticle.feed_id)
    )

    result = await db.execute(stmt)
    return {row.feed_id: row.unread_count for row in result.all()}


async def count_read_later_articles(
    db: AsyncSession,
    *,
    user_id: UUID,
) -> int:
    """Count read later articles - uses partial index."""
    stmt = select(func.count(UserEntry.id)).filter(
        UserEntry.user_id == user_id,
        UserEntry.is_saved,
    )

    result = await db.execute(stmt)
    return result.scalar() or 0


async def count_today_articles(
    db: AsyncSession,
    *,
    user_id: UUID,
) -> int:
    """Count articles published today in user's feeds."""
    today_start = datetime.now(timezone.utc).replace(
        hour=0, minute=0, second=0, microsecond=0
    )

    stmt = (
        select(func.count(FeedArticle.id))
        .join(FeedSubscription, FeedArticle.feed_id == FeedSubscription.feed_id)
        .outerjoin(
            UserEntry,
            and_(
                UserEntry.content_id == FeedArticle.content_id,
                UserEntry.user_id == user_id,
            ),
        )
        .filter(
            FeedSubscription.user_id == user_id,
            FeedArticle.published_at >= today_start,
            or_(
                FeedSubscription.last_read_cutoff.is_(None),
                FeedArticle.published_at > FeedSubscription.last_read_cutoff,
            ),
            or_(
                UserEntry.is_read.is_(None),  # Not marked at all
                ~UserEntry.is_read,  # Explicitly marked unread
            ),
        )
    )

    result = await db.execute(stmt)
    return result.scalar() or 0


async def count_total_unread_articles(
    db: AsyncSession,
    *,
    user_id: UUID,
) -> int:
    """
    Count total unread articles across all feeds.

    Uses arithmetic: total articles after cutoff - explicitly marked read.
    If cutoff is None, all articles in that feed are considered unread.
    """
    # Total articles in subscribed feeds after last_read_cutoff (or all if cutoff is None)
    total_stmt = (
        select(func.count(FeedArticle.id))
        .join(FeedSubscription, FeedArticle.feed_id == FeedSubscription.feed_id)
        .filter(
            FeedSubscription.user_id == user_id,
            or_(
                FeedSubscription.last_read_cutoff.is_(None),
                FeedArticle.published_at > FeedSubscription.last_read_cutoff,
            ),
        )
    )

    # Articles explicitly marked as read
    read_stmt = select(func.count(UserEntry.id)).filter(
        UserEntry.user_id == user_id,
        UserEntry.is_read,
        UserEntry.feed_article_id.isnot(None),
    )

    total_result = await db.execute(total_stmt)
    read_result = await db.execute(read_stmt)

    total = total_result.scalar() or 0
    read = read_result.scalar() or 0

    return max(0, total - read)
