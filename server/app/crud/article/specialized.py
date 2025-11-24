"""Specialized queries using simplified schema."""

from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import ArticleContent, FeedArticle, UserEntry


async def get_read_later_articles(
    db: AsyncSession,
    *,
    user_id: UUID,
    skip: int = 0,
    limit: int = 50,
) -> list[UserEntry]:
    """
    Get read later articles - SIMPLIFIED!

    Single table query using partial index.
    """
    stmt = (
        select(UserEntry)
        .options(
            selectinload(UserEntry.content),
            selectinload(UserEntry.feed_article).selectinload(FeedArticle.feed),
        )
        .filter(UserEntry.user_id == user_id, UserEntry.is_read_later == True)
        .order_by(UserEntry.created_at.desc())
        .offset(skip)
        .limit(limit)
    )

    result = await db.execute(stmt)
    return list(result.scalars().all())


async def count_read_later_articles(db: AsyncSession, *, user_id: UUID) -> int:
    """Count read later articles - uses partial index."""
    stmt = select(func.count(UserEntry.id)).filter(
        UserEntry.user_id == user_id,
        UserEntry.is_read_later == True,
    )

    result = await db.execute(stmt)
    return result.scalar() or 0


async def get_recently_read_articles(
    db: AsyncSession,
    *,
    user_id: UUID,
    skip: int = 0,
    limit: int = 50,
    days_back: int = 30,
) -> list[UserEntry]:
    """Get recently read articles."""
    cutoff_date = datetime.now(timezone.utc) - timedelta(days=days_back)

    stmt = (
        select(UserEntry)
        .options(
            selectinload(UserEntry.content),
            selectinload(UserEntry.feed_article).selectinload(FeedArticle.feed),
        )
        .filter(
            UserEntry.user_id == user_id,
            UserEntry.is_read == True,
            UserEntry.read_at >= cutoff_date,
        )
        .order_by(UserEntry.read_at.desc())
        .offset(skip)
        .limit(limit)
    )

    result = await db.execute(stmt)
    return list(result.scalars().all())


async def count_today_articles(db: AsyncSession, *, user_id: UUID) -> int:
    """Count articles published today in user's feeds."""
    from app.models import FeedSubscription

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


async def count_unread_articles(db: AsyncSession, *, user_id: UUID) -> int:
    """
    Count unread articles - SIMPLIFIED!

    Uses arithmetic: total articles after cutoff - explicitly marked read.
    """
    from app.models import FeedSubscription

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
        UserEntry.feed_article_id.isnot(None),  # Only feed articles
    )

    total_result = await db.execute(total_stmt)
    read_result = await db.execute(read_stmt)

    total = total_result.scalar() or 0
    read = read_result.scalar() or 0

    return max(0, total - read)


async def count_unread_articles_by_folder(db: AsyncSession, *, user_id: UUID, folder_id: UUID) -> int:
    """Count unread articles in a specific folder."""
    from app.models import FeedSubscription

    # Total in folder after cutoff
    total_stmt = (
        select(func.count(FeedArticle.id))
        .join(FeedSubscription, FeedArticle.feed_id == FeedSubscription.feed_id)
        .filter(
            FeedSubscription.user_id == user_id,
            FeedSubscription.folder_id == folder_id,
            FeedArticle.published_at > FeedSubscription.last_read_cutoff,
        )
    )

    # Read in this folder
    read_stmt = (
        select(func.count(UserEntry.id))
        .join(FeedArticle, UserEntry.feed_article_id == FeedArticle.id)
        .join(FeedSubscription, FeedArticle.feed_id == FeedSubscription.feed_id)
        .filter(
            UserEntry.user_id == user_id,
            UserEntry.is_read == True,
            FeedSubscription.folder_id == folder_id,
        )
    )

    total_result = await db.execute(total_stmt)
    read_result = await db.execute(read_stmt)

    total = total_result.scalar() or 0
    read = read_result.scalar() or 0

    return max(0, total - read)
