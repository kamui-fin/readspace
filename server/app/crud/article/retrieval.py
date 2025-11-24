"""Simplified article retrieval queries using new schema."""

from datetime import datetime
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.crud.article.feed_query_builder import FeedArticleQueryBuilder
from app.models import FeedArticle, UserEntry


async def get_articles_filtered(
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
    sort_by: str = "published_at",
    sort_order: str = "desc",
    skip: int = 0,
    limit: int = 100,
    allow_preview: bool = False,
    load_full_content: bool = False,
) -> list[tuple[FeedArticle, UserEntry | None]]:
    """
    Get filtered articles with user state.

    Uses optimized query that sorts by FeedArticle.published_at directly
    without joining article_contents table.
    """
    builder = FeedArticleQueryBuilder(
        user_id=user_id,
        allow_preview=allow_preview,
        load_full_content=load_full_content,
    )

    stmt = builder.build_filtered_query(
        feed_ids=feed_ids,
        folder_id=folder_id,
        is_read=is_read,
        is_read_later=is_read_later,
        is_favorite=is_favorite,
        feed_is_favorite=feed_is_favorite,
        published_since=published_since,
        published_until=published_until,
        sort_by=sort_by,
        sort_order=sort_order,
        skip=skip,
        limit=limit,
    )

    result = await db.execute(stmt)
    return list(result.all())


async def count_articles_filtered(
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
    allow_preview: bool = False,
) -> int:
    """Count filtered articles."""
    builder = FeedArticleQueryBuilder(user_id=user_id, allow_preview=allow_preview)

    stmt = builder.build_count_query(
        feed_ids=feed_ids,
        folder_id=folder_id,
        is_read=is_read,
        is_read_later=is_read_later,
        is_favorite=is_favorite,
        feed_is_favorite=feed_is_favorite,
        published_since=published_since,
        published_until=published_until,
    )

    result = await db.execute(stmt)
    return result.scalar() or 0


async def get_article_by_id(
    db: AsyncSession,
    *,
    article_id: UUID,
    user_id: UUID,
    allow_preview: bool = False,
    load_full_content: bool = True,
) -> tuple[FeedArticle, UserEntry | None] | None:
    """Get single article by ID with user state."""
    builder = FeedArticleQueryBuilder(
        user_id=user_id,
        allow_preview=allow_preview,
        load_full_content=load_full_content,
    )

    stmt = builder.build_base_query().filter(FeedArticle.id == article_id)

    result = await db.execute(stmt)
    return result.first()
