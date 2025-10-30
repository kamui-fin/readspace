from typing import Any
from uuid import UUID

import structlog
from fastapi import APIRouter, Body, Depends, HTTPException, Query, status
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import ERROR_FEED_NOT_FOUND
from app.core.custom_exceptions import (
    FeedConnectionError,
    FeedParsingError,
    FeedSubscriptionError,
    FeedValidationError,
    NotFoundError,
)
from app.core.decorators import require_resource_limit
from app.db.session import get_db
from app.schemas.auth import TokenData
from app.schemas.rss_schemas import FeedCreate, FeedResponse, FeedUpdate
from app.schemas.subscription_schemas import (
    LegacyFeedResponse,
    SubscriptionCreateByFeedId,
    SubscriptionResponse,
)
from app.services.auth import get_current_user
from app.services.rss_service import RssOrchestrationService
from app.services.subscription_service import SubscriptionService

logger = structlog.get_logger(__name__)
router = APIRouter(prefix="/feeds", tags=["RSS Feeds"])


@router.post(
    "/{feed_id}/subscribe",
    response_model=SubscriptionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Subscribe to an existing feed",
    description="Subscribe to an RSS feed by its UUID without URL parsing or deduplication",
    responses={
        201: {
            "description": "Successfully subscribed to the feed",
            "model": SubscriptionResponse,
        },
        400: {
            "description": "Bad request - already subscribed to this feed or validation error",
            "content": {
                "application/json": {
                    "examples": {
                        "already_subscribed": {
                            "summary": "Already subscribed",
                            "value": {"detail": "Already subscribed to this feed"},
                        },
                        "validation_error": {
                            "summary": "Validation error",
                            "value": {"detail": "Feed validation failed"},
                        },
                    }
                }
            },
        },
        404: {
            "description": "Feed not found",
            "content": {"application/json": {"example": {"detail": "Feed not found"}}},
        },
        422: {"description": "Validation error in request body"},
        429: {"description": "Too many subscriptions - resource limit exceeded"},
        500: {"description": "Internal server error"},
    },
)
@require_resource_limit("max_subscriptions")
async def subscribe_to_feed(
    *,
    feed_id: UUID,
    subscription_data: SubscriptionCreateByFeedId = Body(
        ..., description="Subscription configuration including folder assignment"
    ),
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
) -> SubscriptionResponse:
    """
    Subscribe to an existing RSS feed by its UUID.

    This endpoint allows users to subscribe to a feed that already exists in the global
    feeds table without triggering URL parsing or deduplication logic. This is useful
    for subscribing to feeds discovered through the feed discovery system.

    Args:
        feed_id: UUID of the existing feed to subscribe to
        subscription_data: Configuration for the subscription including folder assignment
        db: Database session dependency
        current_user: Authenticated user information

    Returns:
        SubscriptionResponse: Complete subscription details including feed and folder info

    Raises:
        HTTPException:
            - 400: If user is already subscribed to this feed or validation fails
            - 404: If the feed doesn't exist
            - 429: If user has reached maximum subscription limit
            - 500: If an unexpected error occurs during subscription creation

    Note:
        - Requires authentication
        - Subject to max_subscriptions resource limit
        - Creates a direct subscription without URL validation
    """
    subscription_service = SubscriptionService(db=db, user_id=UUID(current_user.sub))

    try:
        # First, we need to get the feed's URL to create the subscription
        # The subscription service expects a URL, but we want to bypass deduplication
        RssOrchestrationService(db=db, user_id=UUID(current_user.sub))

        # Check if the feed exists in the global feeds table
        from app.crud import crud_feed

        feed = await crud_feed.get_feed_by_id(db, feed_id=feed_id)
        if not feed:
            logger.warning(
                "Feed not found for subscription",
                feed_id=feed_id,
                user_id=current_user.sub,
            )
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=ERROR_FEED_NOT_FOUND)

        # Check if user is already subscribed to this feed
        from app.crud import crud_subscription

        existing_subscription = await crud_subscription.get_subscription_by_feed_id(
            db, feed_id=feed_id, user_id=UUID(current_user.sub)
        )
        if existing_subscription:
            logger.warning(
                "User already subscribed to feed",
                feed_id=feed_id,
                user_id=current_user.sub,
            )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Already subscribed to this feed",
            )

        # Create subscription directly using the feed's URL
        subscription = await subscription_service.create_subscription(
            url=str(feed.url),
            folder_id=subscription_data.folder_id,
        )

        logger.info(
            "Feed subscription created successfully",
            subscription_id=subscription.id,
            feed_id=feed_id,
            user_id=current_user.sub,
            folder_id=subscription_data.folder_id,
        )
        return subscription

    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except (FeedValidationError, FeedSubscriptionError, NotFoundError) as e:
        logger.warning(
            "Failed to create subscription due to validation error",
            error=str(e),
            user_id=current_user.sub,
            feed_id=feed_id,
        )
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e
    except Exception as e:
        logger.error(
            "Unexpected error creating feed subscription",
            error=str(e),
            exc_info=True,
            feed_id=feed_id,
            user_id=current_user.sub,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred.",
        ) from e


@router.post(
    "/",
    response_model=LegacyFeedResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Add a new RSS feed",
    description="Add a new RSS feed by URL with automatic parsing, validation, and subscription creation",
    responses={
        201: {
            "description": "Successfully added and subscribed to the feed",
            "model": LegacyFeedResponse,
        },
        400: {
            "description": "Bad request - invalid feed URL, parsing error, or validation failure",
            "content": {
                "application/json": {
                    "examples": {
                        "invalid_url": {"summary": "Invalid feed URL", "value": {"detail": "Invalid RSS feed URL"}},
                        "parsing_error": {
                            "summary": "Feed parsing failed",
                            "value": {"detail": "Could not parse RSS feed content"},
                        },
                    }
                }
            },
        },
        422: {"description": "Validation error in request body"},
        429: {"description": "Too many subscriptions - resource limit exceeded"},
        503: {
            "description": "Service unavailable - could not connect to feed URL",
            "content": {
                "application/json": {"example": {"detail": "Could not connect to feed URL: Connection timeout"}}
            },
        },
        500: {"description": "Internal server error"},
    },
)
@require_resource_limit("max_subscriptions")
async def add_new_feed(
    *,
    db: AsyncSession = Depends(get_db),
    feed_in: FeedCreate = Body(..., description="Feed URL and folder assignment for the new subscription"),
    current_user: TokenData = Depends(get_current_user),
) -> LegacyFeedResponse:
    """
    Add a new RSS feed by URL with automatic parsing and subscription creation.

    This endpoint performs the complete workflow of adding a new RSS feed:
    1. Validates and fetches the RSS feed from the provided URL
    2. Parses feed metadata (title, description, etc.)
    3. Creates or finds existing feed in global feeds table
    4. Creates user subscription with specified folder assignment
    5. Returns complete feed information for immediate use

    Args:
        feed_in: Feed creation data including URL and folder assignment
        db: Database session dependency
        current_user: Authenticated user information

    Returns:
        LegacyFeedResponse: Complete feed details with subscription information

    Raises:
        HTTPException:
            - 400: Invalid feed URL, parsing errors, or validation failures
            - 429: User has reached maximum subscription limit
            - 503: Cannot connect to the feed URL (network/server issues)
            - 500: Unexpected error during feed processing

    Note:
        - Requires authentication
        - Subject to max_subscriptions resource limit
        - Performs full feed validation and content parsing
        - Automatically handles feed deduplication
    """
    rss_service = RssOrchestrationService(db=db, user_id=UUID(current_user.sub))
    try:
        # Tags are now handled as ARRAY field on feeds - no tag_ids processing needed
        feed = await rss_service.add_new_feed(
            url=str(feed_in.url),
            folder_id=feed_in.folder_id,
            tag_names=None,
        )
        logger.info(
            "Feed added successfully",
            feed_id=feed.id,
            user_id=current_user.sub,
            url=feed_in.url,
        )
        return feed
    except (FeedValidationError, FeedSubscriptionError, NotFoundError) as e:
        logger.warning(
            "Failed to add feed due to validation error",
            error=str(e),
            user_id=current_user.sub,
            url=feed_in.url,
        )
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e
    except FeedConnectionError as e:
        logger.error(
            "Connection error adding feed",
            error=str(e),
            user_id=current_user.sub,
            url=feed_in.url,
        )
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Could not connect to feed URL: {e}",
        ) from e
    except HTTPException:
        # Re-raise HTTP exceptions (like tag not found)
        raise
    except Exception as e:
        logger.error("Unexpected error adding new feed", error=str(e), exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred.",
        ) from e


@router.get(
    "/trending",
    response_model=list[FeedResponse],
    summary="Get trending RSS feeds",
    description="Retrieve popular RSS feeds sorted by popularity score for discovery",
    responses={
        200: {
            "description": "Successfully retrieved trending feeds",
            "model": list[FeedResponse],
        },
        401: {
            "description": "Unauthorized - authentication required",
            "content": {"application/json": {"example": {"detail": "Authentication required"}}},
        },
        422: {"description": "Validation error in query parameters"},
    },
)
async def get_trending_feeds(
    language: str = Query("en", description="Language code for filtering feeds (e.g., 'en', 'es')"),
    limit: int = Query(10, ge=1, le=100, description="Maximum number of trending feeds to return (1-100)"),
    category: str | None = Query(None, description="Optional feed category to filter by"),
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
) -> list[FeedResponse]:
    """
    Retrieve trending RSS feeds sorted by popularity score.

    This endpoint returns the most popular feeds on the platform, sorted by their
    popularity score in descending order. It can be filtered by language and category
    to help users discover popular feeds relevant to their interests.

    Args:
        language: Language code for filtering (default: 'en')
        limit: Maximum number of results to return (default: 10, max: 100)
        category: Optional feed category to filter by (e.g., 'Technology & Programming')
        db: Database session dependency
        current_user: Authenticated user information

    Returns:
        list[FeedResponse]: List of trending feeds with metadata and relevance scores

    Note:
        - Requires authentication
        - Results are sorted by popularity_score in descending order
        - Feeds with null popularity scores are placed at the end
        - Relevance scores are calculated based on rank position
    """
    from app.services.rss_search_service import RssSearchService

    try:
        search_service = RssSearchService(db=db)
        trending_feeds = await search_service.get_trending_feeds(
            language=language,
            limit=limit,
            category=category,
        )

        logger.info(
            "Trending feeds retrieved successfully",
            user_id=current_user.sub,
            language=language,
            category=category,
            results_count=len(trending_feeds),
        )

        # Convert to FeedResponse format
        # The trending_feeds already have the correct structure from the search service
        return trending_feeds

    except Exception as e:
        logger.error(
            "Error retrieving trending feeds",
            error=str(e),
            user_id=current_user.sub,
            language=language,
            category=category,
            exc_info=True,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred while retrieving trending feeds.",
        ) from e


@router.get(
    "/",
    response_model=list[FeedResponse],
    summary="List user's RSS feeds",
    description="Retrieve all RSS feeds the user is subscribed to with optional filtering and pagination",
    responses={
        200: {
            "description": "Successfully retrieved feeds list",
            "model": list[FeedResponse],
        },
        400: {
            "description": "Bad request - invalid query parameters",
            "content": {"application/json": {"example": {"detail": "Invalid folder_id format"}}},
        },
        422: {"description": "Validation error in query parameters"},
    },
)
async def list_feeds(
    db: AsyncSession = Depends(get_db),
    folder_id: UUID | None = Query(None, description="Filter feeds by folder ID"),
    tag_names: list[str] | None = Query(
        None,
        description="Filter feeds by a list of tag names (case-insensitive, matches all provided tags)",
    ),
    is_favorite: bool | None = Query(None, description="Filter feeds by favorite status"),
    search_query: str | None = Query(None, description="Search query for feed titles and descriptions"),
    skip: int = Query(0, ge=0, description="Number of feeds to skip for pagination"),
    limit: int = Query(100, ge=1, le=200, description="Maximum number of feeds to return (1-200)"),
    current_user: TokenData = Depends(get_current_user),
) -> list[FeedResponse]:
    """
    Retrieve all RSS feeds the authenticated user is subscribed to.

    This endpoint provides a comprehensive list of the user's RSS feed subscriptions
    with powerful filtering and search capabilities. Results are paginated and
    include subscription-specific metadata like unread counts and folder assignments.

    Args:
        db: Database session dependency
        folder_id: Optional UUID to filter feeds by specific folder
        tag_names: Optional list of tag names to filter by (all tags must match)
        is_favorite: Optional boolean to filter by favorite status
        search_query: Optional text search in feed titles and descriptions
        skip: Number of results to skip for pagination (default: 0)
        limit: Maximum results to return, capped at 200 (default: 100)
        current_user: Authenticated user information

    Returns:
        list[FeedResponse]: List of feed objects with subscription metadata

    Filtering Examples:
        - Get feeds in specific folder: `?folder_id=123e4567-e89b-12d3-a456-426614174000`
        - Get favorite feeds only: `?is_favorite=true`
        - Search by title: `?search_query=tech news`
        - Filter by tags: `?tag_names=technology&tag_names=programming`
        - Combine filters: `?folder_id=123&is_favorite=true&limit=50`

    Note:
        - Requires authentication
        - Returns only feeds the user is subscribed to
        - Tag filtering uses AND logic (all specified tags must match)
        - Search is case-insensitive and searches titles and descriptions
    """
    rss_service = RssOrchestrationService(db=db, user_id=UUID(current_user.sub))
    feeds = await rss_service.list_feeds(
        folder_id=folder_id,
        tag_names=tag_names,
        is_favorite=is_favorite,
        search_query=search_query,
        skip=skip,
        limit=limit,
    )
    return feeds


@router.get(
    "/{feed_id}",
    response_model=FeedResponse,
    summary="Get a specific RSS feed",
    description="Retrieve detailed information about a specific RSS feed by its UUID",
    responses={
        200: {
            "description": "Successfully retrieved feed details",
            "model": FeedResponse,
        },
        404: {
            "description": "Feed not found or user not subscribed to this feed",
            "content": {"application/json": {"example": {"detail": "Feed not found"}}},
        },
        422: {"description": "Invalid feed ID format"},
    },
)
async def get_feed(
    feed_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
) -> FeedResponse:
    """
    Retrieve detailed information about a specific RSS feed.

    This endpoint returns comprehensive information about a single RSS feed,
    including feed metadata, subscription details, and current status. The user
    must be subscribed to the feed to access its details.

    Args:
        feed_id: UUID of the feed to retrieve
        db: Database session dependency
        current_user: Authenticated user information

    Returns:
        FeedResponse: Complete feed details including subscription metadata

    Raises:
        HTTPException:
            - 404: Feed not found or user is not subscribed to this feed
            - 422: Invalid UUID format for feed_id

    Note:
        - Requires authentication
        - User must be subscribed to the feed to access its details
        - Returns subscription-specific metadata like folder assignment
        - Includes feed status information (last fetched, error state, etc.)
    """
    rss_service = RssOrchestrationService(db=db, user_id=UUID(current_user.sub))
    feed = await rss_service.get_feed(feed_id=feed_id)
    if not feed:
        logger.warning("Feed not found or access denied", feed_id=feed_id, user_id=current_user.sub)
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=ERROR_FEED_NOT_FOUND)
    return feed


@router.put(
    "/{feed_id}",
    response_model=FeedResponse,
    summary="Update feed settings",
    description="Update user-configurable settings for an RSS feed subscription",
    responses={
        200: {
            "description": "Successfully updated feed settings",
            "model": FeedResponse,
        },
        400: {
            "description": "Bad request - validation error in update data",
            "content": {
                "application/json": {
                    "examples": {
                        "invalid_folder": {
                            "summary": "Invalid folder ID",
                            "value": {"detail": "Folder not found or access denied"},
                        },
                        "validation_error": {
                            "summary": "Field validation failed",
                            "value": {"detail": "Title must be less than 500 characters"},
                        },
                    }
                }
            },
        },
        404: {
            "description": "Feed not found or user not subscribed to this feed",
            "content": {"application/json": {"example": {"detail": "Feed not found"}}},
        },
        422: {"description": "Validation error in request body or invalid feed ID format"},
        500: {"description": "Internal server error"},
    },
)
async def update_feed_settings(
    feed_id: UUID,
    feed_in: FeedUpdate = Body(..., description="Feed settings to update (all fields optional)"),
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
) -> FeedResponse:
    """
    Update user-configurable settings for an RSS feed subscription.

    This endpoint allows users to modify their personal settings for a subscribed
    RSS feed without affecting the global feed data. Users can update folder
    assignment, custom title, favorite status, and other subscription preferences.

    Args:
        feed_id: UUID of the feed subscription to update
        feed_in: Feed update data with optional fields to modify
        db: Database session dependency
        current_user: Authenticated user information

    Returns:
        FeedResponse: Updated feed details with new settings applied

    Updatable Fields:
        - folder_id: Move feed to different folder
        - title: Custom title override for the feed
        - description: Custom description override
        - language: Feed language preference
        - image_url: Custom image URL override
        - ttl: Custom refresh interval (minutes)
        - skip_hours: Hours to skip when fetching (0-23)
        - skip_days: Days to skip when fetching

    Raises:
        HTTPException:
            - 400: Validation error (invalid folder, title too long, etc.)
            - 404: Feed not found or user not subscribed
            - 422: Invalid request format or feed ID
            - 500: Unexpected error during update

    Note:
        - Requires authentication
        - User must be subscribed to the feed to update it
        - All fields in the request body are optional
        - Only affects user's subscription, not the global feed data
    """
    rss_service = RssOrchestrationService(db=db, user_id=UUID(current_user.sub))
    try:
        updated_feed = await rss_service.update_feed_user_settings(feed_id=feed_id, feed_in=feed_in)
        if not updated_feed:
            logger.warning(
                "Feed not found for update or access denied",
                feed_id=feed_id,
                user_id=current_user.sub,
            )
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=ERROR_FEED_NOT_FOUND)
        logger.info(
            "Feed settings updated successfully",
            feed_id=updated_feed.id,
            user_id=current_user.sub,
        )
        return updated_feed
    except (FeedValidationError, FeedSubscriptionError, NotFoundError) as e:
        logger.warning(f"Validation error updating feed {feed_id} for user {current_user.sub}: {e}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e
    except Exception as e:
        logger.error(
            "Unexpected error updating feed settings",
            error=str(e),
            user_id=current_user.sub,
            feed_id=feed_id,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred.",
        ) from e


@router.post(
    "/refresh_all",
    response_model=dict[str, Any],
    summary="Refresh all user feeds",
    description="Trigger a background refresh of all feeds the user is subscribed to",
    responses={
        200: {
            "description": "Successfully initiated bulk feed refresh",
            "content": {
                "application/json": {
                    "examples": {
                        "success": {
                            "summary": "Refresh started",
                            "value": {
                                "task_id": "abc123-def456-ghi789",
                                "message": "Bulk feed refresh started",
                                "total_feeds": 25,
                            },
                        }
                    }
                }
            },
        },
        500: {
            "description": "Internal server error starting refresh",
            "content": {"application/json": {"example": {"detail": "Could not start feed refresh"}}},
        },
    },
)
async def refresh_all_feeds(
    force_refetch: bool = Query(
        False,
        description="Force refetch even if not modified based on ETag/Last-Modified headers",
    ),
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
) -> dict[str, Any]:
    """
    Trigger a background refresh of all feeds the user is subscribed to.

    This endpoint initiates a bulk refresh operation for all feeds in the user's
    subscription list. Each feed is queued as a separate background task for
    parallel processing to improve performance and reliability.

    Args:
        force_refetch: If True, ignores ETag/Last-Modified headers and forces full refetch
        db: Database session dependency
        current_user: Authenticated user information

    Returns:
        dict: Task information including task_id for tracking progress

    Refresh Process:
        1. Retrieves all feeds the user is subscribed to
        2. Queues individual refresh tasks for each feed
        3. Returns a task ID for monitoring progress
        4. Tasks are processed asynchronously in the background

    Note:
        - Requires authentication
        - Only refreshes feeds the user is subscribed to
        - Returns immediately with task ID - use refresh status endpoint to monitor
        - Large subscription lists are processed efficiently in parallel
        - Force refetch bypasses HTTP caching for immediate updates
    """
    try:
        rss_service = RssOrchestrationService(db=db, user_id=UUID(current_user.sub))

        # Get all feeds for the user
        user_feeds = await rss_service.list_feeds(limit=1000)  # Get all feeds

        if not user_feeds:
            logger.info(
                "No feeds to refresh for user",
                user_id=current_user.sub,
            )
            return {
                "task_id": None,
                "message": "No feeds found to refresh",
                "total_feeds": 0,
            }

        # Import the refresh task
        from app.workers.tasks import refresh_single_feed_task

        # Queue individual refresh tasks for each feed
        task_ids = []
        for feed in user_feeds:
            task = refresh_single_feed_task.delay(str(feed.id))
            task_ids.append(task.id)

        logger.info(
            "Queued bulk feed refresh tasks",
            user_id=current_user.sub,
            total_feeds=len(user_feeds),
            total_tasks=len(task_ids),
        )

        # For now, return the first task ID as a representative
        # In the future, we could create a parent orchestration task
        representative_task_id = task_ids[0] if task_ids else None

        return {
            "task_id": representative_task_id,
            "message": "Bulk feed refresh started",
            "total_feeds": len(user_feeds),
        }

    except Exception as e:
        logger.error(
            "Error starting bulk feed refresh",
            error=str(e),
            user_id=current_user.sub,
            exc_info=True,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not start feed refresh",
        ) from e


@router.post(
    "/{feed_id}/refresh",
    response_model=FeedResponse,
    summary="Refresh RSS feed",
    description="Manually trigger a refresh of a specific RSS feed to fetch new articles",
    responses={
        200: {
            "description": "Successfully triggered/completed feed refresh",
            "model": FeedResponse,
        },
        400: {
            "description": "Bad request - feed validation or parsing error",
            "content": {
                "application/json": {
                    "examples": {
                        "parsing_error": {
                            "summary": "Feed parsing failed",
                            "value": {"detail": "Invalid RSS/XML format"},
                        },
                        "validation_error": {
                            "summary": "Feed validation failed",
                            "value": {"detail": "Feed content validation failed"},
                        },
                    }
                }
            },
        },
        404: {
            "description": "Feed not found or user not subscribed (unless preview mode)",
            "content": {"application/json": {"example": {"detail": "Feed not found"}}},
        },
        422: {"description": "Invalid feed ID format or query parameters"},
        503: {
            "description": "Service unavailable - could not connect to feed URL",
            "content": {
                "application/json": {
                    "example": {"detail": "Could not connect to feed URL during refresh: Connection timeout"}
                }
            },
        },
        500: {"description": "Internal server error during feed refresh"},
    },
)
async def refresh_feed(
    feed_id: UUID,
    force_refetch: bool = Query(
        False,
        description="Force refetch even if not modified based on ETag/Last-Modified headers",
    ),
    preview: bool = Query(
        False,
        description="Preview mode - refresh feed without requiring user subscription",
    ),
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
) -> FeedResponse:
    """
    Manually trigger a refresh of a specific RSS feed to fetch new articles.

    This endpoint initiates an immediate refresh of the specified RSS feed,
    bypassing the normal scheduled refresh cycle. It fetches the latest content
    from the feed URL, parses new articles, and updates the database.

    Args:
        feed_id: UUID of the feed to refresh
        force_refetch: If True, ignores ETag/Last-Modified headers and forces full refetch
        preview: If True, allows refresh without user subscription (for feed preview)
        db: Database session dependency
        current_user: Authenticated user information

    Returns:
        FeedResponse: Updated feed details after refresh completion

    Refresh Process:
        1. Validates user access to the feed (unless preview mode)
        2. Fetches current feed content from the source URL
        3. Respects HTTP caching headers (ETag, Last-Modified) unless force_refetch=True
        4. Parses RSS/Atom content and extracts articles
        5. Updates feed metadata and adds new articles to database
        6. Returns updated feed information

    Raises:
        HTTPException:
            - 400: Feed parsing errors or content validation failures
            - 404: Feed not found or user not subscribed (unless preview mode)
            - 503: Network connectivity issues or feed server unavailable
            - 500: Unexpected errors during refresh process

    Note:
        - Requires authentication
        - In normal mode, user must be subscribed to refresh the feed
        - Preview mode allows refreshing any feed for evaluation
        - Force refetch bypasses HTTP caching for immediate updates
        - Refresh is synchronous and may take several seconds for large feeds
    """
    rss_service = RssOrchestrationService(db=db, user_id=UUID(current_user.sub))
    try:
        refreshed_feed = await rss_service.refresh_feed(
            feed_id=feed_id, force_refetch=force_refetch, preview_mode=preview
        )
        if not refreshed_feed:
            logger.warning(
                "Feed not found for refresh or access denied",
                feed_id=feed_id,
                user_id=current_user.sub,
            )
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=ERROR_FEED_NOT_FOUND)
        logger.info(
            "Feed refresh triggered/completed",
            feed_id=refreshed_feed.id,
            user_id=current_user.sub,
        )
        return refreshed_feed
    except FeedConnectionError as e:
        logger.error(
            "Connection error refreshing feed",
            error=str(e),
            user_id=current_user.sub,
            feed_id=feed_id,
        )
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Could not connect to feed URL during refresh: {e}",
        ) from e
    except (FeedValidationError, FeedParsingError) as e:
        logger.warning(
            "Validation/parsing error during feed refresh",
            error=str(e),
            user_id=current_user.sub,
            feed_id=feed_id,
        )
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e
    except HTTPException:
        # Re-raise HTTP exceptions (like feed not found)
        raise
    except Exception as e:
        logger.error(
            "Unexpected error refreshing feed",
            error=str(e),
            user_id=current_user.sub,
            feed_id=feed_id,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred during feed refresh.",
        ) from e


@router.get(
    "/refresh_status/{task_id}",
    response_model=dict[str, Any],
    summary="Get background refresh status",
    description="Check the status of a background feed refresh task with detailed progress information",
    responses={
        200: {
            "description": "Successfully retrieved task status",
            "content": {
                "application/json": {
                    "examples": {
                        "pending": {
                            "summary": "Task pending",
                            "value": {
                                "task_id": "abc123",
                                "status": "pending",
                                "message": "Feed refresh is queued and waiting to start.",
                            },
                        },
                        "in_progress": {
                            "summary": "Task in progress",
                            "value": {
                                "task_id": "abc123",
                                "status": "in_progress",
                                "pagination": {
                                    "current_page": 1,
                                    "total_pages": 3,
                                    "page_size": 100,
                                    "total_tasks": 250,
                                    "has_more": True,
                                },
                                "result": {
                                    "page_refreshed_count": 45,
                                    "page_failed_count": 5,
                                    "page_completed_count": 50,
                                    "total_feeds": 250,
                                },
                            },
                        },
                        "completed": {
                            "summary": "Task completed",
                            "value": {
                                "task_id": "abc123",
                                "status": "completed",
                                "result": {
                                    "refreshed_count": 240,
                                    "failed_count": 10,
                                    "total_feeds": 250,
                                    "message": "Refresh completed successfully",
                                },
                            },
                        },
                    }
                }
            },
        },
        422: {"description": "Invalid task ID or query parameters"},
        500: {
            "description": "Error checking task status",
            "content": {"application/json": {"example": {"detail": "Could not check refresh status."}}},
        },
    },
)
async def get_refresh_status(
    task_id: str,
    page: int = Query(1, ge=1, description="Page number for paginated task checking (1-based)"),
    page_size: int = Query(100, ge=1, le=500, description="Number of tasks to check per page (1-500)"),
    current_user: TokenData = Depends(get_current_user),
) -> dict[str, Any]:
    """
    Check the status of a background feed refresh task with detailed progress tracking.

    This endpoint provides real-time status information for bulk feed refresh operations
    that are processed asynchronously. It supports pagination for large refresh jobs
    and provides detailed error reporting for failed feeds.

    Args:
        task_id: Unique identifier of the background refresh task
        page: Page number for pagination when checking large task batches (default: 1)
        page_size: Number of individual feed tasks to check per page (default: 100, max: 500)
        current_user: Authenticated user information

    Returns:
        dict: Task status information with pagination and progress details

    Response Structure:
        - task_id: Original task identifier
        - status: Current status (pending, in_progress, completed, failed)
        - pagination: Page information for large task batches
        - result: Detailed progress counts and error information
        - failed_feeds: List of feeds that failed with error categorization

    Task Status Values:
        - "pending": Task is queued and waiting to start
        - "in_progress": Task is actively processing feeds
        - "completed": All feeds have been processed (some may have failed)
        - "failed": Task failed completely (orchestration error)

    Error Categories:
        - "timeout": Feed server not responding
        - "not_found": Feed URL returns 404
        - "access_denied": Feed URL returns 403
        - "server_error": Feed server returns 5xx errors
        - "parse_error": Invalid RSS/XML format
        - "connection_error": Network connectivity issues
        - "data_error": Invalid data types in feed content
        - "other": Uncategorized errors

    Raises:
        HTTPException:
            - 422: Invalid task ID format or query parameters
            - 500: Error accessing task status or Redis connectivity issues

    Note:
        - Requires authentication
        - For large refresh jobs, use pagination to avoid timeouts
        - Failed feeds include detailed error categorization
        - Client should check all pages to determine overall completion
        - Task results are cached for efficiency
    """
    try:
        from app.core.celery_app import celery

        # Get orchestration task result
        orchestration_result = celery.AsyncResult(task_id)

        if orchestration_result.state == "PENDING":
            return {
                "task_id": task_id,
                "status": "pending",
                "message": "Feed refresh is queued and waiting to start.",
            }
        elif orchestration_result.state == "PROGRESS":
            return {
                "task_id": task_id,
                "status": "in_progress",
                "message": "Feed refresh is being processed and individual feeds are being queued.",
                "progress": orchestration_result.info,
            }
        elif orchestration_result.state == "SUCCESS":
            # Orchestration completed, now check individual feed refresh tasks
            orchestration_data = orchestration_result.result
            feed_task_ids = orchestration_data.get("task_ids", [])

            if not feed_task_ids:
                return {
                    "task_id": task_id,
                    "status": "completed",
                    "result": {
                        "refreshed_count": 0,
                        "failed_count": 0,
                        "total_feeds": 0,
                        "message": "No feeds found to refresh.",
                    },
                }

            # Implement pagination to handle large imports efficiently
            total_tasks = len(feed_task_ids)
            start_idx = (page - 1) * page_size
            end_idx = start_idx + page_size
            paginated_task_ids = feed_task_ids[start_idx:end_idx]

            # Calculate pagination info
            total_pages = (total_tasks + page_size - 1) // page_size
            has_more_pages = page < total_pages

            logger.info(
                "Checking status of individual feed refresh tasks (paginated)",
                total_tasks=total_tasks,
                current_page=page,
                total_pages=total_pages,
                tasks_this_page=len(paginated_task_ids),
                task_id=task_id,
            )

            # Check status of individual feed refresh tasks using batch operations
            completed_tasks = 0
            successful_refreshes = 0
            failed_refreshes = 0
            failed_feeds = []  # Track which feeds failed and why

            # Use Redis pipeline for efficient batch operations instead of individual calls
            from redis import Redis

            from app.core.config import get_settings

            settings = get_settings()

            # Get Redis connection from Celery backend
            redis_client = None
            if hasattr(celery, "backend") and hasattr(celery.backend, "client"):
                redis_client = celery.backend.client

            # Fallback to creating new Redis connection if needed
            if not redis_client:
                redis_client = Redis.from_url(settings.CELERY_BROKER_URL)

            # Batch fetch task states using Redis pipeline for efficiency (paginated)
            task_results = {}
            if redis_client:
                with redis_client.pipeline() as pipe:
                    # Batch get task results for current page only
                    for task_id in paginated_task_ids:
                        pipe.get(f"celery-task-meta-{task_id}")
                    results = pipe.execute()

                    # Parse results
                    import json

                    for task_id, result in zip(paginated_task_ids, results, strict=False):
                        if result:
                            try:
                                task_data = json.loads(result.decode("utf-8"))
                                task_results[task_id] = task_data.get("status", "PENDING")
                            except (json.JSONDecodeError, AttributeError):
                                task_results[task_id] = "PENDING"
                        else:
                            task_results[task_id] = "PENDING"
            else:
                # Fallback to individual calls if Redis pipeline fails
                task_results = {task_id: celery.AsyncResult(task_id).state for task_id in paginated_task_ids}

            # Process paginated task states efficiently
            for i, feed_task_id in enumerate(paginated_task_ids):
                task_state = task_results.get(feed_task_id, "PENDING")
                logger.debug(
                    "Checking feed refresh task",
                    task_index=i,
                    feed_task_id=feed_task_id,
                    state=task_state,
                )

                if task_state == "SUCCESS":
                    completed_tasks += 1
                    successful_refreshes += 1
                    logger.debug("Feed refresh task SUCCESS", feed_task_id=feed_task_id)
                elif task_state == "FAILURE":
                    completed_tasks += 1
                    failed_refreshes += 1

                    # Try to get detailed error information
                    error_info = {"task_id": feed_task_id, "error": "Unknown error"}
                    try:
                        # For failed tasks, we need to get the full task result for error details
                        feed_task_result = celery.AsyncResult(feed_task_id)
                        if hasattr(feed_task_result, "info") and feed_task_result.info:
                            error_str = str(feed_task_result.info)
                            # Categorize common errors for better user understanding
                            if "timeout" in error_str.lower() or "timed out" in error_str.lower():
                                error_info["error"] = "Feed timed out (server not responding)"
                                error_info["category"] = "timeout"
                            elif "404" in error_str or "not found" in error_str.lower():
                                error_info["error"] = "Feed not found (404)"
                                error_info["category"] = "not_found"
                            elif "403" in error_str or "forbidden" in error_str.lower():
                                error_info["error"] = "Access denied (403)"
                                error_info["category"] = "access_denied"
                            elif "500" in error_str or "502" in error_str or "503" in error_str:
                                error_info["error"] = "Server error"
                                error_info["category"] = "server_error"
                            elif "parse" in error_str.lower() or "xml" in error_str.lower():
                                error_info["error"] = "Invalid feed format"
                                error_info["category"] = "parse_error"
                            elif "connection" in error_str.lower():
                                error_info["error"] = "Connection failed"
                                error_info["category"] = "connection_error"
                            elif "invalid types" in error_str.lower() or "dataerror" in error_str.lower():
                                error_info["error"] = "Feed contains invalid data types"
                                error_info["category"] = "data_error"
                            else:
                                # Don't expose internal error details - provide generic message
                                error_info["error"] = "Feed refresh failed"
                                error_info["category"] = "other"
                    except Exception as e:
                        logger.debug(
                            "Could not extract detailed error info",
                            feed_task_id=feed_task_id,
                            error=str(e),
                        )

                    failed_feeds.append(error_info)
                    logger.debug(
                        "Feed refresh task FAILURE",
                        feed_task_id=feed_task_id,
                        error=error_info["error"],
                    )
                else:
                    logger.debug(
                        "Feed refresh task still processing",
                        feed_task_id=feed_task_id,
                        state=feed_task_result.state,
                    )

            total_feeds = len(feed_task_ids)

            # For pagination, we need to return page-specific information
            # The client needs to check all pages to determine overall completion

            logger.info(
                "Refresh task status summary (paginated)",
                page_completed=completed_tasks,
                page_tasks=len(paginated_task_ids),
                page_successful=successful_refreshes,
                page_failed=failed_refreshes,
                total_feeds=total_feeds,
                current_page=page,
                total_pages=total_pages,
            )

            # Return paginated results - client determines overall completion
            if len(paginated_task_ids) == 0:
                return {
                    "task_id": task_id,
                    "status": "completed",
                    "pagination": {
                        "current_page": page,
                        "total_pages": total_pages,
                        "page_size": page_size,
                        "total_tasks": total_feeds,
                        "has_more": has_more_pages,
                    },
                    "result": {
                        "page_refreshed_count": 0,
                        "page_failed_count": 0,
                        "page_completed_count": 0,
                        "total_feeds": total_feeds,
                        "message": "Page contains no tasks.",
                    },
                }

            # Always return in_progress for paginated results
            # Client must check all pages to determine completion
            result = {
                "task_id": task_id,
                "status": "in_progress",
                "pagination": {
                    "current_page": page,
                    "total_pages": total_pages,
                    "page_size": page_size,
                    "total_tasks": total_feeds,
                    "has_more": has_more_pages,
                },
                "result": {
                    "page_refreshed_count": successful_refreshes,
                    "page_failed_count": failed_refreshes,
                    "page_completed_count": completed_tasks,
                    "page_total_count": len(paginated_task_ids),
                    "total_feeds": total_feeds,
                    "summary": {
                        "page_successful": successful_refreshes,
                        "page_failed": failed_refreshes,
                        "page_pending": len(paginated_task_ids) - completed_tasks,
                    },
                },
            }

            # Include failed feeds details if any failed on this page
            if failed_feeds:
                result["result"]["failed_feeds"] = failed_feeds
                # Summarize error categories for this page
                error_categories: dict[str, int] = {}
                for failed_feed in failed_feeds:
                    category = failed_feed.get("category", "other")
                    error_categories[category] = error_categories.get(category, 0) + 1
                result["result"]["error_summary"] = error_categories

            return result
        elif orchestration_result.state == "FAILURE":
            return {
                "task_id": task_id,
                "status": "failed",
                "error": "Background task failed",
                "message": "Feed refresh failed. Please try again.",
            }
        else:
            return {
                "task_id": task_id,
                "status": orchestration_result.state.lower(),
                "message": f"Task is in state: {orchestration_result.state}",
            }

    except Exception as e:
        logger.error(
            "Error checking refresh task status",
            task_id=task_id,
            error=str(e),
            user_id=current_user.sub,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not check refresh status.",
        ) from e


@router.put(
    "/{feed_id}/admin",
    response_model=FeedResponse,
    summary="[Admin] Update global feed properties",
    description="Admin-only endpoint to update global feed metadata that affects all users",
    responses={
        200: {
            "description": "Successfully updated global feed",
            "model": FeedResponse,
        },
        403: {
            "description": "Forbidden - Admin access required",
            "content": {"application/json": {"example": {"detail": "Admin access required"}}},
        },
        404: {
            "description": "Feed not found",
            "content": {"application/json": {"example": {"detail": "Feed not found"}}},
        },
        422: {"description": "Validation error in request body or invalid feed ID format"},
    },
)
async def admin_update_feed(
    feed_id: UUID,
    feed_in: FeedUpdate = Body(..., description="Global feed properties to update (all fields optional)"),
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
) -> FeedResponse:
    """
    Update global feed properties (admin only).

    This endpoint allows administrators to modify the global feed metadata
    that affects all users subscribed to the feed. This includes fields like
    title, description, language, category, and image URL.

    Args:
        feed_id: UUID of the feed to update
        feed_in: Feed update data with optional fields to modify
        db: Database session dependency
        current_user: Authenticated user information (must be admin)

    Returns:
        FeedResponse: Updated feed details

    Updatable Fields:
        - title: Feed title
        - description: Feed description
        - language: Feed language code
        - top_level_category: Feed category classification
        - link: Feed website URL
        - image_url: Feed icon/logo URL
        - url: RSS feed URL

    Raises:
        HTTPException:
            - 403: User is not an admin
            - 404: Feed not found
            - 422: Invalid request format or feed ID

    Note:
        - Requires admin role
        - Updates affect all users subscribed to the feed
        - Changes are applied to the global feed record
    """
    # Check if user is admin by fetching their profile
    from app.crud.crud_profile import crud_profile

    user_profile = await crud_profile.get_by_id(db, user_id=UUID(current_user.sub))
    if not user_profile or user_profile.role != "admin":
        logger.warning(
            "Non-admin user attempted to update global feed",
            user_id=current_user.sub,
            user_role=user_profile.role if user_profile else None,
            feed_id=feed_id,
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )

    # Get the feed from the global feeds table
    from app.crud import crud_feed

    feed = await crud_feed.get_feed_by_id(db, feed_id=feed_id)
    if not feed:
        logger.warning(
            "Admin attempted to update non-existent feed",
            feed_id=feed_id,
            user_id=current_user.sub,
        )
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=ERROR_FEED_NOT_FOUND)

    # Update the feed metadata
    try:
        updated_feed = await crud_feed.update_feed_metadata(
            db,
            feed_db=feed,
            title=feed_in.title,
            description=feed_in.description,
            link=str(feed_in.link) if feed_in.link else None,
            language=feed_in.language,
            image_url=feed_in.image_url,
            ttl=feed_in.ttl,
            skip_hours=feed_in.skip_hours,
            skip_days=feed_in.skip_days,
        )

        # Handle top_level_category separately since it's an enum
        if feed_in.top_level_category is not None:
            from app.models.rss_models import FeedCategory

            # Convert string to enum if needed
            # The frontend sends the enum VALUE (e.g., "Design & Creativity")
            # We need to find the matching enum and assign the enum itself (not .value)
            if isinstance(feed_in.top_level_category, str):
                try:
                    category_enum = FeedCategory(feed_in.top_level_category)
                    # Assign the enum itself, not its value - SQLAlchemy handles conversion
                    updated_feed.top_level_category = category_enum
                except ValueError as e:
                    logger.warning(
                        "Invalid category provided",
                        category=feed_in.top_level_category,
                        feed_id=feed_id,
                    )
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Invalid category: {feed_in.top_level_category}",
                    ) from e
            else:
                # If it's already a FeedCategory enum, use it directly
                updated_feed.top_level_category = feed_in.top_level_category

            db.add(updated_feed)
            await db.commit()
            await db.refresh(updated_feed)

        # Handle popularity_score update
        if feed_in.popularity_score is not None:
            updated_feed.popularity_score = feed_in.popularity_score
            db.add(updated_feed)
            await db.commit()
            await db.refresh(updated_feed)

        # Handle URL update if provided
        if feed_in.url is not None:
            updated_feed.url = str(feed_in.url)
            db.add(updated_feed)
            await db.commit()
            await db.refresh(updated_feed)

        logger.info(
            "Admin updated global feed successfully",
            feed_id=updated_feed.id,
            user_id=current_user.sub,
        )

        # Return as FeedResponse
        rss_service = RssOrchestrationService(db=db, user_id=UUID(current_user.sub))
        return await rss_service.get_feed(feed_id=feed_id) or updated_feed

    except Exception as e:
        logger.error(
            "Error updating global feed",
            error=str(e),
            feed_id=feed_id,
            user_id=current_user.sub,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred.",
        ) from e


@router.delete(
    "/{feed_id}/admin",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="[Admin] Delete global feed",
    description="Admin-only endpoint to permanently delete a feed from the platform for all users",
    responses={
        204: {"description": "Successfully deleted global feed"},
        403: {
            "description": "Forbidden - Admin access required",
            "content": {"application/json": {"example": {"detail": "Admin access required"}}},
        },
        404: {
            "description": "Feed not found",
            "content": {"application/json": {"example": {"detail": "Feed not found"}}},
        },
        422: {"description": "Invalid feed ID format"},
    },
)
async def admin_delete_feed(
    feed_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
) -> JSONResponse:
    """
    Delete global feed (admin only).

    This endpoint allows administrators to permanently delete a feed from
    the entire platform. This will remove the feed and all its articles
    for ALL users subscribed to it.

    Args:
        feed_id: UUID of the feed to delete
        db: Database session dependency
        current_user: Authenticated user information (must be admin)

    Returns:
        JSONResponse: Empty response with 204 status code on success

    Raises:
        HTTPException:
            - 403: User is not an admin
            - 404: Feed not found
            - 422: Invalid feed ID format

    Note:
        - Requires admin role
        - Permanently deletes the feed for ALL users
        - Cascading deletion removes all associated articles and subscriptions
        - This action cannot be undone
    """
    # Check if user is admin by fetching their profile
    from app.crud.crud_profile import crud_profile

    user_profile = await crud_profile.get_by_id(db, user_id=UUID(current_user.sub))
    if not user_profile or user_profile.role != "admin":
        logger.warning(
            "Non-admin user attempted to delete global feed",
            user_id=current_user.sub,
            user_role=user_profile.role if user_profile else None,
            feed_id=feed_id,
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )

    # Check if feed exists first
    from sqlalchemy import select

    from app.models.rss_models import Feed

    result = await db.execute(select(Feed).where(Feed.id == feed_id))
    feed = result.scalar_one_or_none()

    if not feed:
        logger.warning(
            "Admin attempted to delete non-existent feed",
            feed_id=feed_id,
            user_id=current_user.sub,
        )
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=ERROR_FEED_NOT_FOUND)

    # Use raw SQL for efficient bulk deletion leveraging database cascades
    # This is much faster than ORM cascade which loads each related object individually
    from sqlalchemy import delete as sql_delete

    logger.info(
        "Admin deleting global feed with bulk SQL",
        feed_id=feed_id,
        user_id=current_user.sub,
    )

    # Delete the feed - database CASCADE will handle related records efficiently
    await db.execute(sql_delete(Feed).where(Feed.id == feed_id))
    await db.commit()

    logger.info(
        "Admin deleted global feed successfully",
        feed_id=feed_id,
        user_id=current_user.sub,
    )
    # Return 204 No Content without a response body
    from starlette.responses import Response

    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.delete(
    "/{feed_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete RSS feed subscription",
    description="Remove user's subscription to an RSS feed and delete associated user data",
    responses={
        204: {"description": "Successfully deleted feed subscription"},
        404: {
            "description": "Feed not found or user not subscribed to this feed",
            "content": {"application/json": {"example": {"detail": "Feed not found"}}},
        },
        422: {"description": "Invalid feed ID format"},
    },
)
async def delete_feed(
    feed_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
) -> JSONResponse:
    """
    Delete user's subscription to an RSS feed and remove associated user data.

    This endpoint removes the user's subscription to the specified RSS feed.
    It deletes the subscription record and any user-specific data associated
    with articles from this feed, including read status, favorites, and notes.

    Args:
        feed_id: UUID of the feed subscription to delete
        db: Database session dependency
        current_user: Authenticated user information

    Returns:
        JSONResponse: Empty response with 204 status code on success

    Deletion Effects:
        - Removes user's subscription to the feed
        - Deletes user-specific article states (read, favorite, notes)
        - Removes feed from user's folders and organization
        - Does NOT delete the global feed or articles (other users may be subscribed)
        - Cascading deletion handles related user data automatically

    Raises:
        HTTPException:
            - 404: Feed not found or user is not subscribed to this feed
            - 422: Invalid UUID format for feed_id

    Note:
        - Requires authentication
        - User must be subscribed to the feed to delete it
        - This is a user-specific deletion (unsubscribe)
        - Global feed data remains for other subscribers
        - Action is irreversible - user data cannot be recovered
        - Returns 204 No Content on successful deletion
    """
    rss_service = RssOrchestrationService(db=db, user_id=UUID(current_user.sub))
    success = await rss_service.delete_feed(feed_id=feed_id)
    if not success:
        logger.warning(
            "Feed not found for deletion or access denied",
            feed_id=feed_id,
            user_id=current_user.sub,
        )
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=ERROR_FEED_NOT_FOUND)
    logger.info("Feed deleted successfully", feed_id=feed_id, user_id=current_user.sub)
    return JSONResponse(status_code=status.HTTP_200_OK, content={"ok": True})


@router.post(
    "/bulk-delete",
    status_code=status.HTTP_200_OK,
    summary="Bulk delete feed subscriptions",
    description="Delete multiple feed subscriptions in a single operation",
    responses={
        200: {
            "description": "Bulk delete completed",
            "content": {
                "application/json": {
                    "example": {
                        "deleted_count": 5,
                        "deleted_ids": ["uuid1", "uuid2", "uuid3", "uuid4", "uuid5"],
                    }
                }
            },
        },
        400: {"description": "Invalid request - empty feed_ids list"},
        422: {"description": "Validation error in request body"},
    },
)
async def bulk_delete_feeds(
    *,
    feed_ids: list[UUID] = Body(..., embed=True, description="List of feed IDs to unsubscribe from"),
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
) -> dict[str, Any]:
    """
    Delete multiple feed subscriptions in a single operation.

    This endpoint allows bulk unsubscription from feeds, executing the deletion
    in a single database query for optimal performance. Only subscriptions owned
    by the authenticated user will be deleted.

    Args:
        feed_ids: List of feed UUIDs to unsubscribe from
        db: Database session dependency
        current_user: Authenticated user information

    Returns:
        Dictionary containing:
            - deleted_count: Number of subscriptions successfully deleted
            - deleted_ids: List of feed IDs that were deleted

    Raises:
        HTTPException:
            - 400: If feed_ids list is empty
            - 422: If feed_ids format is invalid

    Note:
        - Only user's own subscriptions are deleted (user_id verified)
        - Non-existent feed IDs are silently ignored
        - Cascading deletion handles related user data automatically
        - Operation is atomic (all succeed or all fail)
    """
    if not feed_ids:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="feed_ids list cannot be empty")

    from app.crud import crud_subscription

    result = await crud_subscription.delete_subscriptions_bulk(db=db, feed_ids=feed_ids, user_id=UUID(current_user.sub))

    logger.info(
        "Bulk delete feeds completed",
        deleted_count=len(result["deleted_ids"]),
        user_id=current_user.sub,
    )

    return {
        "deleted_count": len(result["deleted_ids"]),
        "deleted_ids": [str(fid) for fid in result["deleted_ids"]],
    }


@router.post(
    "/bulk-update-folder",
    status_code=status.HTTP_200_OK,
    summary="Bulk move feeds to folder",
    description="Move multiple feed subscriptions to a different folder in a single operation",
    responses={
        200: {
            "description": "Bulk update completed",
            "content": {
                "application/json": {
                    "example": {
                        "updated_count": 5,
                        "updated_ids": ["uuid1", "uuid2", "uuid3", "uuid4", "uuid5"],
                        "folder_id": "folder-uuid",
                    }
                }
            },
        },
        400: {"description": "Invalid request - empty feed_ids list"},
        404: {"description": "Target folder not found"},
        422: {"description": "Validation error in request body"},
    },
)
async def bulk_update_feeds_folder(
    *,
    feed_ids: list[UUID] = Body(..., description="List of feed IDs to move"),
    folder_id: UUID = Body(..., description="Target folder ID"),
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
) -> dict[str, Any]:
    """
    Move multiple feed subscriptions to a different folder in a single operation.

    This endpoint allows bulk folder reassignment for feeds, executing the update
    in a single database query for optimal performance. Only subscriptions owned
    by the authenticated user will be updated.

    Args:
        feed_ids: List of feed UUIDs to move
        folder_id: Target folder UUID
        db: Database session dependency
        current_user: Authenticated user information

    Returns:
        Dictionary containing:
            - updated_count: Number of subscriptions successfully moved
            - updated_ids: List of feed IDs that were moved
            - folder_id: The target folder ID

    Raises:
        HTTPException:
            - 400: If feed_ids list is empty
            - 404: If target folder doesn't exist or doesn't belong to user
            - 422: If feed_ids or folder_id format is invalid

    Note:
        - Verifies folder ownership before updating
        - Only user's own subscriptions are updated (user_id verified)
        - Non-existent feed IDs are silently ignored
        - Operation is atomic (all succeed or all fail)
    """
    if not feed_ids:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="feed_ids list cannot be empty")

    # Verify folder ownership
    from app.crud import crud_folder, crud_subscription

    folder = await crud_folder.get_folder(db, folder_id=folder_id, user_id=UUID(current_user.sub))
    if not folder:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Folder not found or does not belong to user",
        )

    result = await crud_subscription.update_subscriptions_folder_bulk(
        db=db, feed_ids=feed_ids, folder_id=folder_id, user_id=UUID(current_user.sub)
    )

    logger.info(
        "Bulk update feeds folder completed",
        updated_count=len(result["updated_ids"]),
        folder_id=folder_id,
        user_id=current_user.sub,
    )

    return {
        "updated_count": len(result["updated_ids"]),
        "updated_ids": [str(fid) for fid in result["updated_ids"]],
        "folder_id": str(folder_id),
    }
