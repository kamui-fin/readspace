"""Cursor-based pagination for articles."""

from dataclasses import dataclass
from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field
from sqlalchemy import and_, case, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.constants import DEFAULT_CURSOR_LIMIT, MAX_CURSOR_LIMIT
from app.models import ArticleContent, Feed, FeedArticle, FeedSubscription, UserArticleState


@dataclass
class CursorPaginationParams:
    """Parameters for cursor-based pagination."""

    limit: int = DEFAULT_CURSOR_LIMIT
    cursor: str | None = None

    def __post_init__(self) -> None:
        """Validate and clamp limit to max value."""
        # Clamp limit to maximum
        if self.limit > MAX_CURSOR_LIMIT:
            self.limit = MAX_CURSOR_LIMIT
        # Ensure minimum of 1
        if self.limit < 1:
            self.limit = 1


class CursorPaginationResult(BaseModel):
    """Result of cursor-based pagination."""

    items: list[Any] = Field(description="List of items for current page")
    next_cursor: str | None = Field(description="Cursor for next page, None if no more pages")
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
    folder_id: UUID | None = None,
    is_read: bool | None = None,
    is_read_later: bool | None = None,
    is_favorite: bool | None = None,
    published_since: Any | None = None,
    published_until: Any | None = None,
) -> CursorPaginationResult:
    """
    Get articles using cursor-based pagination for better performance.

    Cursor pagination avoids the performance issues of OFFSET-based pagination
    by using a composite cursor of published_at timestamp and article_id. This is more
    efficient for large datasets and provides consistent results even when data is
    being inserted/updated.

    Args:
        db: Database session
        user_id: User ID to filter articles
        params: Pagination parameters (limit and cursor)
        feed_ids: Optional list of feed IDs to filter
        folder_id: Optional folder ID to filter articles by folder
        is_read: Optional filter for read status
        is_read_later: Optional filter for read later status
        is_favorite: Optional filter for favorite status
        published_since: Optional filter for articles published after this date
        published_until: Optional filter for articles published before this date

    Returns:
        CursorPaginationResult with items and pagination metadata
    """
    # Compute is_read dynamically based on UserArticleState.is_read and last_read_cutoff
    # Logic: Article is read if:
    # 1. Explicit read state is True, OR
    # 2. Article published_at <= last_read_cutoff (and cutoff is not NULL)
    computed_is_read = case(
        (UserArticleState.is_read.is_(True), True),
        (
            and_(
                FeedSubscription.last_read_cutoff.isnot(None),
                ArticleContent.published_at <= FeedSubscription.last_read_cutoff,
            ),
            True,
        ),
        else_=False,
    ).label("computed_is_read")

    # Build base query for feed articles
    # When filtering by specific feed_ids, use LEFT JOIN for subscription to support preview mode
    # Otherwise use INNER JOIN to only show subscribed feeds
    if feed_ids:
        # Preview mode: LEFT JOIN allows viewing unsubscribed feeds
        query = (
            select(FeedArticle, UserArticleState, FeedSubscription, computed_is_read)
            .options(
                selectinload(FeedArticle.content).undefer(ArticleContent.description).undefer(ArticleContent.content),
                selectinload(FeedArticle.feed),
            )
            .join(ArticleContent, ArticleContent.id == FeedArticle.content_id)
            .join(Feed, Feed.id == FeedArticle.feed_id)
            .outerjoin(FeedSubscription, and_(FeedSubscription.feed_id == Feed.id, FeedSubscription.user_id == user_id))
            .outerjoin(
                UserArticleState,
                and_(UserArticleState.article_id == FeedArticle.id, UserArticleState.user_id == user_id),
            )
            .where(Feed.id.in_(feed_ids))
        )
    else:
        # Normal mode: INNER JOIN ensures only subscribed feeds
        query = (
            select(FeedArticle, UserArticleState, FeedSubscription, computed_is_read)
            .options(
                selectinload(FeedArticle.content).undefer(ArticleContent.description).undefer(ArticleContent.content),
                selectinload(FeedArticle.feed),
            )
            .join(ArticleContent, ArticleContent.id == FeedArticle.content_id)
            .join(Feed, Feed.id == FeedArticle.feed_id)
            .join(FeedSubscription, and_(FeedSubscription.feed_id == Feed.id, FeedSubscription.user_id == user_id))
            .outerjoin(
                UserArticleState,
                and_(UserArticleState.article_id == FeedArticle.id, UserArticleState.user_id == user_id),
            )
        )

        # Apply folder filter if not using feed_ids filter
        if folder_id:
            query = query.where(FeedSubscription.folder_id == folder_id)

    # Apply status filters
    # Use computed_is_read for filtering instead of raw UserArticleState.is_read
    if is_read is not None:
        query = query.where(computed_is_read.is_(is_read))

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
        try:
            # Parse cursor: format is "timestamp_articleid"
            cursor_parts = params.cursor.split("_")
            if len(cursor_parts) == 2:
                cursor_timestamp = datetime.fromisoformat(cursor_parts[0].replace("Z", "+00:00"))
                cursor_article_id = UUID(cursor_parts[1])

                # Filter for articles published before cursor timestamp,
                # or same timestamp but with article ID greater than cursor
                query = query.where(
                    or_(
                        ArticleContent.published_at < cursor_timestamp,
                        and_(ArticleContent.published_at == cursor_timestamp, FeedArticle.id > cursor_article_id),
                    )
                )
        except (ValueError, IndexError):
            # Invalid cursor format, ignore and start from beginning
            pass

    # Order by published_at descending (newest first), then by FeedArticle.id ascending for consistent cursor pagination
    query = query.order_by(ArticleContent.published_at.desc(), FeedArticle.id.asc())

    # Fetch one more than limit to check if there are more pages
    query = query.limit(params.limit + 1)

    # Execute query
    result = await db.execute(query)
    rows = result.all()

    # Convert Row objects to tuples: (FeedArticle, UserArticleState, FeedSubscription, computed_is_read)
    article_tuples = [(row[0], row[1], row[2], row[3]) for row in rows]

    # Determine if there are more pages
    has_more = len(article_tuples) > params.limit
    if has_more:
        article_tuples = article_tuples[: params.limit]  # Remove the extra item

    # Get next cursor (composite of timestamp and article ID)
    next_cursor = None
    if article_tuples and has_more:
        last_article = article_tuples[-1][0]
        # Format: "timestamp_articleid"
        timestamp_str = last_article.content.published_at.isoformat().replace("+00:00", "Z")
        next_cursor = f"{timestamp_str}_{last_article.id}"

    # Optionally get total count (can be expensive, so make it optional)
    # For now, we'll skip total count to keep it fast
    total_count = None

    return CursorPaginationResult(
        items=list(article_tuples), next_cursor=next_cursor, has_more=has_more, total_count=total_count
    )
