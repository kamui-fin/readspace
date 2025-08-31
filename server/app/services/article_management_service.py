"""Service for article management operations."""

from datetime import datetime
from uuid import UUID

import structlog
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud.crud_article import (
    count_read_later_articles,
    count_today_articles,
    count_unread_articles,
    count_unread_articles_by_folder,
    get_article,
    get_articles_by_user,
    get_recently_read_articles,
    get_unread_counts_by_folder,
)
from app.crud.crud_article import (
    update_article as crud_update_article,
)
from app.crud.crud_unified_articles import crud_unified_articles
from app.crud.transformers.article_transformer import ArticleTransformer
from app.schemas.rss_schemas import (
    ArticleResponse,
    ArticleUpdate,
    PaginatedResponse,
)

logger = structlog.get_logger(__name__)


class ArticleManagementService:
    """Service for managing articles."""

    def __init__(self, db: AsyncSession, user_id: UUID):
        self.db = db
        self.user_id = user_id
        self.transformer = ArticleTransformer()

    async def get_articles(
        self,
        feed_ids: list[UUID] | None = None,
        folder_id: UUID | None = None,
        is_read: bool | None = None,
        is_read_later: bool | None = None,
        is_favorite: bool | None = None,
        feed_is_favorite: bool | None = None,
        published_since: datetime | None = None,
        published_until: datetime | None = None,
        user_timezone: str | None = None,
        search_query: str | None = None,
        sort_by: str = "published_at",
        sort_order: str = "desc",
        page: int = 1,
        size: int = 50,
    ) -> PaginatedResponse[ArticleResponse]:
        """Get articles with filtering and pagination."""

        skip = (page - 1) * size

        articles_db, total_count = await get_articles_by_user(
            db=self.db,
            user_id=self.user_id,
            feed_ids=feed_ids,
            folder_id=folder_id,
            is_read=is_read,
            is_read_later=is_read_later,
            is_favorite=is_favorite,
            feed_is_favorite=feed_is_favorite,
            published_since=published_since,
            published_until=published_until,
            search_query=search_query,
            sort_by=sort_by,
            sort_order=sort_order,
            skip=skip,
            limit=size,
        )

        articles = [
            self.transformer.feed_to_unified(article) for article in articles_db
        ]

        pages = (total_count + size - 1) // size if size > 0 else 0

        return PaginatedResponse(
            items=articles,
            total=total_count,
            page=page,
            size=size,
            pages=pages,
        )

    async def get_article(self, article_id: UUID) -> ArticleResponse | None:
        """Get a single article by its ID."""
        logger.info("Getting article", article_id=article_id, user_id=self.user_id)

        article = await get_article(
            db=self.db,
            article_id=article_id,
            user_id=self.user_id,
        )

        if article:
            # Handle both FeedArticle tuples and ClippedArticle types
            from app.models.rss_models import ClippedArticle, FeedArticle

            if isinstance(article, ClippedArticle):
                return self.transformer.clipped_to_unified(article)
            elif isinstance(article, tuple):
                # This is a (FeedArticle, UserArticleState) tuple
                return self.transformer.feed_to_unified(article)
            elif isinstance(article, FeedArticle):
                # Legacy single FeedArticle (shouldn't happen with new schema but kept for safety)
                return self.transformer.feed_to_unified(article)
        return None

    async def get_unread_articles(
        self,
        folder_id: UUID | None = None,
        feed_id: UUID | None = None,
        tag_names: list[str] | None = None,
        search_query: str | None = None,
        skip: int = 0,
        limit: int = 50,
    ) -> PaginatedResponse[ArticleResponse]:
        """Get unread articles with filtering."""
        articles_db, total_count = await get_articles_by_user(
            db=self.db,
            user_id=self.user_id,
            folder_id=folder_id,
            feed_ids=[feed_id] if feed_id else None,
            is_read=False,
            search_query=search_query,
            skip=skip,
            limit=limit,
        )

        articles = [
            self.transformer.feed_to_unified(article) for article in articles_db
        ]

        page = skip // limit + 1
        pages = (total_count + limit - 1) // limit if limit > 0 else 0

        return PaginatedResponse(
            items=articles,
            total=total_count,
            page=page,
            size=limit,
            pages=pages,
        )

    async def get_read_later_articles(
        self,
        skip: int = 0,
        limit: int = 50,
    ) -> PaginatedResponse[ArticleResponse]:
        """Get articles marked as read later (includes both RSS feed and clipped articles)."""
        (
            articles,
            total_count,
        ) = await crud_unified_articles.get_unified_articles_by_user(
            db=self.db,
            user_id=self.user_id,
            is_read_later=True,
            skip=skip,
            limit=limit,
            sort_by="published_at",
            sort_order="desc",
            include_feed_articles=True,
            include_clipped_articles=True,
        )

        page = skip // limit + 1
        pages = (total_count + limit - 1) // limit if limit > 0 else 0

        return PaginatedResponse(
            items=articles,
            total=total_count,
            page=page,
            size=limit,
            pages=pages,
        )

    async def get_recently_read_articles(
        self,
        skip: int = 0,
        limit: int = 50,
    ) -> PaginatedResponse[ArticleResponse]:
        """Get recently read articles."""
        articles_db, total_count = await get_recently_read_articles(
            db=self.db,
            user_id=self.user_id,
            skip=skip,
            limit=limit,
        )

        articles = [
            self.transformer.feed_to_unified(article) for article in articles_db
        ]

        page = skip // limit + 1
        pages = (total_count + limit - 1) // limit if limit > 0 else 0

        return PaginatedResponse(
            items=articles,
            total=total_count,
            page=page,
            size=limit,
            pages=pages,
        )

    async def update_article(
        self, article_id: UUID, article_in: ArticleUpdate, article_type: str = "feed"
    ) -> ArticleResponse | None:
        """Update an article (mark as read/unread, favorite, etc.)."""
        logger.info("Updating article", article_id=article_id, user_id=self.user_id, article_type=article_type)

        updated_article = await crud_update_article(
            db=self.db,
            article_id=article_id,
            article_in=article_in,
            user_id=self.user_id,
            article_type=article_type,
        )

        if updated_article:
            return self.transformer.to_unified(updated_article)
        return None

    async def get_unread_counts_by_folder(self) -> dict[str, int]:
        """Get unread article counts grouped by folder."""
        return await get_unread_counts_by_folder(db=self.db, user_id=self.user_id)

    async def count_unread_articles_by_folder(self, folder_id: UUID) -> int:
        """Count unread articles for a user in a specific folder."""
        return await count_unread_articles_by_folder(
            db=self.db, user_id=self.user_id, folder_id=folder_id
        )

    async def get_total_unread_count(self) -> int:
        """Get total count of unread articles for the user."""
        return await count_unread_articles(db=self.db, user_id=self.user_id)

    async def get_read_later_count(self) -> int:
        """Get total count of read later articles for the user."""
        return await count_read_later_articles(db=self.db, user_id=self.user_id)

    async def get_today_count(self) -> int:
        """Get total count of articles published today for the user."""
        return await count_today_articles(db=self.db, user_id=self.user_id)
