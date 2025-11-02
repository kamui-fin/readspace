"""Refactored article CRUD operations."""

from datetime import datetime
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.crud.article.article_crud_operations import ArticleCrudOperations
from app.crud.article.article_specialized_queries import ArticleSpecializedQueries
from app.crud.base import CRUDBase
from app.models import (
    ClippedArticle,
    FeedArticle,
    UserArticleState,
)
from app.schemas import (
    ArticleCreate,
    ArticleUpdate,
    ClippedArticleCreate,
    ClippedArticleUpdate,
    FeedArticleCreate,
    FeedArticleUpdate,
)


# Main article operations - delegate to the operations class
async def get_article(
    db: AsyncSession, *, article_id: UUID, user_id: UUID, allow_preview: bool = False
) -> tuple[FeedArticle, UserArticleState] | ClippedArticle | None:
    """Get a specific article by its ID, ensuring it belongs to the user."""
    return await ArticleCrudOperations.get_article_by_id(
        db, article_id=article_id, user_id=user_id, allow_preview=allow_preview
    )


async def get_article_by_guid(db: AsyncSession, *, feed_id: UUID, guid: str) -> FeedArticle | None:
    """Get a specific article by its GUID for a given feed_id to check for existence."""
    return await ArticleCrudOperations.get_article_by_guid(db, feed_id=feed_id, guid=guid)


async def count_articles_by_user(
    db: AsyncSession,
    *,
    user_id: UUID,
    feed_ids: list[UUID] | None = None,
    folder_id: UUID | None = None,
    is_read: bool | None = None,
    is_read_later: bool | None = None,
    is_favorite: bool | None = None,
    feed_is_favorite: bool | None = None,
    published_since: datetime | None = None,
    published_until: datetime | None = None,
    search_query: str | None = None,
    allow_preview: bool = False,
) -> int:
    """Count articles for a user with comprehensive filtering (for pagination total_count)."""
    return await ArticleCrudOperations.count_articles_filtered(
        db,
        user_id=user_id,
        feed_ids=feed_ids,
        folder_id=folder_id,
        is_read=is_read,
        is_read_later=is_read_later,
        is_favorite=is_favorite,
        feed_is_favorite=feed_is_favorite,
        published_since=published_since,
        published_until=published_until,
        search_query=search_query,
        allow_preview=allow_preview,
    )


async def get_articles_by_user(
    db: AsyncSession,
    *,
    user_id: UUID,
    feed_ids: list[UUID] | None = None,
    folder_id: UUID | None = None,
    is_read: bool | None = None,
    is_read_later: bool | None = None,
    is_favorite: bool | None = None,
    feed_is_favorite: bool | None = None,
    published_since: datetime | None = None,
    published_until: datetime | None = None,
    search_query: str | None = None,
    sort_by: str = "published_at",
    sort_order: str = "desc",
    skip: int = 0,
    limit: int = 100,
    allow_preview: bool = False,
) -> list[tuple[FeedArticle, UserArticleState]]:
    """Get articles for a user with comprehensive filtering and sorting."""
    return await ArticleCrudOperations.get_articles_filtered(
        db,
        user_id=user_id,
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
        limit=limit,
        allow_preview=allow_preview,
    )


async def create_articles_batch(
    db: AsyncSession, *, articles_data: list[ArticleCreate], user_id: UUID
) -> list[FeedArticle]:
    """Create multiple articles in batch."""
    return await ArticleCrudOperations.create_articles_batch(db, articles_data=articles_data, user_id=user_id)


async def update_article(
    db: AsyncSession,
    *,
    article_id: UUID,
    article_in: ArticleUpdate,
    user_id: UUID,
    article_type: str = "feed",
) -> FeedArticle | None:
    """Update article status."""
    return await ArticleCrudOperations.update_article_status(
        db,
        article_id=article_id,
        article_in=article_in,
        user_id=user_id,
        article_type=article_type,
    )


# Specialized queries - delegate to specialized queries class
async def get_recently_read_articles(
    db: AsyncSession,
    *,
    user_id: UUID,
    skip: int = 0,
    limit: int = 50,
    days_back: int = 30,
) -> list[tuple[FeedArticle, UserArticleState]]:
    """Get recently read articles."""
    return await ArticleSpecializedQueries.get_recently_read_articles(
        db, user_id=user_id, skip=skip, limit=limit, days_back=days_back
    )


async def get_read_later_articles(
    db: AsyncSession, *, user_id: UUID, skip: int = 0, limit: int = 50
) -> list[FeedArticle]:
    """Get read later articles."""
    return await ArticleSpecializedQueries.get_read_later_articles(db, user_id=user_id, skip=skip, limit=limit)


async def count_unread_articles(db: AsyncSession, *, user_id: UUID) -> int:
    """Count unread articles."""
    return await ArticleSpecializedQueries.count_unread_articles(db, user_id=user_id)


async def get_unread_counts_by_folder(db: AsyncSession, *, user_id: UUID) -> dict[UUID, int]:
    """Get unread counts by folder."""
    return await ArticleSpecializedQueries.get_unread_counts_by_folder(db, user_id=user_id)


async def count_unread_articles_by_folder(db: AsyncSession, *, user_id: UUID, folder_id: UUID) -> int:
    """Count unread articles in a specific folder."""
    return await ArticleSpecializedQueries.count_unread_articles_by_folder(db, user_id=user_id, folder_id=folder_id)


async def count_read_later_articles(db: AsyncSession, *, user_id: UUID) -> int:
    """Count articles marked as read later."""
    return await ArticleSpecializedQueries.count_read_later_articles(db, user_id=user_id)


async def count_today_articles(db: AsyncSession, *, user_id: UUID) -> int:
    """Count articles published today."""
    return await ArticleSpecializedQueries.count_today_articles(db, user_id=user_id)


async def get_all_unread_counts(db: AsyncSession, *, user_id: UUID) -> dict[str, int | dict[UUID, int]]:
    """Get all unread counts in a single optimized query."""
    return await ArticleSpecializedQueries.get_all_unread_counts(db, user_id=user_id)


# CRUD classes for different article types
class CRUDFeedArticle(CRUDBase[FeedArticle, FeedArticleCreate, FeedArticleUpdate]):
    """CRUD operations for feed articles."""

    async def get_by_feed_and_guid(self, db: AsyncSession, *, feed_id: UUID, guid: str) -> FeedArticle | None:
        """Get feed article by feed ID and GUID."""
        # Implementation would go here - simplified for now
        pass

    async def get_with_content(self, db: AsyncSession, *, article_id: UUID) -> FeedArticle | None:
        """Get feed article with content loaded."""
        # Implementation would go here - simplified for now
        pass


class CRUDClippedArticle(CRUDBase[ClippedArticle, ClippedArticleCreate, ClippedArticleUpdate]):
    """CRUD operations for clipped articles."""

    async def get_with_content(self, db: AsyncSession, *, article_id: UUID) -> ClippedArticle | None:
        """Get clipped article with content loaded."""
        # Implementation would go here - simplified for now
        pass


# CRUD class instances (not actively used - prefer module-level functions)
crud_feed_article = CRUDFeedArticle(FeedArticle)
