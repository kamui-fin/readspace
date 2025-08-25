"""Specialized article queries for specific use cases."""

from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import and_, desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.rss_models import Article, ArticleContent, Feed


class ArticleSpecializedQueries:
    """Specialized queries for specific article use cases."""

    @staticmethod
    async def get_recently_read_articles(
        db: AsyncSession,
        *,
        user_id: UUID,
        skip: int = 0,
        limit: int = 50,
        days_back: int = 30,
    ) -> tuple[list[Article], int]:
        """Get recently read articles for a user."""
        since_date = datetime.now(timezone.utc) - timedelta(days=days_back)

        stmt = (
            select(Article)
            .options(selectinload(Article.feed), selectinload(Article.content))
            .join(ArticleContent, Article.content_id == ArticleContent.id)
            .filter(
                and_(
                    Article.user_id == user_id,
                    Article.is_read == True,
                    Article.read_at >= since_date,
                )
            )
            .order_by(desc(Article.read_at))
            .offset(skip)
            .limit(limit)
        )

        count_stmt = select(func.count(Article.id)).filter(
            and_(
                Article.user_id == user_id,
                Article.is_read == True,
                Article.read_at >= since_date,
            )
        )

        total_count_result = await db.execute(count_stmt)
        total_count = total_count_result.scalar_one_or_none() or 0

        articles_result = await db.execute(stmt)
        articles = articles_result.scalars().all()

        return articles, total_count

    @staticmethod
    async def count_read_later_articles(db: AsyncSession, *, user_id: UUID) -> int:
        """Count unread articles marked as read later for a user."""
        result = await db.execute(
            select(func.count(Article.id)).filter(
                and_(
                    Article.user_id == user_id,
                    Article.is_read_later == True,
                    Article.is_read == False,  # Only count unread articles
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
            select(func.count(Article.id))
            .join(ArticleContent, Article.content_id == ArticleContent.id)
            .filter(
                and_(
                    Article.user_id == user_id,
                    Article.is_read == False,  # Only count unread articles
                    ArticleContent.published_at >= today_start,
                    ArticleContent.published_at < today_end,
                )
            )
        )
        return result.scalar_one_or_none() or 0

    @staticmethod
    async def get_read_later_articles(
        db: AsyncSession, *, user_id: UUID, skip: int = 0, limit: int = 50
    ) -> tuple[list[Article], int]:
        """Get unread articles marked as read later for a user."""
        stmt = (
            select(Article)
            .options(selectinload(Article.feed), selectinload(Article.content))
            .join(ArticleContent, Article.content_id == ArticleContent.id)
            .filter(
                and_(
                    Article.user_id == user_id,
                    Article.is_read_later == True,
                    Article.is_read == False,  # Only show unread articles
                )
            )
            .order_by(desc(ArticleContent.published_at))
            .offset(skip)
            .limit(limit)
        )

        count_stmt = select(func.count(Article.id)).filter(
            and_(
                Article.user_id == user_id,
                Article.is_read_later == True,
                Article.is_read == False,  # Only count unread articles
            )
        )

        total_count_result = await db.execute(count_stmt)
        total_count = total_count_result.scalar_one_or_none() or 0

        articles_result = await db.execute(stmt)
        articles = articles_result.scalars().all()

        return articles, total_count

    @staticmethod
    async def count_read_later_articles(db: AsyncSession, *, user_id: UUID) -> int:
        """Count unread articles marked as read later for a user."""
        result = await db.execute(
            select(func.count(Article.id)).filter(
                and_(
                    Article.user_id == user_id,
                    Article.is_read_later == True,
                    Article.is_read == False,  # Only count unread articles
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
            select(func.count(Article.id))
            .join(ArticleContent, Article.content_id == ArticleContent.id)
            .filter(
                and_(
                    Article.user_id == user_id,
                    Article.is_read == False,  # Only count unread articles
                    ArticleContent.published_at >= today_start,
                    ArticleContent.published_at < today_end,
                )
            )
        )
        return result.scalar_one_or_none() or 0

    @staticmethod
    async def count_unread_articles(db: AsyncSession, *, user_id: UUID) -> int:
        """Count total unread articles for a user."""
        result = await db.execute(
            select(func.count(Article.id)).filter(
                and_(Article.user_id == user_id, Article.is_read == False)
            )
        )
        return result.scalar_one_or_none() or 0

    @staticmethod
    async def get_unread_counts_by_folder(
        db: AsyncSession, *, user_id: UUID
    ) -> dict[UUID, int]:
        """Get unread article counts grouped by folder_id."""
        stmt = (
            select(Feed.folder_id, func.count(Article.id))
            .join(Article.feed)  # Join Article to Feed
            .filter(Article.user_id == user_id, Article.is_read == False)
            .filter(Feed.folder_id.is_not(None))  # Ensure folder_id is not null
            .group_by(Feed.folder_id)
        )

        result = await db.execute(stmt)
        rows = result.all()

        return {folder_id: count for folder_id, count in rows}

    @staticmethod
    async def count_unread_articles_by_folder(
        db: AsyncSession, *, user_id: UUID, folder_id: UUID
    ) -> int:
        """Count unread articles for a user in a specific folder."""
        result = await db.execute(
            select(func.count(Article.id))
            .join(Article.feed)
            .filter(
                and_(
                    Article.user_id == user_id,
                    Article.is_read == False,
                    Feed.folder_id == folder_id,
                )
            )
        )
        return result.scalar_one_or_none() or 0

    @staticmethod
    async def get_trending_articles(
        db: AsyncSession,
        *,
        user_id: UUID,
        days_back: int = 7,
        skip: int = 0,
        limit: int = 50,
    ) -> tuple[list[Article], int]:
        """Get trending articles based on recent publish date and user's feeds."""
        since_date = datetime.now(timezone.utc) - timedelta(days=days_back)

        stmt = (
            select(Article)
            .options(selectinload(Article.feed), selectinload(Article.content))
            .join(ArticleContent, Article.content_id == ArticleContent.id)
            .filter(
                and_(
                    Article.user_id == user_id,
                    ArticleContent.published_at >= since_date,
                )
            )
            .order_by(desc(ArticleContent.published_at))
            .offset(skip)
            .limit(limit)
        )

        count_stmt = (
            select(func.count(Article.id))
            .join(ArticleContent, Article.content_id == ArticleContent.id)
            .filter(
                and_(
                    Article.user_id == user_id,
                    ArticleContent.published_at >= since_date,
                )
            )
        )

        total_count_result = await db.execute(count_stmt)
        total_count = total_count_result.scalar_one_or_none() or 0

        articles_result = await db.execute(stmt)
        articles = articles_result.scalars().all()

        return articles, total_count

    @staticmethod
    async def count_read_later_articles(db: AsyncSession, *, user_id: UUID) -> int:
        """Count unread articles marked as read later for a user."""
        result = await db.execute(
            select(func.count(Article.id)).filter(
                and_(
                    Article.user_id == user_id,
                    Article.is_read_later == True,
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
            select(func.count(Article.id))
            .join(ArticleContent, Article.content_id == ArticleContent.id)
            .filter(
                and_(
                    Article.user_id == user_id,
                    Article.is_read == False,  # Only count unread articles
                    ArticleContent.published_at >= today_start,
                    ArticleContent.published_at < today_end,
                )
            )
        )
        return result.scalar_one_or_none() or 0
