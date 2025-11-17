import time
from typing import Any
from uuid import UUID

import structlog
from fastapi import APIRouter, Body, Depends, HTTPException, Query, status
from fastapi.responses import JSONResponse
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.business_metrics import user_actions_total
from app.core.constants import ERROR_FEED_NOT_FOUND, MAX_PAGE_SIZE
from app.core.custom_exceptions import (
    FeedConnectionError,
    FeedParsingError,
    FeedSubscriptionError,
    FeedValidationError,
    NotFoundError,
    ReadspaceException,
    to_http_exception,
)
from app.core.decorators import require_resource_limit
from app.core.dependencies import get_subscription_service
from app.core.metrics import feed_operation_duration_seconds, feed_operations_total
from app.crud import crud_feed, crud_folder, crud_profile, crud_subscription
from app.db.session import get_db
from app.models import ArticleContent, Feed, FeedArticle
from app.schemas import FeedCreate, FeedUpdate
from app.schemas.auth import TokenData
from app.schemas.subscriptions import (
    FeedResponse,
    SubscriptionCreateByFeedId,
    SubscriptionResponse,
)
from app.services.feeds.feed_management import FeedManagementService
from app.services.feeds.search.search_engine import RssSearchService
from app.services.subscription import SubscriptionService
from app.services.user.auth import get_current_user
from app.services.user.resource_limits import ResourceLimitService

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
async def subscribe_to_feed(
    *,
    feed_id: UUID,
    subscription_data: SubscriptionCreateByFeedId = Body(
        ..., description="Subscription configuration including folder assignment"
    ),
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
    subscription_service: SubscriptionService = Depends(get_subscription_service),
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
        subscription_service: Injected subscription service

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
    start_time = time.perf_counter()

    # SECURITY: Check feed existence BEFORE checking resource limits to prevent feed ID enumeration
    feed = await crud_feed.get_feed_by_id(db, feed_id=feed_id)
    if not feed:
        logger.warning(
            "Feed not found for subscription",
            feed_id=feed_id,
            user_id=current_user.sub,
        )
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=ERROR_FEED_NOT_FOUND)

    # Now check resource limits after verifying the feed exists
    profile = await crud_profile.get_by_id(db, user_id=UUID(current_user.sub))
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User profile not found",
        )

    resource_service = ResourceLimitService(db)
    can_proceed = await resource_service.check_limit(UUID(current_user.sub), "max_subscriptions", str(profile.role))

    if not can_proceed:
        limits = resource_service.get_user_limits(str(profile.role))
        current_usage = await resource_service.get_current_usage(UUID(current_user.sub), "max_subscriptions")

        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Resource limit exceeded for max_subscriptions. "
            f"Current usage: {current_usage}/{limits.get('max_subscriptions', 0)}",
        )

    try:
        # Create subscription directly using the feed ID
        subscription = await subscription_service.create_subscription_by_feed_id(
            feed_id=feed_id,
            folder_id=subscription_data.folder_id,
        )

        # Record success metrics
        duration = time.perf_counter() - start_time
        feed_operations_total.labels(operation="subscribe", status="success").inc()
        feed_operation_duration_seconds.labels(operation="subscribe").observe(duration)
        user_actions_total.labels(action="subscribe").inc()

        logger.info(
            "Feed subscription created successfully",
            subscription_id=subscription.id,
            feed_id=feed_id,
            user_id=current_user.sub,
            folder_id=subscription_data.folder_id,
            duration_seconds=round(duration, 3),
        )
        return subscription

    except HTTPException:
        # Record metrics for HTTP exceptions
        duration = time.perf_counter() - start_time
        feed_operations_total.labels(operation="subscribe", status="http_error").inc()
        feed_operation_duration_seconds.labels(operation="subscribe").observe(duration)
        # Re-raise HTTP exceptions from downstream handlers
        raise
    except ReadspaceException as e:
        # Record metrics for business logic failures
        duration = time.perf_counter() - start_time
        feed_operations_total.labels(operation="subscribe", status="validation_error").inc()
        feed_operation_duration_seconds.labels(operation="subscribe").observe(duration)

        # Convert custom exceptions to HTTP exceptions using mapper
        logger.warning(
            "Failed to create subscription",
            error=str(e),
            error_type=type(e).__name__,
            user_id=current_user.sub,
            feed_id=feed_id,
            duration_seconds=round(duration, 3),
        )
        raise to_http_exception(e) from e
    except Exception as e:
        # Record metrics for unexpected errors
        duration = time.perf_counter() - start_time
        feed_operations_total.labels(operation="subscribe", status="error").inc()
        feed_operation_duration_seconds.labels(operation="subscribe").observe(duration)

        # Catch-all for unexpected errors
        logger.error(
            "Unexpected error creating feed subscription",
            error=str(e),
            exc_info=True,
            feed_id=feed_id,
            user_id=current_user.sub,
            duration_seconds=round(duration, 3),
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred.",
        ) from e


@router.post(
    "/",
    response_model=SubscriptionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Add a new RSS feed",
    description="Add a new RSS feed by URL with automatic parsing, validation, and subscription creation",
    responses={
        201: {
            "description": "Successfully added and subscribed to the feed",
            "model": SubscriptionResponse,
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
) -> SubscriptionResponse:
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
        SubscriptionResponse: Complete subscription details including feed information

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
    start_time = time.perf_counter()
    feed_service = FeedManagementService(db=db, user_id=UUID(current_user.sub))
    try:
        feed = await feed_service.add_new_feed(
            url=str(feed_in.url),
            folder_id=feed_in.folder_id,
            tag_names=None,
        )

        # Record success metrics
        duration = time.perf_counter() - start_time
        feed_operations_total.labels(operation="add_new_feed", status="success").inc()
        feed_operation_duration_seconds.labels(operation="add_new_feed").observe(duration)
        user_actions_total.labels(action="subscribe").inc()

        logger.info(
            "Feed added successfully",
            feed_id=feed.id,
            user_id=current_user.sub,
            url=feed_in.url,
            duration_seconds=round(duration, 3),
        )
        return feed
    except HTTPException:
        # Record metrics for HTTP exceptions
        duration = time.perf_counter() - start_time
        feed_operations_total.labels(operation="add_new_feed", status="http_error").inc()
        feed_operation_duration_seconds.labels(operation="add_new_feed").observe(duration)
        # Re-raise HTTP exceptions from downstream handlers
        raise
    except ReadspaceException as e:
        # Record metrics for business logic failures
        duration = time.perf_counter() - start_time
        feed_operations_total.labels(operation="add_new_feed", status="validation_error").inc()
        feed_operation_duration_seconds.labels(operation="add_new_feed").observe(duration)

        # Convert custom exceptions to HTTP exceptions using mapper
        logger.warning(
            "Failed to add feed",
            error=str(e),
            error_type=type(e).__name__,
            user_id=current_user.sub,
            url=feed_in.url,
            duration_seconds=round(duration, 3),
        )
        raise to_http_exception(e) from e
    except Exception as e:
        # Record metrics for unexpected errors
        duration = time.perf_counter() - start_time
        feed_operations_total.labels(operation="add_new_feed", status="error").inc()
        feed_operation_duration_seconds.labels(operation="add_new_feed").observe(duration)

        # Catch-all for unexpected errors
        logger.error(
            "Unexpected error adding new feed",
            error=str(e),
            exc_info=True,
            user_id=current_user.sub,
            url=feed_in.url,
            duration_seconds=round(duration, 3),
        )
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
    limit: int = Query(10, ge=1, le=MAX_PAGE_SIZE, description="Maximum number of trending feeds to return"),
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
    skip: int = Query(0, ge=0, description="Number of feeds to skip for pagination"),
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
        current_user: Authenticated user information

    Returns:
        list[FeedResponse]: List of feed objects with subscription metadata

    Filtering Examples:
        - Get feeds in specific folder: `?folder_id=123e4567-e89b-12d3-a456-426614174000`
        - Get favorite feeds only: `?is_favorite=true`
        - Filter by tags: `?tag_names=technology&tag_names=programming`
        - Combine filters: `?folder_id=123&is_favorite=true`

    Note:
        - Requires authentication
        - Returns only feeds the user is subscribed to
        - Tag filtering uses AND logic (all specified tags must match)
    """
    feed_service = FeedManagementService(db=db, user_id=UUID(current_user.sub))
    feeds = await feed_service.list_feeds(
        folder_id=folder_id,
        tag_names=tag_names,
        is_favorite=is_favorite,
        skip=skip,
        include_unread_counts=True,  # Always include unread counts
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
    including feed metadata and subscription status. Any authenticated user can
    view any feed, not just subscribed feeds. The response includes an
    `is_subscribed` field indicating the user's subscription status.

    Args:
        feed_id: UUID of the feed to retrieve
        db: Database session dependency
        current_user: Authenticated user information

    Returns:
        FeedResponse: Complete feed details with subscription status

    Raises:
        HTTPException:
            - 404: Feed not found
            - 422: Invalid UUID format for feed_id

    Note:
        - Requires authentication
        - Any authenticated user can view any feed
        - Returns `is_subscribed: true` for subscribed feeds with subscription metadata
        - Returns `is_subscribed: false` for unsubscribed feeds (preview mode)
        - Subscription-specific fields (folder_id, is_favorite) only included when subscribed
    """
    feed_service = FeedManagementService(db=db, user_id=UUID(current_user.sub))
    feed = await feed_service.get_feed(feed_id=feed_id)
    if not feed:
        logger.warning("Feed not found", feed_id=feed_id, user_id=current_user.sub)
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=ERROR_FEED_NOT_FOUND)
    return feed


@router.put(
    "/{feed_id}",
    response_model=SubscriptionResponse,
    summary="Update feed settings",
    description="Update user-configurable settings for an RSS feed subscription",
    responses={
        200: {
            "description": "Successfully updated feed settings",
            "model": SubscriptionResponse,
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
) -> SubscriptionResponse:
    """
    Update user-configurable settings for an RSS feed subscription.

    This endpoint allows users to modify their personal subscription settings
    for an RSS feed without affecting the global feed data. Only subscription-specific
    fields can be updated through this endpoint.

    Args:
        feed_id: UUID of the feed subscription to update
        feed_in: Feed update data with optional fields to modify
        db: Database session dependency
        current_user: Authenticated user information

    Returns:
        SubscriptionResponse: Updated subscription details with new settings applied

    Updatable Fields:
        - title: Custom title override for this subscription (optional, max 500 chars)
        - folder_id: Move subscription to a different folder (UUID)
        - is_favorite: Toggle favorite status (boolean)

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
        - To update global feed properties (url, description, etc.), use the admin endpoint
    """
    feed_service = FeedManagementService(db=db, user_id=UUID(current_user.sub))
    try:
        updated_feed = await feed_service.update_feed_user_settings(feed_id=feed_id, feed_in=feed_in)
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
    except HTTPException:
        # Re-raise HTTP exceptions from downstream handlers
        raise
    except (FeedValidationError, FeedSubscriptionError, NotFoundError) as e:
        logger.warning(
            "Validation error updating feed",
            error=str(e),
            error_type=type(e).__name__,
            feed_id=feed_id,
            user_id=current_user.sub,
        )
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
    start_time = time.perf_counter()
    feed_service = FeedManagementService(db=db, user_id=UUID(current_user.sub))
    try:
        refreshed_feed = await feed_service.refresh_feed(
            feed_id=feed_id, force_refetch=force_refetch, preview_mode=preview
        )
        if not refreshed_feed:
            logger.warning(
                "Feed not found for refresh or access denied",
                feed_id=feed_id,
                user_id=current_user.sub,
            )
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=ERROR_FEED_NOT_FOUND)

        # Record success metrics
        duration = time.perf_counter() - start_time
        feed_operations_total.labels(operation="refresh", status="success").inc()
        feed_operation_duration_seconds.labels(operation="refresh").observe(duration)

        logger.info(
            "Feed refresh triggered/completed",
            feed_id=refreshed_feed.id,
            user_id=current_user.sub,
            duration_seconds=round(duration, 3),
        )
        return refreshed_feed
    except FeedConnectionError as e:
        # Record connection error metrics
        duration = time.perf_counter() - start_time
        feed_operations_total.labels(operation="refresh", status="connection_error").inc()
        feed_operation_duration_seconds.labels(operation="refresh").observe(duration)

        logger.error(
            "Connection error refreshing feed",
            error=str(e),
            user_id=current_user.sub,
            feed_id=feed_id,
            duration_seconds=round(duration, 3),
        )
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Could not connect to feed URL during refresh: {e}",
        ) from e
    except (FeedValidationError, FeedParsingError) as e:
        # Record validation/parsing error metrics
        duration = time.perf_counter() - start_time
        feed_operations_total.labels(operation="refresh", status="validation_error").inc()
        feed_operation_duration_seconds.labels(operation="refresh").observe(duration)

        logger.warning(
            "Validation/parsing error during feed refresh",
            error=str(e),
            user_id=current_user.sub,
            feed_id=feed_id,
            duration_seconds=round(duration, 3),
        )
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e
    except HTTPException:
        # Record metrics for HTTP exceptions
        duration = time.perf_counter() - start_time
        feed_operations_total.labels(operation="refresh", status="http_error").inc()
        feed_operation_duration_seconds.labels(operation="refresh").observe(duration)
        # Re-raise HTTP exceptions (like feed not found)
        raise
    except Exception as e:
        # Record metrics for unexpected errors
        duration = time.perf_counter() - start_time
        feed_operations_total.labels(operation="refresh", status="error").inc()
        feed_operation_duration_seconds.labels(operation="refresh").observe(duration)

        logger.error(
            "Unexpected error refreshing feed",
            error=str(e),
            user_id=current_user.sub,
            feed_id=feed_id,
            duration_seconds=round(duration, 3),
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred during feed refresh.",
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
    from app.models.enums import UserRole

    user_profile = await crud_profile.get_by_id(db, user_id=UUID(current_user.sub))
    if not user_profile or user_profile.role != UserRole.ADMIN:
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
            from app.models import FeedCategory

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
            await db.flush()
            await db.refresh(updated_feed)

        # Handle popularity_score update
        if feed_in.popularity_score is not None:
            updated_feed.popularity_score = feed_in.popularity_score
            db.add(updated_feed)
            await db.flush()
            await db.refresh(updated_feed)

        # Handle URL update if provided
        if feed_in.url is not None:
            updated_feed.url = str(feed_in.url)
            db.add(updated_feed)
            await db.flush()
            await db.refresh(updated_feed)

        logger.info(
            "Admin updated global feed successfully",
            feed_id=updated_feed.id,
            user_id=current_user.sub,
        )

        # Return as FeedResponse
        feed_service = FeedManagementService(db=db, user_id=UUID(current_user.sub))
        return await feed_service.get_feed(feed_id=feed_id) or updated_feed

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
    from app.models.enums import UserRole

    user_profile = await crud_profile.get_by_id(db, user_id=UUID(current_user.sub))
    if not user_profile or user_profile.role != UserRole.ADMIN:
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
    start_time = time.perf_counter()
    feed_service = FeedManagementService(db=db, user_id=UUID(current_user.sub))
    success = await feed_service.delete_feed(feed_id=feed_id)
    duration = time.perf_counter() - start_time

    if not success:
        feed_operations_total.labels(operation="unsubscribe", status="not_found").inc()
        feed_operation_duration_seconds.labels(operation="unsubscribe").observe(duration)

        logger.warning(
            "Feed not found for deletion or access denied",
            feed_id=feed_id,
            user_id=current_user.sub,
            duration_seconds=round(duration, 3),
        )
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=ERROR_FEED_NOT_FOUND)

    # Record success metrics
    feed_operations_total.labels(operation="unsubscribe", status="success").inc()
    feed_operation_duration_seconds.labels(operation="unsubscribe").observe(duration)
    user_actions_total.labels(action="unsubscribe").inc()

    logger.info(
        "Feed deleted successfully",
        feed_id=feed_id,
        user_id=current_user.sub,
        duration_seconds=round(duration, 3),
    )
    return JSONResponse(status_code=status.HTTP_200_OK, content={"ok": True})


@router.delete(
    "/",
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


@router.patch(
    "/folder",
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


@router.put(
    "/{feed_id}/read-status",
    status_code=status.HTTP_200_OK,
    summary="Mark all articles in a feed as read",
    description="Update the last_read_cutoff timestamp to mark all current articles in the feed as read",
    responses={
        200: {
            "description": "Successfully marked all articles as read",
            "content": {
                "application/json": {
                    "example": {
                        "message": "All articles marked as read",
                        "feed_id": "123e4567-e89b-12d3-a456-426614174000",
                        "cutoff_timestamp": "2025-11-03T18:00:00Z",
                    }
                }
            },
        },
        404: {"description": "Feed subscription not found"},
        500: {"description": "Internal server error"},
    },
)
async def mark_feed_all_read(
    *,
    feed_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
) -> dict[str, Any]:
    """
    Mark all articles in a feed as read by updating the last_read_cutoff timestamp.

    This operation updates the subscription's last_read_cutoff to the most recent
    article's published_at timestamp, effectively marking all current articles as read.
    New articles published after this timestamp will still appear as unread.

    This is much more efficient than updating individual article states.

    Args:
        feed_id: UUID of the feed to mark as read
        db: Database session dependency
        current_user: Current authenticated user

    Returns:
        Dictionary containing:
            - message: Success message
            - feed_id: The feed ID
            - cutoff_timestamp: The new cutoff timestamp

    Raises:
        HTTPException:
            - 404: If feed subscription doesn't exist for this user
            - 500: If database update fails
    """
    user_id = UUID(current_user.sub)

    # Get the user's subscription to this feed
    subscription = await crud_subscription.get_subscription_by_feed_id(db=db, feed_id=feed_id, user_id=user_id)

    if not subscription:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Feed subscription not found",
        )

    # Get the most recent article's published_at timestamp for this feed
    result = await db.execute(
        select(func.max(ArticleContent.published_at))
        .join(FeedArticle, FeedArticle.content_id == ArticleContent.id)
        .where(FeedArticle.feed_id == feed_id)
    )
    max_published_at = result.scalar_one_or_none()

    # If feed has no articles, use current time
    if max_published_at is None:
        from datetime import datetime, timezone

        max_published_at = datetime.now(timezone.utc)

    # Update the subscription's last_read_cutoff
    from app.schemas.subscriptions import SubscriptionUpdate

    update_data = SubscriptionUpdate(last_read_cutoff=max_published_at)
    await crud_subscription.update_subscription(db=db, subscription_db=subscription, subscription_in=update_data)

    logger.info(
        "Marked all articles as read for feed",
        feed_id=str(feed_id),
        user_id=str(user_id),
        cutoff_timestamp=str(max_published_at),
    )

    return {
        "message": "All articles marked as read",
        "feed_id": str(feed_id),
        "cutoff_timestamp": max_published_at.isoformat() if max_published_at else None,
    }
