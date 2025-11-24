"""Article count queries"""

from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import and_, case, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import FeedArticle, FeedSubscription, UserEntry


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
                UserEntry.is_read == False,  # Explicitly marked unread
            ),
        )
        .group_by(FeedArticle.feed_id)
    )

    result = await db.execute(stmt)
    return {feed_id: count for feed_id, count in result.all()}


async def count_read_later_articles(
    db: AsyncSession,
    *,
    user_id: UUID,
) -> int:
    """Count read later articles - uses partial index."""
    stmt = select(func.count(UserEntry.id)).filter(
        UserEntry.user_id == user_id,
        UserEntry.is_read_later == True,
    )

    result = await db.execute(stmt)
    return result.scalar() or 0


async def count_today_articles(
    db: AsyncSession,
    *,
    user_id: UUID,
) -> int:
    """Count articles published today in user's feeds."""
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)

    stmt = (
        select(func.count(FeedArticle.id))
        .join(FeedSubscription, FeedArticle.feed_id == FeedSubscription.feed_id)
        .filter(
            FeedSubscription.user_id == user_id,
            FeedArticle.published_at >= today_start,
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
    """
    # Total articles in subscribed feeds after last_read_cutoff
    total_stmt = (
        select(func.count(FeedArticle.id))
        .join(FeedSubscription, FeedArticle.feed_id == FeedSubscription.feed_id)
        .filter(
            FeedSubscription.user_id == user_id,
            FeedArticle.published_at > FeedSubscription.last_read_cutoff,
        )
    )

    # Articles explicitly marked as read
    read_stmt = select(func.count(UserEntry.id)).filter(
        UserEntry.user_id == user_id,
        UserEntry.is_read == True,
        UserEntry.feed_article_id.isnot(None),
    )

    total_result = await db.execute(total_stmt)
    read_result = await db.execute(read_stmt)

    total = total_result.scalar() or 0
    read = read_result.scalar() or 0

    return max(0, total - read)
