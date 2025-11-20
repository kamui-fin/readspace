"""Specialized article queries for specific use cases."""

import time
from datetime import datetime, timedelta, timezone
from uuid import UUID

import structlog
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

logger = structlog.get_logger(__name__)


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

    @staticmethod
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

    @staticmethod
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

    @staticmethod
    async def get_all_unread_counts(db: AsyncSession, *, user_id: UUID) -> dict[str, int | dict[UUID, int]]:
        """
        Get all unread counts in a single optimized query.

        Returns a dict with:
        - total_unread: int - count of unread articles (feed + clipped)
        - unread_by_folder: dict[UUID, int] - unread counts per folder
        - read_later_count: int - ALL articles with is_read_later=TRUE (regardless of read status)
        - today_count: int - unread articles from last 24 hours
        """
        from sqlalchemy import text

        now_utc = datetime.now(timezone.utc)
        twenty_four_hours_ago = now_utc - timedelta(hours=24)

        # Optimized query using direct COUNT() aggregations
        # Always returns at least one row with all aggregate counts
        query = text("""
            WITH folder_unreads AS (
                SELECT
                    fs.folder_id,
                    COUNT(*) as unread_count,
                    COUNT(*) FILTER (
                        WHERE ac.published_at >= :twenty_four_hours_ago
                          AND ac.published_at <= :now_utc
                    ) as today_count
                FROM feed_articles fa
                INNER JOIN feed_subscriptions fs ON fa.feed_id = fs.feed_id
                INNER JOIN article_contents ac ON fa.content_id = ac.id
                LEFT JOIN user_article_states uas
                    ON uas.article_id = fa.id AND uas.user_id = :user_id
                WHERE fs.user_id = :user_id
                  AND (uas.is_read IS NULL OR uas.is_read = FALSE)
                  AND (ac.published_at > fs.last_read_cutoff OR fs.last_read_cutoff IS NULL)
                GROUP BY fs.folder_id
            ),
            global_counts AS (
                SELECT
                    -- Clipped article counts
                    COUNT(*) FILTER (
                        WHERE ca.is_read IS NULL OR ca.is_read = FALSE
                    ) as clipped_unread_count,
                    COUNT(*) FILTER (
                        WHERE (ca.is_read IS NULL OR ca.is_read = FALSE)
                          AND ac.published_at >= :twenty_four_hours_ago
                          AND ac.published_at <= :now_utc
                    ) as clipped_today_count,
                    -- Read later count from all sources
                    (
                        SELECT COUNT(*) FROM (
                            SELECT fa.id
                            FROM feed_articles fa
                            INNER JOIN feed_subscriptions fs ON fa.feed_id = fs.feed_id
                            INNER JOIN user_article_states uas
                                ON uas.article_id = fa.id AND uas.user_id = :user_id
                            WHERE fs.user_id = :user_id AND uas.is_read_later = TRUE

                            UNION ALL

                            SELECT ca.id
                            FROM clipped_articles ca
                            WHERE ca.user_id = :user_id AND ca.is_read_later = TRUE
                        ) all_read_later
                    ) as read_later_count
                FROM clipped_articles ca
                INNER JOIN article_contents ac ON ca.content_id = ac.id
                WHERE ca.user_id = :user_id
            )
            -- Always return at least one row by using CROSS JOIN with global counts
            -- If no folders exist, folder_unreads will be empty and we'll get one row with NULLs
            SELECT
                COALESCE(fu.folder_id, NULL) as folder_id,
                COALESCE(fu.unread_count, 0) as unread_count,
                COALESCE(fu.today_count, 0) as today_count,
                gc.read_later_count,
                gc.clipped_unread_count,
                gc.clipped_today_count
            FROM global_counts gc
            LEFT JOIN folder_unreads fu ON TRUE

            -- Ensure we always return at least one row even with no data
            UNION ALL

            SELECT
                NULL as folder_id,
                0 as unread_count,
                0 as today_count,
                gc.read_later_count,
                gc.clipped_unread_count,
                gc.clipped_today_count
            FROM global_counts gc
            WHERE NOT EXISTS (SELECT 1 FROM folder_unreads)
        """)

        # Track query execution time for performance monitoring
        start_time = time.perf_counter()

        result = await db.execute(
            query,
            {
                "user_id": user_id,
                "twenty_four_hours_ago": twenty_four_hours_ago,
                "now_utc": now_utc,
            },
        )

        rows = result.fetchall()

        execution_time_ms = (time.perf_counter() - start_time) * 1000
        row_count = len(rows)

        logger.debug(
            "Executed get_all_unread_counts query",
            user_id=str(user_id),
            execution_time_ms=round(execution_time_ms, 2),
            row_count=row_count,
        )

        # Aggregate results - query always returns at least one row
        total_unread = 0
        unread_by_folder: dict[UUID, int] = {}
        read_later_count = 0
        today_count = 0

        # Global counts are the same across all rows, so grab from first row
        if rows:
            first_row = rows[0]
            read_later_count = first_row.read_later_count or 0
            clipped_unread = first_row.clipped_unread_count or 0
            clipped_today = first_row.clipped_today_count or 0

            # Aggregate folder-specific counts
            for row in rows:
                if row.folder_id is not None:
                    folder_unread = row.unread_count or 0
                    unread_by_folder[row.folder_id] = folder_unread
                    total_unread += folder_unread
                    today_count += row.today_count or 0

            # Add clipped articles to totals
            total_unread += clipped_unread
            today_count += clipped_today

        logger.debug(
            "Aggregated unread counts",
            user_id=str(user_id),
            total_unread=total_unread,
            folder_count=len(unread_by_folder),
            read_later_count=read_later_count,
            today_count=today_count,
        )

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
            INNER JOIN article_contents ac
                ON fa.content_id = ac.id
            LEFT JOIN user_article_states uas
                ON uas.article_id = fa.id
                AND uas.user_id = :user_id
            WHERE fs.user_id = :user_id
              AND (uas.is_read IS NULL OR uas.is_read = FALSE)
              AND (ac.published_at > fs.last_read_cutoff OR fs.last_read_cutoff IS NULL)
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
