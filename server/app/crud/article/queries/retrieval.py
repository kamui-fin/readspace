"""Article retrieval queries for getting specific articles or filtered lists."""

from datetime import datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.crud.article.builders import FeedArticleQueryBuilder
from app.models import (
    ClippedArticle,
    FeedArticle,
    FeedSubscription,
    UserArticleState,
)


async def get_article_by_id(
    db: AsyncSession,
    *,
    article_id: UUID,
    user_id: UUID,
    allow_preview: bool = False,
    load_full_content: bool = True,
) -> tuple[FeedArticle, UserArticleState] | ClippedArticle | None:
    """Get a specific article by its ID, ensuring it belongs to the user.

    Args:
        db: Database session
        article_id: Article UUID
        user_id: User UUID
        allow_preview: Allow access to unsubscribed feeds
        load_full_content: Load full description and content (default True for detail views)
    """
    # Build eager loading options
    content_options = [selectinload(FeedArticle.content)]
    if load_full_content:
        content_options.append(selectinload(FeedArticle.content).undefer_group("content_details"))

    # First try to get from feed_articles (RSS articles) with user state
    if allow_preview:
        # In preview mode, don't require subscription - just get the article
        result = await db.execute(
            select(FeedArticle, UserArticleState)
            .options(selectinload(FeedArticle.feed), *content_options)
            .outerjoin(
                UserArticleState,
                (UserArticleState.article_id == FeedArticle.id) & (UserArticleState.user_id == user_id),
            )
            .filter(FeedArticle.id == article_id)
        )
    else:
        # Normal mode - require subscription to access the feed
        result = await db.execute(
            select(FeedArticle, UserArticleState)
            .options(selectinload(FeedArticle.feed), *content_options)
            .join(FeedSubscription, FeedSubscription.feed_id == FeedArticle.feed_id)
            .outerjoin(
                UserArticleState,
                (UserArticleState.article_id == FeedArticle.id) & (UserArticleState.user_id == user_id),
            )
            .filter(FeedArticle.id == article_id, FeedSubscription.user_id == user_id)
        )

    row = result.first()
    if row:
        return (row[0], row[1])  # (FeedArticle, UserArticleState)

    # If not found, try clipped_articles (manually saved articles)
    # Clipped articles always require user ownership
    clipped_options = [selectinload(ClippedArticle.content)]
    if load_full_content:
        clipped_options.append(selectinload(ClippedArticle.content).undefer_group("content_details"))

    result = await db.execute(
        select(ClippedArticle)
        .options(*clipped_options)
        .filter(ClippedArticle.id == article_id, ClippedArticle.user_id == user_id)
    )
    return result.scalars().first()


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
    search_query: str | None = None,
    sort_by: str = "published_at",
    sort_order: str = "desc",
    skip: int = 0,
    limit: int = 100,
    allow_preview: bool = False,
    load_full_content: bool = False,
) -> list[tuple[FeedArticle, UserArticleState]]:
    """Get articles for a user with comprehensive filtering and sorting.

    Args:
        load_full_content: If True, loads full description and content fields.
                          Default False for list views to reduce bandwidth.
    """
    query_builder = FeedArticleQueryBuilder(user_id, allow_preview=allow_preview, load_full_content=load_full_content)

    stmt = query_builder.build_filtered_query(
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
    )

    articles_result = await db.execute(stmt)
    rows = articles_result.all()  # Get all rows
    # Extract the FeedArticle and UserArticleState objects from each row
    articles = [(row[0], row[1]) for row in rows]  # row[0] is FeedArticle, row[1] is UserArticleState
    return articles


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
    search_query: str | None = None,
    allow_preview: bool = False,
) -> int:
    """Count articles for a user with comprehensive filtering (for pagination total_count)."""
    query_builder = FeedArticleQueryBuilder(user_id, allow_preview=allow_preview)

    stmt = query_builder.build_count_query(
        feed_ids=feed_ids,
        folder_id=folder_id,
        is_read=is_read,
        is_read_later=is_read_later,
        is_favorite=is_favorite,
        feed_is_favorite=feed_is_favorite,
        published_since=published_since,
        published_until=published_until,
        search_query=search_query,
    )

    result = await db.execute(stmt)
    return result.scalar_one() or 0
