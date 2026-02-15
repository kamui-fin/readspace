"""Main feed routes - list, get, update, delete, unread-counts."""

from typing import Annotated
from uuid import UUID

import structlog
from fastapi import APIRouter, Body, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import ERROR_FEED_NOT_FOUND
from app.core.custom_exceptions import NotFoundError
from app.crud.article.actions import mark_all_as_read
from app.crud.feed.core import get_feed_by_id
from app.crud.feed.subscription import (
    create_subscription,
    delete_subscription,
    get_subscription_by_feed_id,
    get_subscriptions_by_user,
    update_subscription,
)
from app.db.session import get_db, get_db_factory
from app.models.feed import FeedSubscription
from app.services import folder as folder_service
from app.services.feeds.service import SessionFactory
from app.services.user.auth import get_current_user
from app.typing.common import MessageResponse
from app.typing.feeds import FeedDetail
from app.typing.responses import FeedsResponse
from app.typing.subscriptions import (
    SubscriptionCreateByFeedId,
    SubscriptionResponse,
    SubscriptionResponseExtended,
    SubscriptionUpdate,
)
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


@router.post(
    "/{feed_id}/subscribe",
    response_model=MessageResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Subscribe to an existing feed",
)
async def subscribe_to_feed(
    feed_id: UUID,
    payload: SubscriptionCreateByFeedId,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[TokenData, Depends(get_current_user)],
) -> MessageResponse:
    """
    Subscribe to a feed that already exists in the system.
    """
    logger.bind(feed_id=str(feed_id), user_id=current_user.sub)
    user_uuid = UUID(current_user.sub)

    # 1. Verify Feed Exists
    feed = await get_feed_by_id(db, feed_id=feed_id)
    if not feed:
        raise NotFoundError(message=ERROR_FEED_NOT_FOUND)

    # 2. Create Subscription
    # Note: We pass the payload as is. create_subscription handles folder creation if needed.
    # We must cast payload to SubscriptionCreate (structurally compatible for used fields)
    # or update create_subscription typing.
    # For now, we rely on the fact that if feed_db is passed, url is ignored.
    await create_subscription(
        db=db,
        user_id=user_uuid,
        subscription_in=payload,  # type: ignore
        feed_db=feed,
    )

    logger.info("Subscribed to feed successfully")
    return MessageResponse(message="Subscribed to feed successfully")


# --- Routes ---
@router.get(
    "/",
    response_model=FeedsResponse,
    status_code=status.HTTP_200_OK,
    summary="List user's RSS feeds",
)
async def list_feeds(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[TokenData, Depends(get_current_user)],
    folder_id: UUID | None = Query(None, description="Filter feeds by folder ID"),
    tag_names: list[str] | None = Query(None, description="Filter by tags (AND logic)"),
    is_favorite: bool | None = Query(None, description="Filter by favorite status"),
    extended: bool = Query(False, description="Return full feed details"),
) -> FeedsResponse:
    """
    Retrieve all RSS feeds the user is subscribed to with optional filtering.
    Also returns all user folders to ensure empty folders are displayed.
    """
    logger.bind(user_id=current_user.sub)
    user_uuid = UUID(current_user.sub)

    # 1. Fetch Subscriptions
    subscriptions = await get_subscriptions_by_user(
        db=db,
        user_id=user_uuid,
        folder_id=folder_id,
        extended=extended,
    )

    # 2. Fetch Folders (only if not filtering by specific folder)
    folders = []
    if not folder_id:
        folders = await folder_service.list_folders(db, user_uuid, skip=0, limit=200)

    # 3. Construct Response
    subs_response = []
    if extended:
        subs_response = [SubscriptionResponseExtended.model_validate(sub) for sub in subscriptions]
    else:
        subs_response = [SubscriptionResponse.model_validate(sub) for sub in subscriptions]

    return FeedsResponse(subscriptions=subs_response, folders=folders)


@router.get(
    "/{feed_id}",
    response_model=FeedDetail,
    summary="Get a specific RSS feed",
)
async def get_feed(
    feed_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    db_factory: Annotated[SessionFactory, Depends(get_db_factory)],
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

    # 5. Merge Data
    feed_detail = FeedDetail.model_validate(feed, from_attributes=True)
    feed_detail.is_subscribed = subscription is not None
    if subscription and subscription.custom_title:
        feed_detail.title = subscription.custom_title

    return feed_detail


@router.put(
    "/{feed_id}",
    response_model=MessageResponse,
    summary="Update feed settings",
)
async def update_feed_settings(
    feed_id: UUID,
    feed_in: Annotated[SubscriptionUpdate, Body(description="Settings to update")],
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[TokenData, Depends(get_current_user)],
) -> MessageResponse:
    """
    Update user-configurable settings (title, folder, favorite) for a subscription.
    """
    logger.bind(feed_id=str(feed_id), user_id=current_user.sub)
    user_uuid = UUID(current_user.sub)

    # 1. Verify Existence
    subscription = await get_subscription_or_404(db, feed_id, user_uuid)

    # 2. Update
    await update_subscription(
        db=db,
        subscription=subscription,
        custom_title=feed_in.custom_title,
        folder_id=feed_in.folder_id,
        is_favorite=feed_in.is_favorite,
    )

    logger.info("Feed settings updated successfully")
    return MessageResponse(message="Feed settings updated successfully")


@router.delete(
    "/{feed_id}",
    response_model=MessageResponse,
    status_code=status.HTTP_200_OK,
    summary="Delete RSS feed subscription",
)
async def delete_feed(
    feed_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[TokenData, Depends(get_current_user)],
) -> MessageResponse:
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
    return MessageResponse(message="Feed deleted successfully")


@router.put(
    "/{feed_id}/read-status",
    response_model=MessageResponse,
    status_code=status.HTTP_200_OK,
    summary="Mark all articles in a feed as read",
)
async def mark_feed_read(
    feed_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[TokenData, Depends(get_current_user)],
) -> MessageResponse:
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

    return MessageResponse(message="All articles marked as read")
