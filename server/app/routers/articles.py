from datetime import UTC, datetime
from typing import Any
from uuid import UUID

import pytz
import structlog
from fastapi import APIRouter, Body, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import ERROR_ARTICLE_NOT_FOUND
from app.core.dependencies import get_user_service
from app.db.session import get_db
from app.schemas import (
    ArticleResponse,
    ArticleUpdate,
    ClippedArticleResponse,
    ClippedArticleUpdate,
    SaveArticleRequest,
)
from app.schemas.auth import TokenData
from app.services.articles.article_management import ArticleManagementService
from app.services.articles.web_article import WebArticleService
from app.services.user.auth import get_current_user
from app.services.user.user import UserService

logger = structlog.get_logger(__name__)
router = APIRouter(prefix="/articles", tags=["RSS Articles"])


def validate_timezone(timezone: str | None) -> str | None:
    """Validate timezone against IANA timezone database.

    Args:
        timezone: Timezone string to validate (e.g., 'America/New_York')

    Returns:
        The validated timezone string or None if input was None

    Raises:
        HTTPException: If timezone is not a valid IANA timezone
    """
    if timezone is None:
        return None

    if timezone not in pytz.all_timezones_set:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Invalid timezone '{timezone}'. Must be a valid IANA timezone "
                f"(e.g., 'America/New_York', 'Europe/London', 'Asia/Tokyo'). "
                f"See https://en.wikipedia.org/wiki/List_of_tz_database_time_zones for valid values."
            ),
        )
    return timezone


@router.post(
    "/",
    status_code=status.HTTP_201_CREATED,
    summary="Save web article",
    description="Save a web article from URL for read-later functionality",
    responses={
        201: {
            "description": "Article successfully saved",
            "content": {"application/json": {"example": {"success": True, "article_id": "uuid-string"}}},
        },
        400: {
            "description": "Bad request - invalid URL, validation error, or connection error",
            "content": {"application/json": {"example": {"detail": "Unable to fetch article: Connection timeout"}}},
        },
        422: {
            "description": "Validation error in request data",
            "content": {
                "application/json": {
                    "example": {
                        "detail": [{"loc": ["body", "url"], "msg": "invalid url format", "type": "value_error.url"}]
                    }
                }
            },
        },
        500: {
            "description": "Internal server error",
            "content": {
                "application/json": {"example": {"detail": "An unexpected error occurred while saving the article."}}
            },
        },
    },
)
async def save_web_article(
    request: SaveArticleRequest,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
    user_service: UserService = Depends(get_user_service),
) -> dict[str, Any]:
    """
    Save a web article from URL for read-later functionality.

    This endpoint allows users to save articles from any URL to their read-later collection.
    The service will attempt to extract the article content, title, and metadata automatically
    if not provided in the request.

    Args:
        request: Article save request containing URL and optional metadata
        db: Database session dependency
        current_user: Authenticated user token data
        user_service: Injected user service

    Returns:
        ClippedArticleResponse: The saved article with extracted content and metadata

    Raises:
        HTTPException:
            - 400: Invalid URL format, connection error, or validation error
            - 422: Request validation error
            - 500: Unexpected server error during article processing

    Note:
        - If title or content are not provided, they will be extracted from the URL
        - Articles are automatically associated with the authenticated user
        - Duplicate URLs for the same user are handled gracefully
    """
    # Ensure user profile exists in database
    await user_service.ensure_user_profile_exists(current_user)

    web_service = WebArticleService(db=db, user_id=UUID(current_user.sub))

    try:
        article = await web_service.save_article_from_url(
            url=str(request.url),
            title=request.title,
            content=request.content,  # Pass extracted content from extension
            metadata=request.metadata or {},
            # tag_ids removed - using ARRAY field on feeds
            note=request.note,
            priority=request.priority,
        )

        logger.info(
            "Web article saved successfully",
            article_id=article.id,
            user_id=current_user.sub,
            url=str(request.url),
        )
        
        # Return minimal response for extension
        return {"success": True, "article_id": str(article.id)}

    except ValueError as e:
        logger.warning(
            "Failed to save web article due to validation error",
            error=str(e),
            user_id=current_user.sub,
            url=str(request.url),
        )
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e
    except ConnectionError as e:
        logger.warning(
            "Failed to save web article due to connection error",
            error=str(e),
            user_id=current_user.sub,
            url=str(request.url),
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unable to fetch article: {str(e)}",
        ) from e
    except Exception as e:
        logger.error(
            "Unexpected error saving web article",
            error=str(e),
            user_id=current_user.sub,
            url=str(request.url),
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred while saving the article.",
        ) from e


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
    is_favorite: bool | None = Query(None, description="Filter by article favorite status"),
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
        is_favorite: Optional boolean to filter articles marked as favorites

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
    from app.crud.article.cursor_pagination import CursorPaginationParams, get_articles_cursor_paginated

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
        is_favorite=is_favorite,
    )

    # Transform the tuples into ArticleResponse objects
    from app.crud.article.article_transformer import ArticleTransformer

    transformer = ArticleTransformer()

    transformed_items = []
    for item in result.items:
        transformed_item = transformer.to_unified(item)
        item_dict = transformed_item.model_dump()
        
        # Exclude heavy content fields if requested (default behavior)
        if exclude_content:
            item_dict.pop('content', None)
            item_dict.pop('extracted_content', None)
            # Keep description_preview but remove full description if it's large
            if item_dict.get('description') and len(item_dict['description']) > 500:
                item_dict['description'] = item_dict['description'][:500] + '...'
        
        transformed_items.append(item_dict)

    return {
        "items": transformed_items,
        "next_cursor": str(result.next_cursor) if result.next_cursor else None,
        "has_more": result.has_more,
        "total_count": result.total_count,
    }


@router.get(
    "/today",
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
    from datetime import timedelta

    from app.crud.article.cursor_pagination import CursorPaginationParams, get_articles_cursor_paginated

    # Get current time in UTC
    now_utc = datetime.now(UTC)

    # Get articles from the last 24 hours
    twenty_four_hours_ago = now_utc - timedelta(hours=24)

    # Create pagination parameters
    params = CursorPaginationParams(limit=limit, cursor=cursor)

    # Get articles using cursor pagination with date filter
    result = await get_articles_cursor_paginated(
        db=db,
        user_id=UUID(current_user.sub),
        params=params,
        published_since=twenty_four_hours_ago,
        published_until=now_utc,
    )

    # Transform the tuples into ArticleResponse objects
    from app.crud.article.article_transformer import ArticleTransformer

    transformer = ArticleTransformer()

    transformed_items = []
    for item in result.items:
        transformed_item = transformer.to_unified(item)
        transformed_items.append(transformed_item.model_dump())

    return {
        "items": transformed_items,
        "next_cursor": str(result.next_cursor) if result.next_cursor else None,
        "has_more": result.has_more,
        "total_count": result.total_count,
    }


@router.get(
    "/recently-read",
    response_model=dict,
    status_code=status.HTTP_200_OK,
    summary="Get recently read articles with cursor pagination",
    description="Retrieve articles that have been recently read by the user using cursor-based pagination",
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
    Retrieve articles that have been recently read by the user using cursor-based pagination.

    This endpoint returns articles that the user has marked as read, sorted by
    when they were read (most recently read first). Useful for creating
    reading history or "continue reading" functionality.

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
        - Only includes articles explicitly marked as read by the user
        - Articles are sorted by read_at timestamp in descending order
        - The definition of "recent" is configurable (typically within the last 30 days)
        - Includes articles from both RSS feeds and saved web articles
    """
    from app.crud.article.cursor_pagination import CursorPaginationParams, get_articles_cursor_paginated

    # Create pagination parameters
    params = CursorPaginationParams(limit=limit, cursor=cursor)

    # Get recently read articles using cursor pagination
    result = await get_articles_cursor_paginated(
        db=db,
        user_id=UUID(current_user.sub),
        params=params,
        is_read=True,
    )

    # Transform the tuples into ArticleResponse objects
    from app.crud.article.article_transformer import ArticleTransformer

    transformer = ArticleTransformer()

    transformed_items = []
    for item in result.items:
        transformed_item = transformer.to_unified(item)
        transformed_items.append(transformed_item.model_dump())

    return {
        "items": transformed_items,
        "next_cursor": str(result.next_cursor) if result.next_cursor else None,
        "has_more": result.has_more,
        "total_count": result.total_count,
    }


@router.get(
    "/read-later",
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

    Response Format:
        {
            "items": [...],
            "next_cursor": "uuid-string" or null,
            "has_more": boolean,
            "total_count": null (not computed for performance)
        }

    Note:
        - Only includes articles where is_read_later flag is True
        - Includes both RSS feed articles and manually saved web articles (clipped articles)
        - Articles are sorted by timestamp (published_at for RSS, created_at for clipped)
        - Articles remain in this list until explicitly marked as read or removed
    """
    from app.crud.article.cursor_pagination import CursorPaginationParams, get_combined_articles_cursor_paginated

    # Create pagination parameters
    params = CursorPaginationParams(limit=limit, cursor=cursor)

    # Get read later articles from both feed and clipped sources
    result = await get_combined_articles_cursor_paginated(
        db=db,
        user_id=UUID(current_user.sub),
        params=params,
        is_read_later=True,
    )

    # Transform the mixed items into ArticleResponse objects
    from app.crud.article.article_transformer import ArticleTransformer

    transformer = ArticleTransformer()

    transformed_items = []
    for item in result.items:
        transformed_item = transformer.to_unified(item)
        transformed_items.append(transformed_item.model_dump())

    return {
        "items": transformed_items,
        "next_cursor": str(result.next_cursor) if result.next_cursor else None,
        "has_more": result.has_more,
        "total_count": result.total_count,
    }


@router.get(
    "/unread-counts",
    response_model=dict[str, Any],
    status_code=status.HTTP_200_OK,
    summary="Get unread article counts",
    description="Retrieve unread article counts, optionally filtered by folder",
    responses={
        200: {
            "description": "Successfully retrieved unread counts",
            "content": {
                "application/json": {
                    "examples": {
                        "global_counts": {
                            "summary": "Global unread counts (no folder filter)",
                            "value": {
                                "total_unread": 42,
                                "unread_by_folder": {"folder-uuid-1": 15, "folder-uuid-2": 27},
                                "read_later_count": 5,
                                "today_count": 8,
                            },
                        },
                        "folder_specific": {
                            "summary": "Counts for specific folder",
                            "value": {"total_unread": 15, "folder_id": "folder-uuid-1"},
                        },
                    }
                }
            },
        },
        422: {
            "description": "Validation error in folder ID parameter",
            "content": {
                "application/json": {
                    "example": {
                        "detail": [
                            {"loc": ["query", "folder_id"], "msg": "invalid uuid format", "type": "value_error.uuid"}
                        ]
                    }
                }
            },
        },
    },
)
async def get_unread_article_counts(
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
    folder_id: UUID | None = Query(None, description="Optional folder ID to get counts for a specific folder"),
) -> dict[str, Any]:
    """
    Retrieve unread article counts, optionally filtered by folder.

    This endpoint provides unread article statistics to power UI elements like
    badges, notifications, and navigation counters. It can return either global
    counts across all folders or counts for a specific folder.

    Args:
        db: Database session dependency
        current_user: Authenticated user token data
        folder_id: Optional UUID to get counts for a specific folder only

    Returns:
        dict[str, Any]: Unread count statistics with the following structure:
        - If folder_id is None: {
            "total_unread": int,
            "unread_by_folder": {"folder_id": count, ...},
            "read_later_count": int,
            "today_count": int
          }
        - If folder_id is provided: {
            "unread_count": int
          }

    Raises:
        HTTPException:
            - 422: Validation error in folder_id parameter (invalid UUID format)

    Note:
        - Only counts articles from feeds the user is subscribed to
        - "Uncategorized" includes articles from feeds not assigned to any folder
        - Counts are calculated in real-time and not cached
        - Useful for displaying unread badges in navigation menus
    """
    article_service = ArticleManagementService(db=db, user_id=UUID(current_user.sub))
    if folder_id:
        count = await article_service.count_unread_articles_by_folder(folder_id=folder_id)
        return {"unread_count": count}
    else:
        # Use optimized single-query method and return directly
        return await article_service.get_all_unread_counts()


@router.get(
    "/check-saved",
    status_code=status.HTTP_200_OK,
    summary="Check if article is saved by URL",
    description="Check if an article URL has been saved",
    responses={
        200: {
            "description": "Article check result",
            "content": {
                "application/json": {
                    "example": {"is_saved": True, "article_id": "uuid-string"}
                }
            },
        },
        422: {
            "description": "Validation error in query parameters",
            "content": {
                "application/json": {
                    "example": {
                        "detail": [{"loc": ["query", "url"], "msg": "invalid url format", "type": "value_error.url"}]
                    }
                }
            },
        },
    },
)
async def check_article_saved(
    url: str = Query(..., description="URL of the article to check"),
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
) -> dict[str, Any]:
    """
    Check if an article URL has been saved.

    This endpoint allows the extension to check if a user has already saved
    an article by its URL.

    Args:
        url: The URL of the article to check
        db: Database session dependency
        current_user: Authenticated user token data

    Returns:
        dict: {"is_saved": bool, "article_id": str | None}

    Raises:
        HTTPException:
            - 422: Validation error in URL parameter

    Note:
        - Queries both clipped_articles and article_contents tables
        - Joins on content_id to find article by URL
        - Returns minimal response for extension efficiency
    """
    web_service = WebArticleService(db=db, user_id=UUID(current_user.sub))

    try:
        article = await web_service.get_article_by_url(url)
        
        if article:
            # Return minimal metadata without heavy content
            return {
                "is_saved": True,
                "article_id": str(article.id),
                "id": str(article.id),
                "title": article.content.title if article.content else None,
                "note": article.note,
                "priority": article.priority.value if article.priority else None,
                "is_read": article.is_read,
                "is_read_later": article.is_read_later,
                "read_at": article.read_at.isoformat() if article.read_at else None,
            }
        else:
            return {"is_saved": False, "article_id": None}
    except Exception as e:
        logger.error(
            "Error checking if article is saved",
            error=str(e),
            user_id=current_user.sub,
            url=url,
        )
        return {"is_saved": False, "article_id": None}


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


@router.put(
    "/{article_id}",
    response_model=ArticleResponse,
    status_code=status.HTTP_200_OK,
    summary="Update article status",
    description="Update an article's user-specific metadata and status flags",
    responses={
        200: {
            "description": "Article successfully updated",
            "model": ArticleResponse,
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
                        "invalid_type": {
                            "summary": "Invalid article type",
                            "value": {
                                "detail": [
                                    {
                                        "loc": ["query", "article_type"],
                                        "msg": "string does not match regex '^(feed|clipped)$'",
                                        "type": "value_error.str.regex",
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
    article_type: str = Query("feed", pattern="^(feed|clipped)$", description="Article type: feed or clipped"),
    article_in: ArticleUpdate | ClippedArticleUpdate = Body(...),
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
) -> ArticleResponse:
    """
    Update an article's user-specific metadata and status flags.

    This endpoint allows users to modify their personal interaction data with articles,
    such as marking them as read, adding to favorites, or saving for later reading.
    The article content itself cannot be modified through this endpoint.

    Args:
        article_id: UUID of the article to update
        article_in: Update data containing the fields to modify
        article_type: Type of article - either "feed" (from RSS) or "clipped" (saved web article)
        db: Database session dependency
        current_user: Authenticated user token data

    Returns:
        ArticleResponse: Updated article with modified status flags and metadata

    Raises:
        HTTPException:
            - 404: Article not found or user doesn't have access to modify it
            - 422: Validation error in article_id format or article_type parameter

    Updateable Fields:
        - is_read: Mark article as read/unread
        - is_read_later: Add/remove from read-later list
        - is_favorite: Mark as favorite/unfavorite
        - read_at: Timestamp when article was read (usually set automatically)

    Note:
        - Only user-specific metadata can be updated, not article content
        - Updates are scoped to the authenticated user
        - article_type parameter helps optimize database queries
        - Automatically logs update activity for audit purposes
    """
    logger.info(
        "Received article update request",
        article_id=article_id,
        article_type=article_type,
        update_data=article_in.model_dump(exclude_unset=True),
        user_id=current_user.sub,
    )
    article_service = ArticleManagementService(db=db, user_id=UUID(current_user.sub))
    updated_article = await article_service.update_article(
        article_id=article_id, article_in=article_in, article_type=article_type
    )
    if not updated_article:
        logger.warning(
            "Article not found for update or access denied",
            article_id=article_id,
            user_id=current_user.sub,
        )
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=ERROR_ARTICLE_NOT_FOUND)
    logger.info(
        "Article status updated successfully",
        article_id=updated_article.id,
        user_id=current_user.sub,
    )
    return updated_article
