from uuid import UUID

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import ERROR_ARTICLE_NOT_FOUND
from app.db.session import get_db
from app.schemas import ArticleResponse
from app.schemas.auth import TokenData
from app.services.articles.management import ArticleManagementService
from app.services.user.auth import get_current_user

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
    feed_ids: list[UUID] | None = Query(None, description="Filter by specific feed IDs"),
    folder_id: UUID | None = Query(None, description="Filter by folder ID (all feeds in folder)"),
    is_read: bool | None = Query(None, description="Filter by read status"),
    is_read_later: bool | None = Query(None, description="Filter by read later status"),
    exclude_content: bool = Query(True, description="Exclude article content for lighter responses (default: true)"),
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
        feed_ids: Optional list of feed UUIDs to filter articles
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
        - feed_ids and folder_id are mutually exclusive (feed_ids takes precedence)
    """
    from app.crud.article import (
        ArticleTransformer,
        CursorPaginationParams,
        get_articles_cursor_paginated,
    )

    # Create pagination parameters
    params = CursorPaginationParams(limit=limit, cursor=cursor)

    # Get articles using cursor pagination
    result = await get_articles_cursor_paginated(
        db=db,
        user_id=UUID(current_user.sub),
        params=params,
        feed_ids=feed_ids,
        folder_id=folder_id,
        is_read=is_read,
        is_read_later=is_read_later,
    )

    # Transform the tuples into ArticleResponse objects
    transformer = ArticleTransformer()

    transformed_items = []
    for item in result.items:
        transformed_item = transformer.to_unified(item)
        item_dict = transformed_item.model_dump()

        # Exclude heavy content fields if requested (default behavior)
        if exclude_content:
            item_dict.pop("content", None)
            item_dict.pop("extracted_content", None)
            # Keep description_preview but remove full description if it's large
            if item_dict.get("description") and len(item_dict["description"]) > 500:
                item_dict["description"] = item_dict["description"][:500] + "..."

        transformed_items.append(item_dict)

    return {
        "items": transformed_items,
        "next_cursor": str(result.next_cursor) if result.next_cursor else None,
        "has_more": result.has_more,
        "total_count": result.total_count,
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
    user-specific data (read status, favorites, etc.). It supports both regular
    subscribed feed articles and preview mode for unsubscribed feeds.

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

    Note:
        - First attempts to find article in user's subscribed feeds
        - If not found, enables preview mode for unsubscribed feed articles
        - Preview mode allows users to read articles from feeds they haven't subscribed to
        - Includes full article content, not just summary/excerpt
        - Returns user-specific metadata like read status and favorites
    """
    article_service = ArticleManagementService(db=db, user_id=UUID(current_user.sub))

    # First try to get the article with preview mode disabled (normal case)
    article = await article_service.get_article(article_id=article_id, allow_preview=False)

    # If not found and user might be in preview mode, try with preview enabled
    if not article:
        # Try again with preview mode enabled - this allows access to articles
        # from feeds the user hasn't subscribed to (useful for feed preview)
        article = await article_service.get_article(article_id=article_id, allow_preview=True)

    if not article:
        logger.warning(
            "Article not found or access denied",
            article_id=article_id,
            user_id=current_user.sub,
        )
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=ERROR_ARTICLE_NOT_FOUND)
    return article
