"""Feed refresh routes - manually trigger feed updates."""

from typing import Annotated, Any
from uuid import UUID

import structlog
from fastapi import APIRouter, Depends, status

from app.core.constants import ERROR_FEED_NOT_FOUND
from app.core.custom_exceptions import NotFoundError
from app.crud.feed.subscription import get_subscription_by_feed_id
from app.db.session import get_db_factory
from app.services.feeds.service import refresh_feed
from app.services.user.auth import get_current_user
from app.typing.common import MessageResponse
from app.typing.user import TokenData

logger = structlog.get_logger(__name__)
router = APIRouter()


async def verify_subscription(db_factory, feed_id: UUID, user_id: UUID) -> None:
    """
    Verifies that a user is subscribed to a feed.

    Raises:
        NotFoundError: If the subscription does not exist.
    """
    async with db_factory() as db:
        subscription = await get_subscription_by_feed_id(db, feed_id=feed_id, user_id=user_id)
        if not subscription:
            # We raise the custom exception here.
            # The Global Exception Handler will catch this and return 404.
            raise NotFoundError(message=ERROR_FEED_NOT_FOUND)


@router.post(
    "/{feed_id}/refresh",
    status_code=status.HTTP_200_OK,
    summary="Refresh RSS feed",
    description="Manually trigger a refresh of a specific RSS feed to fetch new articles.",
)
async def refresh_feed_route(
    feed_id: UUID,
    db_factory: Annotated[Any, Depends(get_db_factory)],
    current_user: Annotated[TokenData, Depends(get_current_user)],
) -> MessageResponse:
    """
    Initiates an immediate refresh of the specified RSS feed.

    Args:
        feed_id: UUID of the feed to refresh
        force_refetch: If True, ignores HTTP caching headers

    Returns:
        JSON success message.
    """
    # 1. Bind context to logger (Orthogonality)
    # Any log generated within this scope will have these keys.
    log = logger.bind(feed_id=str(feed_id), user_id=current_user.sub)

    # 2. Business Logic
    # We call the service directly. We do NOT use try/except here.
    # If refresh_feed raises FeedConnectionError, the Global Handler catches it -> 503.
    # If refresh_feed raises FeedParsingError, the Global Handler catches it -> 400.
    await refresh_feed(
        session_factory=db_factory,
        feed_id=feed_id,
    )

    log.info("Feed refresh completed successfully")
    return MessageResponse(message="Feed refresh completed")
