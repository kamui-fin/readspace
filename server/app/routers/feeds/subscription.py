import time
from uuid import UUID

import structlog
from fastapi import APIRouter, Body, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import ERROR_FEED_NOT_FOUND
from app.core.custom_exceptions import ReadspaceException, to_http_exception
from app.core.dependencies import get_subscription_service
from app.crud import crud_feed
from app.crud.profile import get_profile_by_id
from app.db.session import get_db, get_db_factory
from app.schemas import FeedCreate
from app.schemas.auth import TokenData
from app.schemas.subscriptions import (
    SubscriptionCreateByFeedId,
    SubscriptionResponse,
)
from app.services.feeds.management import FeedManagementService
from app.services.subscription import SubscriptionService
from app.services.user.auth import get_current_user
from app.services.user.resource_limits import ResourceLimitService, check_subscription_limit

logger = structlog.get_logger(__name__)
router = APIRouter()


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
    profile = await get_profile_by_id(db, user_id=UUID(current_user.sub))
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

        duration = time.perf_counter() - start_time

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
        duration = time.perf_counter() - start_time
        # Re-raise HTTP exceptions from downstream handlers
        raise
    except ReadspaceException as e:
        duration = time.perf_counter() - start_time

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
        duration = time.perf_counter() - start_time

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
async def add_new_feed(
    *,
    db_factory=Depends(get_db_factory),
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

    # Check subscription limit before processing (quick check, use factory)
    async with db_factory() as db:
        await check_subscription_limit(db, UUID(current_user.sub))

    feed_service = FeedManagementService(user_id=UUID(current_user.sub))
    try:
        feed = await feed_service.add_new_feed(
            db_factory,
            str(feed_in.url),
            folder_id=feed_in.folder_id,
            tag_names=None,
        )

        duration = time.perf_counter() - start_time

        logger.info(
            "Feed added successfully",
            feed_id=feed.id,
            user_id=current_user.sub,
            url=feed_in.url,
            duration_seconds=round(duration, 3),
        )
        return feed
    except HTTPException:
        duration = time.perf_counter() - start_time
        # Re-raise HTTP exceptions from downstream handlers
        raise
    except ReadspaceException as e:
        duration = time.perf_counter() - start_time

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
        duration = time.perf_counter() - start_time

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
