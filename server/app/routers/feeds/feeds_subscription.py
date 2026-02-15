"""Feed subscription routes - subscribe and add feeds."""

from typing import Annotated, Any
from uuid import UUID

import structlog
from fastapi import APIRouter, Body, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import ERROR_FEED_NOT_FOUND
from app.core.custom_exceptions import NotFoundError
from app.crud.feed.core import get_feed_by_id
from app.db.session import get_db_factory
from app.models.feed import Feed
from app.services.feeds.service import add_feed
from app.services.folder import ensure_default_folder
from app.services.user.auth import get_current_user
from app.services.user.resource_limits import enforce_subscription_limit
from app.typing.feeds import FeedCreate
from app.typing.subscriptions import (
    SubscriptionResponse,
)
from app.typing.user import TokenData

logger = structlog.get_logger(__name__)
router = APIRouter()


# --- Helpers ---
async def resolve_target_folder(db: AsyncSession, user_id: UUID, folder_id_input: UUID | str | None) -> UUID:
    """Resolves 'default' string or None to the user's default folder UUID."""
    if folder_id_input is None or folder_id_input == "default":
        default_folder = await ensure_default_folder(db, user_id)
        return default_folder.id
    return UUID(str(folder_id_input))


async def verify_feed_exists(db: AsyncSession, feed_id: UUID) -> Feed:
    """Verifies feed existence or raises NotFoundError."""
    feed = await get_feed_by_id(db, feed_id=feed_id)
    if not feed:
        raise NotFoundError(message=ERROR_FEED_NOT_FOUND)
    return feed


# --- Routes ---
@router.post(
    "/",
    response_model=SubscriptionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Add a new RSS feed",
    description="Add a new RSS feed by URL with automatic parsing, validation, and subscription creation.",
)
async def add_new_feed(
    feed_in: Annotated[FeedCreate, Body(description="Feed URL and folder assignment")],
    db_factory: Annotated[Any, Depends(get_db_factory)],
    current_user: Annotated[TokenData, Depends(get_current_user)],
) -> SubscriptionResponse:
    """
    Add a new RSS feed by URL. Validates, parses, and creates subscription.
    """
    # 1. Bind Context
    logger.bind(user_id=current_user.sub, url=str(feed_in.url))
    user_uuid = UUID(current_user.sub)

    async with db_factory() as db:
        # 2. Check Limits (Raises ResourceLimitError if full)
        await enforce_subscription_limit(db, user_uuid)

        # 3. Resolve Folder
        folder_id = await resolve_target_folder(db, user_uuid, feed_in.folder_id)

    # 4. Service Call (Business Logic)
    # Global Handler catches FeedParsingError, FeedConnectionError, etc.
    subscription, _ = await add_feed(
        session_factory=db_factory,
        user_id=user_uuid,
        url=str(feed_in.url),
        folder_id=folder_id,
        custom_title=None,
    )

    logger.info("Feed added successfully", feed_id=str(subscription.feed_id))
    return subscription
