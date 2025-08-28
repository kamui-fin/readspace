"""Specialized article queries for specific use cases."""

from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import and_, desc, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.rss_models import (
    ArticleContent,
    Feed,
    FeedArticle,
    FeedSubscription,
    UserArticleState,
)


class ArticleSpecializedQueries:
    """Specialized queries for specific article use cases using new architecture."""

    @staticmethod
    async def get_recently_read_articles(
        db: AsyncSession,
        *,
        user_id: UUID,
        skip: int = 0,
        limit: int = 50,
        days_back: int = 30,
    ) -> tuple[list[FeedArticle], int]:
        """Get recently read articles for a user."""
        since_date = datetime.now(timezone.utc) - timedelta(days=days_back)

        # Build the query for recently read articles
        stmt = (
            select(FeedArticle)
            .join(ArticleContent, FeedArticle.content_id == ArticleContent.id)
            .join(FeedSubscription, FeedSubscription.feed_id == FeedArticle.feed_id)
            .join(UserArticleState, UserArticleState.article_id == FeedArticle.id)
            .filter(
                and_(
                    FeedSubscription.user_id == user_id,
                    UserArticleState.user_id == user_id,
                    UserArticleState.is_read == True,
                    UserArticleState.read_at >= since_date,
                )
            )
            .order_by(desc(UserArticleState.read_at))
            .options(
                selectinload(FeedArticle.feed).selectinload(Feed.subscriptions),
                selectinload(FeedArticle.content),
                selectinload(FeedArticle.user_states),
            )
            .offset(skip)
            .limit(limit)
        )

        articles_result = await db.execute(stmt)
        articles = articles_result.scalars().all()

        # Count query
        count_stmt = (
            select(func.count(FeedArticle.id))
            .join(FeedSubscription, FeedSubscription.feed_id == FeedArticle.feed_id)
            .join(UserArticleState, UserArticleState.article_id == FeedArticle.id)
            .filter(
                and_(
                    FeedSubscription.user_id == user_id,
                    UserArticleState.user_id == user_id,
                    UserArticleState.is_read == True,
                    UserArticleState.read_at >= since_date,
                )
            )
        )

        count_result = await db.execute(count_stmt)
        total_count = count_result.scalar_one_or_none() or 0

        return articles, total_count

    @staticmethod
    async def count_read_later_articles(db: AsyncSession, *, user_id: UUID) -> int:
        """Count articles marked as read later for a user."""
        result = await db.execute(
            select(func.count(FeedArticle.id))
            .join(FeedSubscription, FeedSubscription.feed_id == FeedArticle.feed_id)
            .join(UserArticleState, UserArticleState.article_id == FeedArticle.id)
            .filter(
                and_(
                    FeedSubscription.user_id == user_id,
                    UserArticleState.user_id == user_id,
                    UserArticleState.is_read_later == True,
                )
            )
        )
        return result.scalar_one_or_none() or 0

    @staticmethod
    async def count_today_articles(db: AsyncSession, *, user_id: UUID) -> int:
        """Count unread articles published today for a user."""
        today_start = datetime.now(timezone.utc).replace(
            hour=0, minute=0, second=0, microsecond=0
        )
        today_end = today_start + timedelta(days=1)

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
                    # Count as unread if no state record OR explicitly marked unread
                    or_(
                        UserArticleState.is_read.is_(None),
                        UserArticleState.is_read == False,
                    ),
                    ArticleContent.published_at >= today_start,
                    ArticleContent.published_at < today_end,
                )
            )
        )
        return result.scalar_one_or_none() or 0

    @staticmethod
    async def get_read_later_articles(
        db: AsyncSession,
        *,
        user_id: UUID,
        skip: int = 0,
        limit: int = 50,
    ) -> tuple[list[FeedArticle], int]:
        """Get articles marked as read later for a user."""
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
                    UserArticleState.is_read_later == True,
                )
            )
            .order_by(desc(ArticleContent.published_at))
            .options(
                selectinload(FeedArticle.feed).selectinload(Feed.subscriptions),
                selectinload(FeedArticle.content),
                selectinload(FeedArticle.user_states),
            )
            .offset(skip)
            .limit(limit)
        )

        articles_result = await db.execute(stmt)
        articles = articles_result.scalars().all()

        # Count query
        count_stmt = (
            select(func.count(FeedArticle.id))
            .join(FeedSubscription, FeedSubscription.feed_id == FeedArticle.feed_id)
            .join(UserArticleState, UserArticleState.article_id == FeedArticle.id)
            .filter(
                and_(
                    FeedSubscription.user_id == user_id,
                    UserArticleState.user_id == user_id,
                    UserArticleState.is_read_later == True,
                )
            )
        )

        count_result = await db.execute(count_stmt)
        total_count = count_result.scalar_one_or_none() or 0

        return articles, total_count

    @staticmethod
    async def count_unread_articles(db: AsyncSession, *, user_id: UUID) -> int:
        """Count total unread articles for a user."""
        result = await db.execute(
            select(func.count(FeedArticle.id))
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
                    # Count as unread if no state record OR explicitly marked unread
                    or_(
                        UserArticleState.is_read.is_(None),
                        UserArticleState.is_read == False,
                    ),
                )
            )
        )
        return result.scalar_one_or_none() or 0

    @staticmethod
    async def get_unread_counts_by_folder(
        db: AsyncSession, *, user_id: UUID
    ) -> dict[UUID, int]:
        """Get unread article counts grouped by folder ID."""
        result = await db.execute(
            select(
                FeedSubscription.folder_id,
                func.count(FeedArticle.id).label("unread_count"),
            )
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
                    # Count as unread if no state record OR explicitly marked unread
                    or_(
                        UserArticleState.is_read.is_(None),
                        UserArticleState.is_read == False,
                    ),
                )
            )
            .group_by(FeedSubscription.folder_id)
        )

        rows = result.fetchall()
        return {row.folder_id: row.unread_count for row in rows}

    @staticmethod
    async def count_unread_articles_by_folder(
        db: AsyncSession, *, user_id: UUID, folder_id: UUID
    ) -> int:
        """Count unread articles in a specific folder for a user."""
        result = await db.execute(
            select(func.count(FeedArticle.id))
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
                    # Count as unread if no state record OR explicitly marked unread
                    or_(
                        UserArticleState.is_read.is_(None),
                        UserArticleState.is_read == False,
                    ),
                )
            )
        )
        return result.scalar_one_or_none() or 0

    @staticmethod
    async def get_trending_articles(
        db: AsyncSession,
        *,
        user_id: UUID,
        skip: int = 0,
        limit: int = 50,
        days_back: int = 7,
    ) -> tuple[list[FeedArticle], int]:
        """Get trending articles for a user based on recent engagement."""
        since_date = datetime.now(timezone.utc) - timedelta(days=days_back)

        # For simplicity, we'll order by publish date for now
        # In the future, this could include engagement metrics
        stmt = (
            select(FeedArticle)
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
                    ArticleContent.published_at >= since_date,
                )
            )
            .order_by(desc(ArticleContent.published_at))
            .options(
                selectinload(FeedArticle.feed).selectinload(Feed.subscriptions),
                selectinload(FeedArticle.content),
                selectinload(FeedArticle.user_states),
            )
            .offset(skip)
            .limit(limit)
        )

        articles_result = await db.execute(stmt)
        articles = articles_result.scalars().all()

        # Count query
        count_stmt = (
            select(func.count(FeedArticle.id))
            .join(ArticleContent, FeedArticle.content_id == ArticleContent.id)
            .join(FeedSubscription, FeedSubscription.feed_id == FeedArticle.feed_id)
            .filter(
                and_(
                    FeedSubscription.user_id == user_id,
                    ArticleContent.published_at >= since_date,
                )
            )
        )

        count_result = await db.execute(count_stmt)
        total_count = count_result.scalar_one_or_none() or 0

        return articles, total_count
