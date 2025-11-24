"""Simplified cursor-based pagination for new schema."""

from dataclasses import dataclass
from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, Field
from sqlalchemy import and_, case, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.constants import DEFAULT_CURSOR_LIMIT, MAX_CURSOR_LIMIT
from app.models import Feed, FeedArticle, FeedSubscription, UserEntry


@dataclass
class CursorPaginationParams:
    """Parameters for cursor-based pagination."""

    limit: int = DEFAULT_CURSOR_LIMIT
    cursor: str | None = None

    def __post_init__(self) -> None:
        """Validate and clamp limit to max value."""
        if self.limit > MAX_CURSOR_LIMIT:
            self.limit = MAX_CURSOR_LIMIT
        if self.limit < 1:
            self.limit = 1


class CursorPaginationResult(BaseModel):
    """Result of cursor-based pagination."""

    items: list[Any] = Field(description="List of items for current page")
    next_cursor: str | None = Field(description="Cursor for next page, None if no more pages")
    has_more: bool = Field(description="Whether there are more pages available")

    class Config:
        """Pydantic configuration."""

        from_attributes = True


async def get_feed_stream(
    db: AsyncSession,
    user_id: UUID,
    params: CursorPaginationParams,
    feed_ids: list[UUID] | None = None,
    folder_id: UUID | None = None,
    is_read: bool | None = None,
) -> CursorPaginationResult:
    """
    Optimized query for the Main Feed Stream.

    Uses denormalized published_at on feed_articles - NO article_contents join for sorting!
    """
    # Computed read status (explicit entry OR cutoff logic)
    computed_is_read = case(
        (UserEntry.is_read.is_(True), True),
        (
            and_(
                FeedSubscription.last_read_cutoff.isnot(None),
                FeedArticle.published_at <= FeedSubscription.last_read_cutoff,
            ),
            True,
        ),
        else_=False,
    ).label("computed_is_read")

    # Base query - LEFT JOIN UserEntry on content_id
    query = (
        select(FeedArticle, UserEntry, FeedSubscription, computed_is_read)
        .options(
            selectinload(FeedArticle.content),
            selectinload(FeedArticle.feed),
        )
        .join(Feed, Feed.id == FeedArticle.feed_id)
        .join(
            FeedSubscription,
            and_(
                FeedSubscription.feed_id == Feed.id,
                FeedSubscription.user_id == user_id,
            ),
        )
        .outerjoin(
            UserEntry,
            and_(
                UserEntry.content_id == FeedArticle.content_id,
                UserEntry.user_id == user_id,
            ),
        )
    )

    # Apply filters
    if feed_ids:
        query = query.where(FeedArticle.feed_id.in_(feed_ids))
    elif folder_id:
        query = query.where(FeedSubscription.folder_id == folder_id)

    if is_read is not None:
        query = query.where(computed_is_read.is_(is_read))

    # Cursor logic (using FeedArticle.published_at)
    if params.cursor:
        try:
            ts_str, id_str = params.cursor.split("_")
            cursor_ts = datetime.fromisoformat(ts_str.replace("Z", "+00:00"))
            cursor_id = UUID(id_str)

            # Efficient seek using tuple comparison
            query = query.where(
                or_(
                    FeedArticle.published_at < cursor_ts,
                    and_(FeedArticle.published_at == cursor_ts, FeedArticle.id > cursor_id),
                )
            )
        except (ValueError, IndexError):
            pass

    # Sort by denormalized column (Index Scan!)
    query = query.order_by(FeedArticle.published_at.desc(), FeedArticle.id.asc())
    query = query.limit(params.limit + 1)

    result = await db.execute(query)
    rows = result.all()

    # Pagination result
    has_more = len(rows) > params.limit
    items = rows[: params.limit] if has_more else rows

    next_cursor = None
    if items and has_more:
        last_item = items[-1][0]  # FeedArticle is index 0
        ts_str = last_item.published_at.isoformat().replace("+00:00", "Z")
        next_cursor = f"{ts_str}_{last_item.id}"

    return CursorPaginationResult(items=items, next_cursor=next_cursor, has_more=has_more)


async def get_saved_entries(
    db: AsyncSession,
    user_id: UUID,
    params: CursorPaginationParams,
    filter_type: Literal["read_later", "favorites", "archived", "history"],
) -> CursorPaginationResult:
    """
    Optimized query for User Lists (Read Later, Favorites, etc).

    Queries user_entries directly using partial indexes.
    Sorts by when user SAVED the item, not when it was published.
    """
    query = (
        select(UserEntry)
        .options(
            selectinload(UserEntry.content),
            selectinload(UserEntry.feed_article).selectinload(FeedArticle.feed),
        )
        .where(UserEntry.user_id == user_id)
    )

    # Apply specific list filters
    if filter_type == "read_later":
        query = query.where(UserEntry.is_read_later.is_(True))
    elif filter_type == "favorites":
        query = query.where(UserEntry.is_favorite.is_(True))
    elif filter_type == "archived":
        query = query.where(UserEntry.is_archived.is_(True))
    elif filter_type == "history":
        query = query.where(UserEntry.is_read.is_(True))

    # Cursor logic (using UserEntry.created_at)
    if params.cursor:
        try:
            ts_str, id_str = params.cursor.split("_")
            cursor_ts = datetime.fromisoformat(ts_str.replace("Z", "+00:00"))
            cursor_id = UUID(id_str)

            query = query.where(
                or_(
                    UserEntry.created_at < cursor_ts,
                    and_(UserEntry.created_at == cursor_ts, UserEntry.id > cursor_id),
                )
            )
        except (ValueError, IndexError):
            pass

    # Sort by creation date (newest saved item first)
    query = query.order_by(UserEntry.created_at.desc(), UserEntry.id.asc())
    query = query.limit(params.limit + 1)

    result = await db.execute(query)
    items = list(result.scalars().all())

    # Result construction
    has_more = len(items) > params.limit
    if has_more:
        items = items[: params.limit]

    next_cursor = None
    if items and has_more:
        last_item = items[-1]
        ts_str = last_item.created_at.isoformat().replace("+00:00", "Z")
        next_cursor = f"{ts_str}_{last_item.id}"

    return CursorPaginationResult(items=items, next_cursor=next_cursor, has_more=has_more)


# Legacy compatibility wrapper
async def get_articles_cursor_paginated(
    db: AsyncSession,
    user_id: UUID,
    params: CursorPaginationParams,
    feed_ids: list[UUID] | None = None,
    folder_id: UUID | None = None,
    is_read: bool | None = None,
    is_read_later: bool | None = None,
    **kwargs,
) -> CursorPaginationResult:
    """
    Legacy wrapper - routes to appropriate optimized function.

    Use get_feed_stream or get_saved_entries directly for better performance.
    """
    # If filtering by read_later, use saved entries
    if is_read_later is True:
        return await get_saved_entries(db, user_id, params, filter_type="read_later")

    # Otherwise use feed stream
    return await get_feed_stream(db, user_id, params, feed_ids, folder_id, is_read)
