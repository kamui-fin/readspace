"""Main article routes - list, get, update."""

from uuid import UUID

import structlog
from fastapi import APIRouter, Body, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import ERROR_ARTICLE_NOT_FOUND
from app.crud.article.reader import CursorPaginationParams
from app.db.session import get_db
from app.services.articles.service import get_article_details, get_articles_with_cursor, update_article_state
from app.services.user.auth import get_current_user
from app.typing.articles import ArticleResponse, ArticleUpdate
from app.typing.user import TokenData

logger = structlog.get_logger(__name__)
router = APIRouter()


@router.get(
    "/",
    response_model=dict,
    status_code=status.HTTP_200_OK,
    summary="List user articles with cursor pagination",
    description="Retrieve articles using cursor-based pagination for better performance with large datasets",
    responses={
        200: {
            "description": "Successfully retrieved articles with cursor pagination",
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
            "description": "Validation error in query parameters",
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
async def list_articles(
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
    cursor: str | None = Query(None, description="Cursor for pagination (article ID)"),
    limit: int = Query(50, ge=1, le=200, description="Number of items per page"),
    feed_id: UUID | None = Query(None, description="Filter by specific feed ID"),
    folder_id: UUID | None = Query(None, description="Filter by folder ID (all feeds in folder)"),
    is_read: bool | None = Query(None, description="Filter by read status"),
    is_read_later: bool | None = Query(None, description="Filter by read later status"),
) -> dict:
    """
    Retrieve articles using cursor-based pagination for better performance.

    Cursor pagination provides better performance for large datasets compared to
    offset-based pagination. It uses the article ID as a cursor, which allows
    for efficient querying without the performance issues of OFFSET.

    Args:
        db: Database session dependency
        current_user: Authenticated user token data
        cursor: Optional cursor (article ID) for pagination
        limit: Number of items per page (default: 50, max: 200)
        feed_id: Optional feed UUID to filter articles
        folder_id: Optional folder UUID to filter articles from all feeds in that folder
        is_read: Optional boolean to filter by read status
        is_read_later: Optional boolean to filter articles marked for reading later

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
        - Cursor should be the ID of the last article from the previous page
        - Returns empty items list when no articles match filters
        - feed_id and folder_id are mutually exclusive (feed_id takes precedence)
    """
    params = CursorPaginationParams(limit=limit, cursor=cursor)

    filters = {}
    if feed_id:
        filters["feed_id"] = feed_id
    elif folder_id:
        filters["folder_id"] = folder_id
    if is_read is not None:
        filters["is_read"] = is_read
    if is_read_later is not None:
        filters["is_read_later"] = is_read_later

    result = await get_articles_with_cursor(db=db, user_id=UUID(current_user.sub), params=params, **filters)

    return {
        "items": result.items,
        "next_cursor": result.next_cursor,
        "has_more": result.has_more,
        "total_count": None,
    }


@router.get(
    "/{article_id}",
    response_model=ArticleResponse,
    status_code=status.HTTP_200_OK,
    summary="Get article by ID",
    description="Retrieve a specific article by its unique identifier",
    responses={
        200: {
            "description": "Successfully retrieved article",
            "model": ArticleResponse,
        },
        404: {
            "description": "Article not found or access denied",
            "content": {"application/json": {"example": {"detail": ERROR_ARTICLE_NOT_FOUND}}},
        },
        422: {
            "description": "Invalid article ID format",
            "content": {
                "application/json": {
                    "example": {
                        "detail": [
                            {"loc": ["path", "article_id"], "msg": "invalid uuid format", "type": "value_error.uuid"}
                        ]
                    }
                }
            },
        },
    },
)
async def get_article(
    article_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
) -> ArticleResponse:
    """
    Retrieve a specific article by its unique identifier.

    This endpoint fetches a single article with all its metadata, content, and
    user-specific data (read status, favorites, etc.).

    Args:
        article_id: UUID of the article to retrieve
        db: Database session dependency
        current_user: Authenticated user token data

    Returns:
        ArticleResponse: Complete article data including content, metadata,
        read status, and associated feed information

    Raises:
        HTTPException:
            - 404: Article not found, doesn't belong to user's feeds, or access denied
            - 422: Invalid UUID format for article_id
    """
    article = await get_article_details(
        db=db, article_id=article_id, user_id=UUID(current_user.sub), allow_preview=False
    )

    if not article:
        logger.warning(
            "Article not found or access denied",
            article_id=article_id,
            user_id=current_user.sub,
        )
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=ERROR_ARTICLE_NOT_FOUND)

    return article


@router.put(
    "/{article_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Update article status",
    description="Update an article's user-specific metadata and status flags",
    responses={
        204: {
            "description": "Article successfully updated",
        },
        404: {
            "description": "Article not found or access denied",
            "content": {"application/json": {"example": {"detail": ERROR_ARTICLE_NOT_FOUND}}},
        },
        422: {
            "description": "Validation error in request data",
            "content": {
                "application/json": {
                    "examples": {
                        "invalid_uuid": {
                            "summary": "Invalid article ID",
                            "value": {
                                "detail": [
                                    {
                                        "loc": ["path", "article_id"],
                                        "msg": "invalid uuid format",
                                        "type": "value_error.uuid",
                                    }
                                ]
                            },
                        },
                    }
                }
            },
        },
    },
)
async def update_article(
    article_id: UUID,
    article_in: ArticleUpdate = Body(...),
    article_type: str = Query("feed", description="Article type: 'feed' or 'clipped'"),
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
) -> None:
    """
    Update an article's user-specific metadata and status flags.

    This endpoint allows users to modify their personal interaction data with articles,
    such as marking them as read, adding to favorites, or saving for later reading.
    The article content itself cannot be modified through this endpoint.

    Args:
        article_id: UUID of the article to update
        article_in: Update data containing the fields to modify
        db: Database session dependency
        current_user: Authenticated user token data

    Returns:
        None: No content returned on success

    Raises:
        HTTPException:
            - 404: Article not found or user doesn't have access to modify it
            - 422: Validation error in article_id format

    Updateable Fields:
        - is_read: Mark article as read/unread
        - is_read_later: Add/remove from read-later list
        - read_at: Timestamp when article was read (usually set automatically)

    Note:
        - Only user-specific metadata can be updated, not article content
        - Updates are scoped to the authenticated user
    """
    is_clipped = article_type.lower() == "clipped"
    updated_article = await update_article_state(
        db=db, article_id=article_id, user_id=UUID(current_user.sub), update_data=article_in, is_clipped=is_clipped
    )

    if not updated_article:
        logger.warning(
            "Article not found for update or access denied",
            article_id=article_id,
            user_id=current_user.sub,
        )
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=ERROR_ARTICLE_NOT_FOUND)
