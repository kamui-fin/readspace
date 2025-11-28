"""Main feed routes - list, get, update, delete, unread-counts."""

from typing import Annotated, Any
from uuid import UUID

import structlog
from fastapi import APIRouter, Body, Depends, Query, status
from fastapi.responses import ORJSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import ERROR_FEED_NOT_FOUND
from app.core.custom_exceptions import NotFoundError
from app.crud.article.actions import mark_all_as_read
from app.crud.feed.core import get_feed_by_id
from app.crud.feed.subscription import (
    delete_subscription,
    get_subscription_by_feed_id,
    get_subscriptions_by_user,
    update_subscription,
)
from app.db.session import get_db
from app.models.feed import FeedSubscription
from app.services.user.auth import get_current_user
from app.typing.feeds import FeedDetail
from app.typing.subscriptions import SubscriptionResponse, SubscriptionUpdate
from app.typing.user import TokenData

logger = structlog.get_logger(__name__)
router = APIRouter()


# --- Helpers ---
async def get_subscription_or_404(db: AsyncSession, feed_id: UUID, user_id: UUID) -> FeedSubscription:
    """
    Retrieves a user's subscription or raises NotFoundError.
    """
    subscription = await get_subscription_by_feed_id(db, feed_id=feed_id, user_id=user_id)
    if not subscription:
        raise NotFoundError(message=ERROR_FEED_NOT_FOUND)
    return subscription


# --- Routes ---
@router.get(
    "/",
    response_model=list[SubscriptionResponse],
    status_code=status.HTTP_200_OK,
    summary="List user's RSS feeds",
)
async def list_feeds(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[TokenData, Depends(get_current_user)],
    folder_id: UUID | None = Query(None, description="Filter feeds by folder ID"),
    tag_names: list[str] | None = Query(None, description="Filter by tags (AND logic)"),
    is_favorite: bool | None = Query(None, description="Filter by favorite status"),
    skip: int = Query(0, ge=0),
) -> list[SubscriptionResponse]:
    """
    Retrieve all RSS feeds the user is subscribed to with optional filtering.
    """
    logger.bind(user_id=current_user.sub)

    subscriptions = await get_subscriptions_by_user(
        db=db,
        user_id=UUID(current_user.sub),
        folder_id=folder_id,
        skip=skip,
        limit=100,
    )
    return [SubscriptionResponse.model_validate(sub) for sub in subscriptions]


@router.get(
    "/{feed_id}",
    response_model=FeedDetail,
    summary="Get a specific RSS feed",
)
async def get_feed(
    feed_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[TokenData, Depends(get_current_user)],
) -> FeedDetail:
    """
    Retrieve details about a specific feed.
    Returns `is_subscribed` status for the requesting user.
    """
    logger.bind(feed_id=str(feed_id), user_id=current_user.sub)

    # 1. Get Global Feed (Public Access allowed if authenticated)
    feed = await get_feed_by_id(db, feed_id=feed_id)
    if not feed:
        raise NotFoundError(message=ERROR_FEED_NOT_FOUND)

    # 2. Check Subscription Status
    subscription = await get_subscription_by_feed_id(db, feed_id=feed_id, user_id=UUID(current_user.sub))

    # 3. Merge Data
    feed_detail = FeedDetail.model_validate(feed, from_attributes=True)
    feed_detail.is_subscribed = subscription is not None

    return feed_detail


@router.put(
    "/{feed_id}",
    response_model=SubscriptionResponse,
    summary="Update feed settings",
)
async def update_feed_settings(
    feed_id: UUID,
    feed_in: Annotated[SubscriptionUpdate, Body(description="Settings to update")],
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[TokenData, Depends(get_current_user)],
) -> SubscriptionResponse:
    """
    Update user-configurable settings (title, folder, favorite) for a subscription.
    """
    logger.bind(feed_id=str(feed_id), user_id=current_user.sub)
    user_uuid = UUID(current_user.sub)

    # 1. Verify Existence
    subscription = await get_subscription_or_404(db, feed_id, user_uuid)

    # 2. Update
    updated_subscription = await update_subscription(
        db=db,
        subscription=subscription,
        custom_title=feed_in.custom_title,
        folder_id=feed_in.folder_id,
        is_favorite=feed_in.is_favorite,
    )

    logger.info("Feed settings updated successfully")
    return updated_subscription


@router.delete(
    "/{feed_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete RSS feed subscription",
)
async def delete_feed(
    feed_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[TokenData, Depends(get_current_user)],
) -> ORJSONResponse:
    """
    Unsubscribe from a feed and remove associated user data (read status, notes).
    """
    logger.bind(feed_id=str(feed_id), user_id=current_user.sub)
    user_uuid = UUID(current_user.sub)

    # 1. Verify Existence
    subscription = await get_subscription_or_404(db, feed_id, user_uuid)

    # 2. Delete
    success = await delete_subscription(db=db, subscription_id=subscription.id, user_id=user_uuid)

    if not success:
        # Should rarely happen if get_subscription_or_404 passed, but safe to check
        raise NotFoundError(message=ERROR_FEED_NOT_FOUND)

    logger.info("Feed deleted successfully")
    return ORJSONResponse(status_code=status.HTTP_200_OK, content={"ok": True})


@router.put(
    "/{feed_id}/read-status",
    status_code=status.HTTP_200_OK,
    summary="Mark all articles in a feed as read",
)
async def mark_feed_read(
    feed_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[TokenData, Depends(get_current_user)],
) -> dict[str, Any]:
    """
    Update the last_read_cutoff timestamp to mark all current articles as read.
    """
    logger.bind(feed_id=str(feed_id), user_id=current_user.sub)
    user_uuid = UUID(current_user.sub)

    # 1. Verify Existence
    # Ensure user is actually subscribed before marking read
    await get_subscription_or_404(db, feed_id, user_uuid)

    # 2. Perform Action
    await mark_all_as_read(db, user_id=user_uuid, feed_id=feed_id)

    logger.info("All articles in feed marked as read")

    return {
        "message": "All articles marked as read",
        "feed_id": str(feed_id),
    }
