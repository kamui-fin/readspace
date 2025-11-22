import time
from typing import Any
from uuid import UUID

import structlog
from fastapi import APIRouter, Body, Depends, HTTPException, Query, status
from fastapi.responses import JSONResponse
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import ERROR_FEED_NOT_FOUND
from app.core.custom_exceptions import (
    FeedSubscriptionError,
    FeedValidationError,
    NotFoundError,
)
from app.db.session import get_db
from app.models import ArticleContent, FeedArticle
from app.schemas import FeedUpdate
from app.schemas.auth import TokenData
from app.schemas.subscriptions import FeedResponse, SubscriptionResponse
from app.services.feeds.management import FeedManagementService
from app.services.user.auth import get_current_user

logger = structlog.get_logger(__name__)
router = APIRouter()


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
    from app.db.session import db_session_factory
    
    feed_service = FeedManagementService(user_id=UUID(current_user.sub))
    feeds = await feed_service.list_feeds(
        db_session_factory,
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
    from app.db.session import db_session_factory
    
    feed_service = FeedManagementService(user_id=UUID(current_user.sub))
    feed = await feed_service.get_feed(db_session_factory, feed_id=feed_id)
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
    from app.db.session import db_session_factory
    
    feed_service = FeedManagementService(user_id=UUID(current_user.sub))
    try:
        updated_feed = await feed_service.update_feed_user_settings(db_session_factory, feed_id=feed_id, feed_in=feed_in)
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
    from app.db.session import db_session_factory
    
    start_time = time.perf_counter()
    feed_service = FeedManagementService(user_id=UUID(current_user.sub))
    success = await feed_service.delete_feed(db_session_factory, feed_id=feed_id)
    duration = time.perf_counter() - start_time

    if not success:
        logger.warning(
            "Feed not found for deletion or access denied",
            feed_id=feed_id,
            user_id=current_user.sub,
            duration_seconds=round(duration, 3),
        )
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=ERROR_FEED_NOT_FOUND)

    logger.info(
        "Feed deleted successfully",
        feed_id=feed_id,
        user_id=current_user.sub,
        duration_seconds=round(duration, 3),
    )
    return JSONResponse(status_code=status.HTTP_200_OK, content={"ok": True})


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
    from app.crud import crud_subscription
    from app.schemas.subscriptions import SubscriptionUpdate

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
