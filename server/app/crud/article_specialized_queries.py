"""Specialized article queries for specific use cases."""

from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import and_, desc, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.rss_models import (
    ArticleContent,
    ClippedArticle,
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
    ) -> list[tuple[FeedArticle, UserArticleState]]:
        """Get recently read articles for a user.

        Returns tuples of (FeedArticle, UserArticleState) to provide both the article
        and its user-specific state (including read_at timestamp).
        """
        since_date = datetime.now(timezone.utc) - timedelta(days=days_back)

        # Build the query for recently read articles
        # Use contains_eager to efficiently load the joined UserArticleState
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
                selectinload(FeedArticle.feed).selectinload(Feed.subscriptions),
                selectinload(FeedArticle.content),
            )
            .offset(skip)
            .limit(limit)
        )

        articles_result = await db.execute(stmt)
        # Return tuples of (FeedArticle, UserArticleState)
        articles = list(articles_result.all())

        return articles

    @staticmethod
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

    @staticmethod
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
                    # Count as unread if no state record OR explicitly marked unread
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

    @staticmethod
    async def get_read_later_articles(
        db: AsyncSession,
        *,
        user_id: UUID,
        skip: int = 0,
        limit: int = 50,
    ) -> list[FeedArticle]:
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
                    UserArticleState.is_read_later.is_(True),
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
        articles = list(articles_result.scalars().all())

        return articles

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
                        UserArticleState.is_read.is_(False),
                    ),
                )
            )
        )
        return result.scalar_one_or_none() or 0

    @staticmethod
    async def get_all_unread_counts(db: AsyncSession, *, user_id: UUID) -> dict[str, int | dict[UUID, int]]:
        """
        Get all unread counts in a single optimized query using CTE.

        This version uses a materialized CTE for better query planning
        and combines multiple aggregations in a single pass.
        Now includes clipped articles in the same query using UNION ALL.

        Returns a dict with:
        - total_unread: int
        - unread_by_folder: dict[UUID, int]
        - read_later_count: int
        - today_count: int
        """
        from sqlalchemy import text

        now_utc = datetime.now(timezone.utc)
        twenty_four_hours_ago = now_utc - timedelta(hours=24)

        # Use raw SQL with CTE for optimal performance
        # OPTIMIZATION: Combine feed articles and clipped articles in single query using UNION ALL
        query = text("""
            WITH unread_articles AS MATERIALIZED (
                -- Feed articles
                SELECT 
                    fs.folder_id,
                    fa.id as article_id,
                    COALESCE(uas.is_read_later, FALSE) as is_read_later,
                    ac.published_at
                FROM feed_articles fa
                INNER JOIN feed_subscriptions fs 
                    ON fa.feed_id = fs.feed_id
                INNER JOIN article_contents ac 
                    ON fa.content_id = ac.id
                LEFT JOIN user_article_states uas 
                    ON uas.article_id = fa.id 
                    AND uas.user_id = :user_id
                WHERE fs.user_id = :user_id
                  AND (uas.is_read IS NULL OR uas.is_read = FALSE)
                
                UNION ALL
                
                -- Clipped articles (unread only)
                SELECT 
                    NULL as folder_id,
                    ca.id as article_id,
                    COALESCE(ca.is_read_later, FALSE) as is_read_later,
                    ac.published_at
                FROM clipped_articles ca
                INNER JOIN article_contents ac 
                    ON ca.content_id = ac.id
                WHERE ca.user_id = :user_id
                  AND (ca.is_read IS NULL OR ca.is_read = FALSE)
            )
            SELECT 
                folder_id,
                COUNT(*) as unread_count,
                SUM(CASE WHEN is_read_later = TRUE THEN 1 ELSE 0 END) as read_later_count,
                SUM(CASE 
                    WHEN published_at >= :twenty_four_hours_ago 
                         AND published_at <= :now_utc 
                    THEN 1 
                    ELSE 0 
                END) as today_count
            FROM unread_articles
            GROUP BY folder_id
        """)

        result = await db.execute(
            query,
            {
                "user_id": user_id,
                "twenty_four_hours_ago": twenty_four_hours_ago,
                "now_utc": now_utc,
            },
        )

        rows = result.fetchall()

        # Aggregate results
        total_unread = 0
        unread_by_folder: dict[UUID, int] = {}
        read_later_count = 0
        today_count = 0

        for row in rows:
            folder_unread = row.unread_count or 0
            total_unread += folder_unread

            # Only add to folder dict if folder_id is not None (feed articles)
            if row.folder_id is not None:
                unread_by_folder[row.folder_id] = folder_unread

            read_later_count += row.read_later_count or 0
            today_count += row.today_count or 0

        return {
            "total_unread": total_unread,
            "unread_by_folder": unread_by_folder,
            "read_later_count": read_later_count,
            "today_count": today_count,
        }

    @staticmethod
    async def get_unread_counts_by_folder(db: AsyncSession, *, user_id: UUID) -> dict[UUID, int]:
        """Get unread article counts grouped by folder ID using optimized query."""
        from sqlalchemy import text

        query = text("""
            SELECT 
                fs.folder_id,
                COUNT(fa.id) as unread_count
            FROM feed_articles fa
            INNER JOIN feed_subscriptions fs 
                ON fa.feed_id = fs.feed_id
            LEFT JOIN user_article_states uas 
                ON uas.article_id = fa.id 
                AND uas.user_id = :user_id
            WHERE fs.user_id = :user_id
              AND (uas.is_read IS NULL OR uas.is_read = FALSE)
            GROUP BY fs.folder_id
        """)

        result = await db.execute(query, {"user_id": user_id})
        rows = result.fetchall()

        return {row.folder_id: row.unread_count for row in rows}

    @staticmethod
    async def count_unread_articles_by_folder(db: AsyncSession, *, user_id: UUID, folder_id: UUID) -> int:
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
                        UserArticleState.is_read.is_(False),
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
    ) -> list[FeedArticle]:
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
        articles = list(articles_result.scalars().all())

        return articles
