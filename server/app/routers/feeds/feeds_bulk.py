"""Bulk feed operations - delete and move multiple feeds."""

from typing import Annotated, Any
from uuid import UUID

import structlog
from fastapi import APIRouter, Body, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.custom_exceptions import NotFoundError
from app.crud.feed.subscription import (
    bulk_update_subscriptions_folder,
    delete_subscription,
    get_subscription_by_feed_id,
)
from app.crud.folder import get_by_id as get_folder
from app.db.session import get_db
from app.services.user.auth import get_current_user
from app.typing.user import TokenData

logger = structlog.get_logger(__name__)
router = APIRouter()


@router.delete(
    "/",
    status_code=status.HTTP_200_OK,
    summary="Bulk delete feed subscriptions",
)
async def bulk_delete_feeds(
    feed_ids: Annotated[list[UUID], Body(embed=True, description="List of feed IDs to unsubscribe from")],
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[TokenData, Depends(get_current_user)],
) -> dict[str, Any]:
    """
    Delete multiple feed subscriptions. Only deletes subscriptions owned by the user.
    """
    if not feed_ids:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="feed_ids list cannot be empty")

    logger.bind(user_id=current_user.sub, action="bulk_delete")
    user_uuid = UUID(current_user.sub)
    deleted_ids = []

    # Note: Ideally this should be a single DELETE WHERE IN (...) query in the CRUD layer.
    # We are keeping the loop structure to match existing CRUD capabilities,
    # but cleaning the route logic.
    for feed_id in feed_ids:
        subscription = await get_subscription_by_feed_id(db=db, feed_id=feed_id, user_id=user_uuid)
        if subscription:
            await delete_subscription(db=db, subscription_id=subscription.id, user_id=user_uuid)
            deleted_ids.append(feed_id)

    logger.info("Bulk delete feeds completed", deleted_count=len(deleted_ids))

    return {
        "deleted_count": len(deleted_ids),
        "deleted_ids": [str(fid) for fid in deleted_ids],
    }


@router.patch(
    "/folder",
    status_code=status.HTTP_200_OK,
    summary="Bulk move feeds to folder",
)
async def bulk_update_feeds_folder(
    feed_ids: Annotated[list[UUID], Body(description="List of feed IDs to move")],
    folder_id: Annotated[UUID, Body(description="Target folder ID")],
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[TokenData, Depends(get_current_user)],
) -> dict[str, Any]:
    """
    Move multiple feed subscriptions to a different folder.
    """
    if not feed_ids:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="feed_ids list cannot be empty")

    logger.bind(user_id=current_user.sub, folder_id=str(folder_id), action="bulk_move")
    user_uuid = UUID(current_user.sub)

    # 1. Verify Folder Ownership
    folder = await get_folder(db, folder_id=folder_id, user_id=user_uuid)
    if not folder:
        raise NotFoundError(message="Folder not found or does not belong to user")

    # 2. Perform Bulk Update
    updated_count = await bulk_update_subscriptions_folder(
        db=db,
        feed_ids=feed_ids,
        user_id=user_uuid,
        folder_id=folder_id,
    )

    logger.info("Bulk update feeds folder completed", updated_count=updated_count)

    return {
        "updated_count": updated_count,
        "updated_ids": [str(fid) for fid in feed_ids],
        "folder_id": str(folder_id),
    }
