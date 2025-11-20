"""Specialized article queries for specific use cases."""

from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import and_, desc, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.constants import MAX_PAGE_SIZE
from app.models import (
    ArticleContent,
    ClippedArticle,
    FeedArticle,
    FeedSubscription,
    UserArticleState,
)


async def get_recently_read_articles(
    db: AsyncSession,
    *,
    user_id: UUID,
    skip: int = 0,
    limit: int = 50,
    days_back: int = 30,
) -> list[tuple[FeedArticle, UserArticleState]]:
    """Get recently read articles for a user.

    Returns tuples of (FeedArticle, UserArticleState) to provide both the article
    and its user-specific state (including read_at timestamp).
    """
    since_date = datetime.now(timezone.utc) - timedelta(days=days_back)

    # Build the query for recently read articles
    stmt = (
        select(FeedArticle, UserArticleState)
        .join(ArticleContent, FeedArticle.content_id == ArticleContent.id)
        .join(FeedSubscription, FeedSubscription.feed_id == FeedArticle.feed_id)
        .join(UserArticleState, UserArticleState.article_id == FeedArticle.id)
        .filter(
            and_(
                FeedSubscription.user_id == user_id,
                UserArticleState.user_id == user_id,
                UserArticleState.is_read.is_(True),
                UserArticleState.read_at >= since_date,
            )
        )
        .order_by(desc(UserArticleState.read_at))
        .options(
            # Only load the feed, not all subscriptions (avoids 10-1000x data inflation)
            selectinload(FeedArticle.feed),
            selectinload(FeedArticle.content),
        )
        .offset(skip)
        .limit(limit)
    )

    articles_result = await db.execute(stmt)
    # Return tuples of (FeedArticle, UserArticleState)
    articles = list(articles_result.all())

    return articles


async def count_read_later_articles(db: AsyncSession, *, user_id: UUID) -> int:
    """Count articles marked as read later for a user (includes both feed and clipped articles)."""
    # Count feed articles marked as read later
    feed_result = await db.execute(
        select(func.count(FeedArticle.id))
        .join(FeedSubscription, FeedSubscription.feed_id == FeedArticle.feed_id)
        .join(UserArticleState, UserArticleState.article_id == FeedArticle.id)
        .filter(
            and_(
                FeedSubscription.user_id == user_id,
                UserArticleState.user_id == user_id,
                UserArticleState.is_read_later.is_(True),
            )
        )
    )
    feed_count = feed_result.scalar_one_or_none() or 0

    # Count clipped articles marked as read later
    clipped_result = await db.execute(
        select(func.count(ClippedArticle.id)).filter(
            and_(
                ClippedArticle.user_id == user_id,
                ClippedArticle.is_read_later.is_(True),
            )
        )
    )
    clipped_count = clipped_result.scalar_one_or_none() or 0

    return feed_count + clipped_count


async def count_today_articles(db: AsyncSession, *, user_id: UUID) -> int:
    """Count unread articles published in the last 24 hours for a user."""
    # Use same 24-hour UTC logic as the today articles route
    now_utc = datetime.now(timezone.utc)
    twenty_four_hours_ago = now_utc - timedelta(hours=24)

    result = await db.execute(
        select(func.count(FeedArticle.id))
        .join(ArticleContent, FeedArticle.content_id == ArticleContent.id)
        .join(FeedSubscription, FeedSubscription.feed_id == FeedArticle.feed_id)
        .outerjoin(
            UserArticleState,
            and_(
                UserArticleState.article_id == FeedArticle.id,
                UserArticleState.user_id == user_id,
            ),
        )
        .filter(
            and_(
                FeedSubscription.user_id == user_id,
                # Hybrid unread logic:
                # 1. Article must be newer than cutoff (or cutoff is NULL)
                # 2. AND no explicit read state (or explicitly marked unread)
                or_(
                    ArticleContent.published_at > FeedSubscription.last_read_cutoff,
                    FeedSubscription.last_read_cutoff.is_(None),
                ),
                or_(
                    UserArticleState.is_read.is_(None),
                    UserArticleState.is_read.is_(False),
                ),
                ArticleContent.published_at >= twenty_four_hours_ago,
                ArticleContent.published_at <= now_utc,
            )
        )
    )
    return result.scalar_one_or_none() or 0


async def get_read_later_articles(
    db: AsyncSession,
    *,
    user_id: UUID,
    skip: int = 0,
    limit: int = 50,
) -> list[FeedArticle]:
    """Get articles marked as read later for a user.

    Args:
        db: Database session
        user_id: User ID to filter articles for
        skip: Number of items to skip for pagination
        limit: Maximum number of items to return (capped at MAX_PAGE_SIZE)

    Returns:
        List of FeedArticle objects marked as read later

    Raises:
        ValueError: If limit exceeds MAX_PAGE_SIZE
    """
    # Validate and cap limit to prevent unbounded queries
    if limit > MAX_PAGE_SIZE:
        raise ValueError(f"Limit cannot exceed {MAX_PAGE_SIZE}")

    # Build the query for read later articles
    stmt = (
        select(FeedArticle)
        .join(ArticleContent, FeedArticle.content_id == ArticleContent.id)
        .join(FeedSubscription, FeedSubscription.feed_id == FeedArticle.feed_id)
        .join(UserArticleState, UserArticleState.article_id == FeedArticle.id)
        .filter(
            and_(
                FeedSubscription.user_id == user_id,
                UserArticleState.user_id == user_id,
                UserArticleState.is_read_later.is_(True),
            )
        )
        .order_by(desc(ArticleContent.published_at))
        .options(
            # Only load the feed, not all subscriptions (avoids 10-1000x data inflation)
            selectinload(FeedArticle.feed),
            selectinload(FeedArticle.content),
            # NOTE: user_states removed - already fetched via join, loading all states is N+1
        )
        .offset(skip)
        .limit(limit)
    )

    articles_result = await db.execute(stmt)
    articles = list(articles_result.scalars().all())

    return articles


async def count_unread_articles(db: AsyncSession, *, user_id: UUID) -> int:
    """Count total unread articles for a user."""
    result = await db.execute(
        select(func.count(FeedArticle.id))
        .join(ArticleContent, FeedArticle.content_id == ArticleContent.id)
        .join(FeedSubscription, FeedSubscription.feed_id == FeedArticle.feed_id)
        .outerjoin(
            UserArticleState,
            and_(
                UserArticleState.article_id == FeedArticle.id,
                UserArticleState.user_id == user_id,
            ),
        )
        .filter(
            and_(
                FeedSubscription.user_id == user_id,
                # Hybrid unread logic:
                # 1. Article must be newer than cutoff (or cutoff is NULL)
                # 2. AND no explicit read state (or explicitly marked unread)
                or_(
                    ArticleContent.published_at > FeedSubscription.last_read_cutoff,
                    FeedSubscription.last_read_cutoff.is_(None),
                ),
                or_(
                    UserArticleState.is_read.is_(None),
                    UserArticleState.is_read.is_(False),
                ),
            )
        )
    )
    return result.scalar_one_or_none() or 0


async def count_unread_articles_by_folder(db: AsyncSession, *, user_id: UUID, folder_id: UUID) -> int:
    """Count unread articles in a specific folder for a user."""
    result = await db.execute(
        select(func.count(FeedArticle.id))
        .join(ArticleContent, FeedArticle.content_id == ArticleContent.id)
        .join(FeedSubscription, FeedSubscription.feed_id == FeedArticle.feed_id)
        .outerjoin(
            UserArticleState,
            and_(
                UserArticleState.article_id == FeedArticle.id,
                UserArticleState.user_id == user_id,
            ),
        )
        .filter(
            and_(
                FeedSubscription.user_id == user_id,
                FeedSubscription.folder_id == folder_id,
                # Hybrid unread logic:
                # 1. Article must be newer than cutoff (or cutoff is NULL)
                # 2. AND no explicit read state (or explicitly marked unread)
                or_(
                    ArticleContent.published_at > FeedSubscription.last_read_cutoff,
                    FeedSubscription.last_read_cutoff.is_(None),
                ),
                or_(
                    UserArticleState.is_read.is_(None),
                    UserArticleState.is_read.is_(False),
                ),
            )
        )
    )
    return result.scalar_one_or_none() or 0
