"""Article view routes - today, read-later, recently-read."""

from datetime import UTC, datetime, timedelta
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud.article.reader import CursorPaginationParams
from app.crud.article.reader import get_read_later_articles as get_read_later_articles_crud
from app.db.session import get_db
from app.services.articles.service import get_articles_with_cursor
from app.services.user.auth import get_current_user
from app.typing.user import TokenData

router = APIRouter()


@router.get(
    "/views/today",
    response_model=dict,
    status_code=status.HTTP_200_OK,
    summary="Get today's articles with cursor pagination",
    description="Retrieve articles published in the last 24 hours using cursor-based pagination",
    responses={
        200: {
            "description": "Successfully retrieved today's articles",
            "content": {
                "application/json": {
                    "example": {
                        "items": [],
                        "next_cursor": "uuid-string",
                        "has_more": True,
                        "total_count": None,
                    }
                }
            },
        },
        422: {
            "description": "Validation error in pagination parameters",
            "content": {
                "application/json": {
                    "example": {
                        "detail": [
                            {
                                "loc": ["query", "limit"],
                                "msg": "ensure this value is less than or equal to 200",
                                "type": "value_error.number.not_le",
                            }
                        ]
                    }
                }
            },
        },
    },
)
async def get_todays_articles(
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
    cursor: str | None = Query(None, description="Cursor for pagination (article ID)"),
    limit: int = Query(50, ge=1, le=200, description="Number of items per page"),
) -> dict:
    """
    Retrieve articles published in the last 24 hours using cursor-based pagination.

    This endpoint provides a convenient way to access recent articles from all subscribed feeds.
    The time range is calculated from the current UTC time minus 24 hours.

    Args:
        db: Database session dependency
        current_user: Authenticated user token data
        cursor: Optional cursor (article ID) for pagination
        limit: Number of items per page (default: 50, max: 200)

    Returns:
        dict: Cursor pagination result with items, next_cursor, has_more, and total_count

    Response Format:
        {
            "items": [...],
            "next_cursor": "uuid-string" or null,
            "has_more": boolean,
            "total_count": null (not computed for performance)
        }

    Note:
        - Time calculations use UTC timezone
        - Only includes articles from feeds the user is subscribed to
        - Articles are sorted by publication date in descending order
        - Useful for creating "today's news" or "daily digest" views
    """
    now_utc = datetime.now(UTC)
    twenty_four_hours_ago = now_utc - timedelta(hours=24)

    params = CursorPaginationParams(limit=limit, cursor=cursor)

    result = await get_articles_with_cursor(
        db=db,
        user_id=UUID(current_user.sub),
        params=params,
        published_since=twenty_four_hours_ago,
        published_until=now_utc,
    )

    return {
        "items": result.items,
        "next_cursor": result.next_cursor,
        "has_more": result.has_more,
        "total_count": None,
    }


@router.get(
    "/views/recently-read",
    response_model=dict,
    status_code=status.HTTP_200_OK,
    summary="Get recently read articles with cursor pagination",
    description="Retrieve articles that have been explicitly read by the user using cursor-based pagination",
    responses={
        200: {
            "description": "Successfully retrieved recently read articles",
            "content": {
                "application/json": {
                    "example": {
                        "items": [],
                        "next_cursor": "uuid-string",
                        "has_more": True,
                        "total_count": None,
                    }
                }
            },
        },
        422: {
            "description": "Validation error in pagination parameters",
            "content": {
                "application/json": {
                    "example": {
                        "detail": [
                            {
                                "loc": ["query", "limit"],
                                "msg": "ensure this value is less than or equal to 200",
                                "type": "value_error.number.not_le",
                            }
                        ]
                    }
                }
            },
        },
    },
)
async def get_recently_read_articles(
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
    cursor: str | None = Query(None, description="Cursor for pagination (article ID)"),
    limit: int = Query(50, ge=1, le=200, description="Number of items per page"),
) -> dict:
    """
    Retrieve articles that have been explicitly read by the user using cursor-based pagination.

    This endpoint returns articles that the user has explicitly marked as read
    (is_read=True), sorted by publication date (most recent first).
    It does NOT include articles that are automatically considered "read" due to the
    feed's last_read_cutoff timestamp.

    Args:
        db: Database session dependency
        current_user: Authenticated user token data
        cursor: Optional cursor (article ID) for pagination
        limit: Number of items per page (default: 50, max: 200)

    Returns:
        dict: Cursor pagination result with items, next_cursor, has_more, and total_count

    Note:
        - Only includes articles explicitly marked as read by the user
        - Excludes articles automatically marked as read via last_read_cutoff
        - Articles are sorted by published_at timestamp in descending order
        - Only includes articles from RSS feeds, not saved web articles
    """
    params = CursorPaginationParams(limit=limit, cursor=cursor)

    result = await get_articles_with_cursor(
        db=db,
        user_id=UUID(current_user.sub),
        params=params,
        is_read=True,
    )

    return {
        "items": result.items,
        "next_cursor": result.next_cursor,
        "has_more": result.has_more,
        "total_count": None,
    }


@router.get(
    "/views/read-later",
    response_model=dict,
    status_code=status.HTTP_200_OK,
    summary="Get read later articles with cursor pagination",
    description="Retrieve articles marked for reading later by the user using cursor-based pagination",
    responses={
        200: {
            "description": "Successfully retrieved read later articles",
            "content": {
                "application/json": {
                    "example": {
                        "items": [],
                        "next_cursor": "uuid-string",
                        "has_more": True,
                        "total_count": None,
                    }
                }
            },
        },
        422: {
            "description": "Validation error in pagination parameters",
            "content": {
                "application/json": {
                    "example": {
                        "detail": [
                            {
                                "loc": ["query", "limit"],
                                "msg": "ensure this value is less than or equal to 200",
                                "type": "value_error.number.not_le",
                            }
                        ]
                    }
                }
            },
        },
    },
)
async def get_read_later_articles(
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
    cursor: str | None = Query(None, description="Cursor for pagination (article ID)"),
    limit: int = Query(50, ge=1, le=200, description="Number of items per page"),
) -> dict:
    """
    Retrieve articles marked for reading later by the user using cursor-based pagination.

    This endpoint returns the user's "read later" list - articles they have
    specifically saved to read at a later time. This includes both articles
    from RSS feeds and manually saved web articles (clipped articles).

    Args:
        db: Database session dependency
        current_user: Authenticated user token data
        cursor: Optional cursor (article ID) for pagination
        limit: Number of items per page (default: 50, max: 200)

    Returns:
        dict: Cursor pagination result with items, next_cursor, has_more, and total_count

    Note:
        - Only includes articles where is_read_later flag is True
        - Includes both RSS feed articles and manually saved web articles (clipped articles)
        - Articles are sorted by timestamp (published_at for RSS, created_at for clipped)
        - Articles remain in this list until explicitly marked as read or removed
    """
    params = CursorPaginationParams(limit=limit, cursor=cursor)

    result = await get_read_later_articles_crud(
        db=db,
        user_id=UUID(current_user.sub),
        params=params,
    )

    return {
        "items": result.items,
        "next_cursor": result.next_cursor,
        "has_more": result.has_more,
        "total_count": None,
    }
