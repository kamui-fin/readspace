"""Main feed routes - list, get, update, delete, unread-counts."""

from typing import Any
from uuid import UUID

import structlog
from fastapi import APIRouter, Body, Depends, HTTPException, Query, status
from fastapi.responses import ORJSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import ERROR_FEED_NOT_FOUND
from app.crud.article.actions import mark_all_as_read
from app.crud.feed.core import get_feed_by_id
from app.crud.feed.subscription import (
    delete_subscription,
    get_subscription_by_feed_id,
    get_subscriptions_by_user,
    update_subscription,
)
from app.db.session import get_db
from app.services.user.auth import get_current_user
from app.typing.subscriptions import FeedResponse, SubscriptionResponse, SubscriptionUpdate
from app.typing.user import TokenData

logger = structlog.get_logger(__name__)
router = APIRouter()


@router.get(
    "/",
    response_model=list[FeedResponse],
    status_code=status.HTTP_200_OK,
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
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
) -> list[FeedResponse]:
    """
    Retrieve all RSS feeds the authenticated user is subscribed to.

    This endpoint provides a comprehensive list of the user's RSS feed subscriptions
    with powerful filtering and search capabilities. Results are paginated and
    include subscription-specific metadata like unread counts and folder assignments.

    Args:
        folder_id: Optional UUID to filter feeds by specific folder
        tag_names: Optional list of tag names to filter by (all tags must match)
        is_favorite: Optional boolean to filter by favorite status
        skip: Number of results to skip for pagination (default: 0)
        current_user: Authenticated user information

    Returns:
        list[FeedResponse]: List of feed objects with subscription metadata

    Note:
        - Requires authentication
        - Returns only feeds the user is subscribed to
        - Tag filtering uses AND logic (all specified tags must match)
    """
    subscriptions = await get_subscriptions_by_user(
        db=db,
        user_id=UUID(current_user.sub),
        folder_id=folder_id,
        skip=skip,
        limit=100,
    )
    # TODO: Transform subscriptions to FeedResponse list
    return subscriptions


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
    feed = await get_feed_by_id(db, feed_id=feed_id)
    if not feed:
        logger.warning("Feed not found", feed_id=feed_id, user_id=current_user.sub)
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=ERROR_FEED_NOT_FOUND)

    # TODO: Transform Feed + Subscription to FeedResponse
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
    feed_in: SubscriptionUpdate = Body(..., description="Feed settings to update (all fields optional)"),
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
    subscription = await get_subscription_by_feed_id(db, feed_id=feed_id, user_id=UUID(current_user.sub))
    if not subscription:
        logger.warning(
            "Feed not found for update or access denied",
            feed_id=feed_id,
            user_id=current_user.sub,
        )
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=ERROR_FEED_NOT_FOUND)

    # Update subscription using CRUD function
    updated_subscription = await update_subscription(
        db=db,
        subscription=subscription,
        custom_title=feed_in.custom_title,
        folder_id=feed_in.folder_id,
        is_favorite=feed_in.is_favorite,
    )

    logger.info(
        "Feed settings updated successfully",
        feed_id=updated_subscription.id,
        user_id=current_user.sub,
    )
    # TODO: Transform to SubscriptionResponse
    return updated_subscription


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
) -> ORJSONResponse:
    """
    Delete user's subscription to an RSS feed and remove associated user data.

    This endpoint removes the user's subscription to the specified RSS feed.
    It deletes the subscription record and any user-specific data associated
    with articles from this feed, including read status, favorites, and notes.

    Args:
        feed_id: UUID of the feed subscription to delete
        current_user: Authenticated user information

    Returns:
        ORJSONResponse: Empty response with 204 status code on success

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
    # Get subscription by feed_id first
    subscription = await get_subscription_by_feed_id(db=db, feed_id=feed_id, user_id=UUID(current_user.sub))
    if not subscription:
        logger.warning(
            "Feed not found for deletion or access denied",
            feed_id=feed_id,
            user_id=current_user.sub,
        )
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=ERROR_FEED_NOT_FOUND)

    success = await delete_subscription(db=db, subscription_id=subscription.id, user_id=UUID(current_user.sub))

    if not success:
        logger.warning(
            "Feed not found for deletion or access denied",
            feed_id=feed_id,
            user_id=current_user.sub,
        )
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=ERROR_FEED_NOT_FOUND)

    logger.info(
        "Feed deleted successfully",
        feed_id=feed_id,
        user_id=current_user.sub,
    )
    return ORJSONResponse(status_code=status.HTTP_200_OK, content={"ok": True})


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

    # Verify subscription exists
    subscription = await get_subscription_by_feed_id(db=db, feed_id=feed_id, user_id=user_id)
    if not subscription:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Feed subscription not found",
        )

    # Mark all as read using CRUD function (handles cutoff calculation internally)
    await mark_all_as_read(db=db, user_id=user_id, feed_id=feed_id)

    logger.info(
        "Marked all articles as read for feed",
        feed_id=str(feed_id),
        user_id=str(user_id),
    )

    return {
        "message": "All articles marked as read",
        "feed_id": str(feed_id),
    }
