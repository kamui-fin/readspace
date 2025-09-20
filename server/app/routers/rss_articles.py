from datetime import UTC, datetime
from typing import Any
from uuid import UUID

import structlog
from fastapi import APIRouter, Body, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import ERROR_ARTICLE_NOT_FOUND
from app.db.session import get_db
from app.schemas.auth import TokenData
from app.schemas.rss_schemas import (
    ArticleResponse,
    ArticleUpdate,
    ClippedArticleResponse,
    PaginatedResponse,
    SaveArticleRequest,
)
from app.services.auth import get_current_user
from app.services.rss_service import RssOrchestrationService
from app.services.user_service import UserService
from app.services.web_article_service import WebArticleService

logger = structlog.get_logger(__name__)
router = APIRouter(prefix="/articles", tags=["RSS Articles"])


@router.post(
    "/save",
    response_model=ClippedArticleResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Save web article",
    description="Save a web article from URL for read-later functionality",
    responses={
        201: {
            "description": "Article successfully saved",
            "model": ClippedArticleResponse,
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
) -> ClippedArticleResponse:
    """
    Save a web article from URL for read-later functionality.

    This endpoint allows users to save articles from any URL to their read-later collection.
    The service will attempt to extract the article content, title, and metadata automatically
    if not provided in the request.

    Args:
        request: Article save request containing URL and optional metadata
        db: Database session dependency
        current_user: Authenticated user token data

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
    user_service = UserService(db=db)
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
        return article

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
    response_model=PaginatedResponse[ArticleResponse],
    status_code=status.HTTP_200_OK,
    summary="List user articles",
    description="Retrieve a paginated list of articles with advanced filtering and sorting options",
    responses={
        200: {
            "description": "Successfully retrieved paginated articles",
            "model": PaginatedResponse[ArticleResponse],
        },
        400: {
            "description": "Invalid query parameters",
            "content": {
                "application/json": {
                    "examples": {
                        "invalid_sort": {
                            "summary": "Invalid sort parameter",
                            "value": {
                                "detail": "Invalid sort_by parameter. Allowed values: ['published_at', 'created_at', 'read_at', 'title']"  # noqa: E501
                            },
                        },
                        "invalid_order": {
                            "summary": "Invalid sort order",
                            "value": {"detail": "Invalid sort_order parameter. Allowed values: asc, desc"},
                        },
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
                                "loc": ["query", "page"],
                                "msg": "ensure this value is greater than or equal to 1",
                                "type": "value_error.number.not_ge",
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
    feed_ids: list[UUID] | None = Query(None, description="Filter by specific feed IDs"),
    folder_id: UUID | None = Query(None, description="Filter by folder ID"),
    is_read: bool | None = Query(None, description="Filter by read status"),
    is_read_later: bool | None = Query(None, description="Filter by read later status"),
    is_favorite: bool | None = Query(None, description="Filter by article favorite status"),
    feed_is_favorite: bool | None = Query(None, description="Filter by parent feed's favorite status"),
    published_since: datetime | None = Query(None, description="Filter by articles published since this UTC datetime"),
    published_until: datetime | None = Query(None, description="Filter by articles published until this UTC datetime"),
    user_timezone: str | None = Query(
        None,
        description="User's timezone for date calculations (e.g., 'America/New_York')",
    ),
    search_query: str | None = Query(None, description="Search query for article title and description"),
    sort_by: str = Query(
        "published_at",
        description="Sort articles by: published_at, created_at, read_at, title",
    ),
    sort_order: str = Query("desc", description="Sort order: asc or desc"),
    page: int = Query(1, ge=1, description="Page number for pagination"),
    size: int = Query(20, ge=1, le=100, description="Number of items per page"),
) -> PaginatedResponse[ArticleResponse]:
    """
    Retrieve a paginated list of articles with advanced filtering and sorting options.

    This endpoint provides comprehensive article listing functionality with support for:
    - Multi-criteria filtering (read status, favorites, date ranges, feeds, folders)
    - Full-text search across article titles and descriptions
    - Flexible sorting options
    - Pagination with configurable page sizes
    - Preview mode for unsubscribed feeds

    Args:
        db: Database session dependency
        current_user: Authenticated user token data
        feed_ids: Optional list of feed UUIDs to filter articles from specific feeds
        folder_id: Optional folder UUID to filter articles from feeds in a specific folder
        is_read: Optional boolean to filter by read status (True=read, False=unread, None=all)
        is_read_later: Optional boolean to filter articles marked for reading later
        is_favorite: Optional boolean to filter articles marked as favorites
        feed_is_favorite: Optional boolean to filter articles from favorite feeds
        published_since: Optional UTC datetime to filter articles published after this date
        published_until: Optional UTC datetime to filter articles published before this date
        user_timezone: Optional timezone string for date calculations (e.g., 'America/New_York')
        search_query: Optional search string to match against article titles and descriptions
        sort_by: Sort field - one of: published_at, created_at, read_at, title (default: published_at)
        sort_order: Sort direction - 'asc' or 'desc' (default: desc)
        page: Page number starting from 1 (default: 1)
        size: Number of articles per page, max 100 (default: 20)

    Returns:
        PaginatedResponse[ArticleResponse]: Paginated list of articles with metadata

    Raises:
        HTTPException:
            - 400: Invalid sort_by or sort_order parameters
            - 422: Validation error in query parameters (e.g., invalid page/size values)

    Note:
        - When requesting articles from a single unsubscribed feed, preview mode is enabled
        - Search queries perform case-insensitive matching on titles and descriptions
        - Date filters use UTC timezone unless user_timezone is specified
        - Results include article metadata, read status, and feed information
    """
    rss_service = RssOrchestrationService(db=db, user_id=UUID(current_user.sub))
    allowed_sort_by = ["published_at", "created_at", "read_at", "title"]
    if sort_by not in allowed_sort_by:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid sort_by parameter. Allowed values: {allowed_sort_by}",
        )
    if sort_order.lower() not in ["asc", "desc"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid sort_order parameter. Allowed values: asc, desc",
        )

    # Check if user is requesting preview mode by checking if they have access to the feed
    allow_preview = False
    if feed_ids and len(feed_ids) == 1:
        # If requesting articles for a single feed, check if user is subscribed
        feed_data = await rss_service.get_feed(feed_ids[0])
        if feed_data and not feed_data.is_subscribed:
            allow_preview = True

    paginated_articles = await rss_service.get_articles(
        feed_ids=feed_ids,
        folder_id=folder_id,
        is_read=is_read,
        is_read_later=is_read_later,
        is_favorite=is_favorite,
        feed_is_favorite=feed_is_favorite,
        published_since=published_since,
        published_until=published_until,
        user_timezone=user_timezone,
        search_query=search_query,
        sort_by=sort_by,
        sort_order=sort_order,
        page=page,
        size=size,
        allow_preview=allow_preview,
    )
    return paginated_articles


@router.get(
    "/today",
    response_model=PaginatedResponse[ArticleResponse],
    status_code=status.HTTP_200_OK,
    summary="Get today's articles",
    description="Retrieve articles published in the last 24 hours",
    responses={
        200: {
            "description": "Successfully retrieved today's articles",
            "model": PaginatedResponse[ArticleResponse],
        },
        422: {
            "description": "Validation error in pagination parameters",
            "content": {
                "application/json": {
                    "example": {
                        "detail": [
                            {
                                "loc": ["query", "size"],
                                "msg": "ensure this value is less than or equal to 100",
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
    page: int = Query(1, ge=1, description="Page number for pagination"),
    size: int = Query(25, ge=1, le=100, description="Number of items per page"),
) -> PaginatedResponse[ArticleResponse]:
    """
    Retrieve articles published in the last 24 hours.

    This endpoint provides a convenient way to access recent articles from all subscribed feeds.
    The time range is calculated from the current UTC time minus 24 hours.

    Args:
        db: Database session dependency
        current_user: Authenticated user token data
        page: Page number starting from 1 (default: 1)
        size: Number of articles per page, max 100 (default: 25)

    Returns:
        PaginatedResponse[ArticleResponse]: Paginated list of articles from the last 24 hours,
        sorted by publication date in descending order (newest first)

    Raises:
        HTTPException:
            - 422: Validation error in pagination parameters

    Note:
        - Time calculations use UTC timezone
        - Only includes articles from feeds the user is subscribed to
        - Articles are sorted by publication date in descending order
        - Useful for creating "today's news" or "daily digest" views
    """
    from datetime import timedelta

    # Get current time in UTC
    now_utc = datetime.now(UTC)

    # Get articles from the last 24 hours
    twenty_four_hours_ago = now_utc - timedelta(hours=24)

    rss_service = RssOrchestrationService(db=db, user_id=UUID(current_user.sub))
    paginated_articles = await rss_service.get_articles(
        published_since=twenty_four_hours_ago,
        published_until=now_utc,
        sort_by="published_at",
        sort_order="desc",
        page=page,
        size=size,
    )
    return paginated_articles


@router.get(
    "/recently_read",
    response_model=PaginatedResponse[ArticleResponse],
    status_code=status.HTTP_200_OK,
    summary="Get recently read articles",
    description="Retrieve articles that have been recently read by the user",
    responses={
        200: {
            "description": "Successfully retrieved recently read articles",
            "model": PaginatedResponse[ArticleResponse],
        },
        422: {
            "description": "Validation error in pagination parameters",
            "content": {
                "application/json": {
                    "example": {
                        "detail": [
                            {
                                "loc": ["query", "page"],
                                "msg": "ensure this value is greater than or equal to 1",
                                "type": "value_error.number.not_ge",
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
    page: int = Query(1, ge=1, description="Page number"),
    size: int = Query(20, ge=1, le=100, description="Page size"),
) -> PaginatedResponse[ArticleResponse]:
    """
    Retrieve articles that have been recently read by the user.

    This endpoint returns articles that the user has marked as read, sorted by
    when they were read (most recently read first). Useful for creating
    reading history or "continue reading" functionality.

    Args:
        db: Database session dependency
        current_user: Authenticated user token data
        page: Page number starting from 1 (default: 1)
        size: Number of articles per page, max 100 (default: 20)

    Returns:
        PaginatedResponse[ArticleResponse]: Paginated list of recently read articles,
        sorted by read timestamp in descending order (most recently read first)

    Raises:
        HTTPException:
            - 422: Validation error in pagination parameters

    Note:
        - Only includes articles explicitly marked as read by the user
        - Articles are sorted by read_at timestamp in descending order
        - The definition of "recent" is configurable (typically within the last 30 days)
        - Includes articles from both RSS feeds and saved web articles
    """
    rss_service = RssOrchestrationService(db=db, user_id=UUID(current_user.sub))
    skip = (page - 1) * size
    return await rss_service.get_recently_read_articles(skip=skip, limit=size)


@router.get(
    "/read_later",
    response_model=PaginatedResponse[ArticleResponse],
    status_code=status.HTTP_200_OK,
    summary="Get read later articles",
    description="Retrieve articles marked for reading later by the user",
    responses={
        200: {
            "description": "Successfully retrieved read later articles",
            "model": PaginatedResponse[ArticleResponse],
        },
        422: {
            "description": "Validation error in pagination parameters",
            "content": {
                "application/json": {
                    "example": {
                        "detail": [
                            {
                                "loc": ["query", "size"],
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
    page: int = Query(1, ge=1, description="Page number"),
    size: int = Query(100, ge=1, le=200, description="Page size"),
) -> PaginatedResponse[ArticleResponse]:
    """
    Retrieve articles marked for reading later by the user.

    This endpoint returns the user's "read later" list - articles they have
    specifically saved to read at a later time. This includes both articles
    from RSS feeds and manually saved web articles.

    Args:
        db: Database session dependency
        current_user: Authenticated user token data
        page: Page number starting from 1 (default: 1)
        size: Number of articles per page, max 200 (default: 100)

    Returns:
        PaginatedResponse[ArticleResponse]: Paginated list of articles marked for
        reading later, with sorting and metadata

    Raises:
        HTTPException:
            - 422: Validation error in pagination parameters

    Note:
        - Only includes articles where is_read_later flag is True
        - Higher page size limit (200) compared to other endpoints due to typical
          read-later list sizes
        - Includes both RSS feed articles and manually saved web articles
        - Articles remain in this list until explicitly marked as read or removed
    """
    rss_service = RssOrchestrationService(db=db, user_id=UUID(current_user.sub))
    skip = (page - 1) * size
    return await rss_service.get_read_later_articles(skip=skip, limit=size)


@router.get(
    "/unread_counts",
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
                                "by_folder": {"folder-uuid-1": 15, "folder-uuid-2": 27},
                                "uncategorized": 0,
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
            "by_folder": {"folder_id": count, ...},
            "uncategorized": int
          }
        - If folder_id is provided: {
            "total_unread": int,
            "folder_id": str
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
    rss_service = RssOrchestrationService(db=db, user_id=UUID(current_user.sub))
    return await rss_service.get_unread_counts(folder_id_filter=folder_id)


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
    rss_service = RssOrchestrationService(db=db, user_id=UUID(current_user.sub))

    # First try to get the article with preview mode disabled (normal case)
    article = await rss_service.get_article(article_id=article_id, allow_preview=False)

    # If not found and user might be in preview mode, try with preview enabled
    if not article:
        # Try again with preview mode enabled - this allows access to articles
        # from feeds the user hasn't subscribed to (useful for feed preview)
        article = await rss_service.get_article(article_id=article_id, allow_preview=True)

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
    article_in: ArticleUpdate = Body(...),
    article_type: str = Query("feed", pattern="^(feed|clipped)$", description="Article type: feed or clipped"),
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
    rss_service = RssOrchestrationService(db=db, user_id=UUID(current_user.sub))
    updated_article = await rss_service.update_article(
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
