"""Main article routes - list, get, update."""

from typing import Annotated
from uuid import UUID

import structlog
from fastapi import APIRouter, Body, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.custom_exceptions import NotFoundError
from app.crud.article.actions import update_article_status
from app.crud.article.reader import CursorPaginationParams, get_articles
from app.db.session import get_db, get_db_factory
from app.models.enums import UserRole
from app.services.articles.service import get_article_details
from app.services.feeds.service import SessionFactory, refresh_feed
from app.services.user.auth import get_current_user
from app.typing.common import CursorPaginatedResponse
from app.typing.entries import EntryDetail, EntryListItem, EntryUpdate
from app.typing.user import TokenData
from app.utils.time import get_sync_cutoff

logger = structlog.get_logger(__name__)
router = APIRouter()


# --- Routes ---
@router.get(
    "/",
    response_model=CursorPaginatedResponse[EntryListItem],
    status_code=status.HTTP_200_OK,
    summary="List user articles with cursor pagination",
)
async def list_articles(
    db: Annotated[AsyncSession, Depends(get_db)],
    db_factory: Annotated[SessionFactory, Depends(get_db_factory)],
    current_user: Annotated[TokenData, Depends(get_current_user)],
    cursor: str | None = Query(None, description="Cursor (article ID)"),
    limit: int = Query(50, ge=1, le=200),
    feed_id: UUID | None = Query(None),
    folder_id: UUID | None = Query(None),
    is_read: bool | None = Query(None),
    is_saved: bool | None = Query(None, alias="is_saved"),
) -> CursorPaginatedResponse[EntryListItem]:
    """
    Retrieve articles using cursor-based pagination.
    """
    # 1. Construct Filter Dict (Clean & Pythonic)
    filters = {
        k: v
        for k, v in {
            "feed_id": feed_id,
            "folder_id": folder_id,
            "is_read": is_read,
            "is_saved": is_saved,
        }.items()
        if v is not None
    }

    # 2. Handle Basic User 2h Sync cutoff
    published_until = None
    if current_user.role == UserRole.BASIC:
        published_until = get_sync_cutoff()

    # 3. Query
    result = await get_articles(
        db=db,
        user_id=UUID(current_user.sub),
        params=CursorPaginationParams(limit=limit, cursor=cursor),
        published_until=published_until,
        **filters,
    )

    # 4. Auto-Refresh if empty feed (Preview Mode or Stale Feed)
    # If we are looking at a specific feed (feed_id provided), and it's the first page (no cursor),
    # and there are no articles, we should try to refresh the feed to see if there is new content.
    if feed_id and not cursor and not result.items:
        logger.info("Feed empty, auto-refreshing", feed_id=str(feed_id))
        # Use separate session for refresh to ensure isolation
        await refresh_feed(db_factory, feed_id)

        # Re-fetch with fresh session state
        db.expire_all()
        result = await get_articles(
            db=db,
            user_id=UUID(current_user.sub),
            params=CursorPaginationParams(limit=limit, cursor=cursor),
            published_until=published_until,
            **filters,
        )

    return CursorPaginatedResponse(
        items=result.items,
        next_cursor=result.next_cursor,
        has_more=result.has_more,
        total_count=None,
    )


@router.get(
    "/{article_id}",
    response_model=EntryDetail,
    status_code=status.HTTP_200_OK,
    summary="Get article by ID",
)
async def get_article(
    article_id: UUID,
    db_factory: Annotated[SessionFactory, Depends(get_db_factory)],
    current_user: Annotated[TokenData, Depends(get_current_user)],
    clipped: bool = Query(False, description="Whether the article is a clipped article"),
) -> EntryDetail:
    """
    Retrieve a specific article with full content and metadata.
    """
    # Uses service directly, but checks explicitly for existence
    article = await get_article_details(
        db_factory=db_factory,
        article_id=article_id,
        user_id=UUID(current_user.sub),
        allow_preview=True,
        is_clipped=clipped,
    )

    if not article:
        logger.warning("Article not found", article_id=str(article_id), user_id=current_user.sub)
        raise NotFoundError(message="Article not found")

    return article


@router.put(
    "/{article_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Update article status",
)
async def update_article(
    article_id: UUID,
    article_in: Annotated[EntryUpdate, Body(...)],
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[TokenData, Depends(get_current_user)],
    article_type: str = Query("feed", description="'feed' or 'clipped'"),
) -> None:
    """
    Update user-specific article metadata (read status, notes, priority).
    """
    updated_article = await update_article_status(
        db=db,
        article_id=article_id,
        user_id=UUID(current_user.sub),
        article_in=article_in,
        is_clipped=(article_type.lower() == "clipped"),
    )

    if not updated_article:
        logger.warning(
            "Article update failed/not found",
            article_id=str(article_id),
            user_id=current_user.sub,
        )
        raise NotFoundError(message="Article not found")
