"""Article view routes - today, read-later, recently-read."""

from datetime import UTC, datetime, timedelta
from typing import Annotated
from uuid import UUID

import structlog
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud.article.reader import CursorPaginationParams, get_articles
from app.crud.article.reader import (
    get_read_later_articles as get_read_later_articles_crud,
)
from app.db.session import get_db
from app.services.user.auth import get_current_user
from app.typing.common import CursorPaginatedResponse
from app.typing.entries import EntryListItem
from app.typing.user import TokenData

logger = structlog.get_logger(__name__)
router = APIRouter()


@router.get(
    "/views/today",
    response_model=CursorPaginatedResponse[EntryListItem],
    status_code=status.HTTP_200_OK,
    summary="Get today's articles",
    description="Retrieve articles published in the last 24 hours.",
)
async def get_todays_articles(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[TokenData, Depends(get_current_user)],
    cursor: str | None = Query(None, description="Cursor (article ID)"),
    limit: int = Query(50, ge=1, le=200),
) -> CursorPaginatedResponse[EntryListItem]:
    """
    Retrieve articles published in the last 24 hours (UTC).
    """
    logger.bind(user_id=current_user.sub, view="today")

    now_utc = datetime.now(UTC)
    twenty_four_hours_ago = now_utc - timedelta(hours=24)

    result = await get_articles(
        db=db,
        user_id=UUID(current_user.sub),
        params=CursorPaginationParams(limit=limit, cursor=cursor),
        published_since=twenty_four_hours_ago,
        published_until=now_utc,
    )

    return CursorPaginatedResponse(
        items=result.items,
        next_cursor=result.next_cursor,
        has_more=result.has_more,
        total_count=None,
    )


@router.get(
    "/views/recently-read",
    response_model=CursorPaginatedResponse[EntryListItem],
    status_code=status.HTTP_200_OK,
    summary="Get recently read articles",
    description="Retrieve articles explicitly marked as read by the user.",
)
async def get_recently_read_articles(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[TokenData, Depends(get_current_user)],
    cursor: str | None = Query(None, description="Cursor (article ID)"),
    limit: int = Query(50, ge=1, le=200),
) -> CursorPaginatedResponse[EntryListItem]:
    """
    Retrieve articles that have been explicitly read by the user.
    """
    logger.bind(user_id=current_user.sub, view="recently_read")

    result = await get_articles(
        db=db,
        user_id=UUID(current_user.sub),
        params=CursorPaginationParams(limit=limit, cursor=cursor),
        is_read=True,
    )

    return CursorPaginatedResponse(
        items=result.items,
        next_cursor=result.next_cursor,
        has_more=result.has_more,
        total_count=None,
    )


@router.get(
    "/views/read-later",
    response_model=CursorPaginatedResponse[EntryListItem],
    status_code=status.HTTP_200_OK,
    summary="Get read later articles",
    description="Retrieve articles marked for reading later (includes RSS and clipped).",
)
async def get_read_later_articles(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[TokenData, Depends(get_current_user)],
    cursor: str | None = Query(None, description="Cursor (article ID)"),
    limit: int = Query(50, ge=1, le=200),
) -> CursorPaginatedResponse[EntryListItem]:
    """
    Retrieve user's "read later" list.
    """
    logger.bind(user_id=current_user.sub, view="read_later")

    result = await get_read_later_articles_crud(
        db=db,
        user_id=UUID(current_user.sub),
        params=CursorPaginationParams(limit=limit, cursor=cursor),
    )

    return CursorPaginatedResponse(
        items=result.items,
        next_cursor=result.next_cursor,
        has_more=result.has_more,
        total_count=None,
    )
