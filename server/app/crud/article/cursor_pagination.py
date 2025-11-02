"""Cursor-based pagination for articles."""

from dataclasses import dataclass
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field
from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import DEFAULT_CURSOR_LIMIT, MAX_CURSOR_LIMIT
from app.models import ArticleContent, Feed, FeedArticle, FeedSubscription, UserArticleState


@dataclass
class CursorPaginationParams:
    """Parameters for cursor-based pagination."""

    limit: int = DEFAULT_CURSOR_LIMIT
    cursor: UUID | None = None

    def __post_init__(self) -> None:
        """Validate and clamp limit to max value."""
        # Clamp limit to maximum
        if self.limit > MAX_CURSOR_LIMIT:
            self.limit = MAX_CURSOR_LIMIT
        # Ensure minimum of 1
        if self.limit < 1:
            self.limit = 1
        # Parse cursor if it's a string
        if isinstance(self.cursor, str):
            self.cursor = UUID(self.cursor)


class CursorPaginationResult(BaseModel):
    """Result of cursor-based pagination."""

    items: list[Any] = Field(description="List of items for current page")
    next_cursor: UUID | None = Field(description="Cursor for next page, None if no more pages")
    has_more: bool = Field(description="Whether there are more pages available")
    total_count: int | None = Field(default=None, description="Total count of items (optional)")

    class Config:
        """Pydantic configuration."""

        from_attributes = True


async def get_articles_cursor_paginated(
    db: AsyncSession,
    user_id: UUID,
    params: CursorPaginationParams,
    feed_ids: list[UUID] | None = None,
    is_read: bool | None = None,
    is_read_later: bool | None = None,
    is_favorite: bool | None = None,
    published_since: Any | None = None,
    published_until: Any | None = None,
) -> CursorPaginationResult:
    """
    Get articles using cursor-based pagination for better performance.

    Cursor pagination avoids the performance issues of OFFSET-based pagination
    by using the article_id as a cursor. This is more efficient for large datasets
    and provides consistent results even when data is being inserted/updated.

    Args:
        db: Database session
        user_id: User ID to filter articles
        params: Pagination parameters (limit and cursor)
        feed_ids: Optional list of feed IDs to filter
        is_read: Optional filter for read status
        is_read_later: Optional filter for read later status
        is_favorite: Optional filter for favorite status
        published_since: Optional filter for articles published after this date
        published_until: Optional filter for articles published before this date

    Returns:
        CursorPaginationResult with items and pagination metadata
    """
    # Build base query for feed articles with subscriptions
    query = (
        select(ArticleContent)
        .join(FeedArticle, FeedArticle.article_id == ArticleContent.id)
        .join(Feed, Feed.id == FeedArticle.feed_id)
        .join(FeedSubscription, and_(FeedSubscription.feed_id == Feed.id, FeedSubscription.user_id == user_id))
        .outerjoin(
            UserArticleState,
            and_(UserArticleState.article_id == ArticleContent.id, UserArticleState.user_id == user_id),
        )
    )

    # Apply feed filter
    if feed_ids:
        query = query.where(Feed.id.in_(feed_ids))

    # Apply status filters
    if is_read is not None:
        if is_read:
            query = query.where(UserArticleState.is_read.is_(True))
        else:
            query = query.where(or_(UserArticleState.is_read.is_(False), UserArticleState.is_read.is_(None)))

    if is_read_later is not None:
        query = query.where(UserArticleState.is_read_later.is_(is_read_later))

    if is_favorite is not None:
        query = query.where(UserArticleState.is_favorite.is_(is_favorite))

    # Apply date filters
    if published_since is not None:
        query = query.where(ArticleContent.published_at >= published_since)

    if published_until is not None:
        query = query.where(ArticleContent.published_at <= published_until)

    # Apply cursor filter (articles after the cursor)
    if params.cursor:
        query = query.where(ArticleContent.id > params.cursor)

    # Order by article_id for consistent cursor pagination
    query = query.order_by(ArticleContent.id.asc())

    # Fetch one more than limit to check if there are more pages
    query = query.limit(params.limit + 1)

    # Execute query
    result = await db.execute(query)
    articles = result.scalars().unique().all()

    # Determine if there are more pages
    has_more = len(articles) > params.limit
    if has_more:
        articles = articles[: params.limit]  # Remove the extra item

    # Get next cursor (last item's ID)
    next_cursor = articles[-1].id if articles and has_more else None

    # Optionally get total count (can be expensive, so make it optional)
    # For now, we'll skip total count to keep it fast
    total_count = None

    return CursorPaginationResult(
        items=list(articles), next_cursor=next_cursor, has_more=has_more, total_count=total_count
    )
