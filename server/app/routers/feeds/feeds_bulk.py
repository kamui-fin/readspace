"""Bulk feed operations - delete and move multiple feeds."""

from typing import Annotated
from uuid import UUID

import structlog
from fastapi import APIRouter, Body, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.custom_exceptions import NotFoundError
from app.crud.feed.subscription import (
    bulk_delete_subscriptions,
    bulk_update_subscriptions_folder,
)
from app.crud.folder import get_by_id as get_folder
from app.db.session import get_db
from app.services.user.auth import get_current_user
from app.typing.feeds import BulkDeleteResponse, BulkUpdateResponse
from app.typing.user import TokenData

logger = structlog.get_logger(__name__)
router = APIRouter()


@router.delete(
    "/",
    status_code=status.HTTP_200_OK,
    summary="Bulk delete feed subscriptions",
    response_model=BulkDeleteResponse,
)
async def bulk_delete_feeds(
    feed_ids: Annotated[list[UUID], Body(embed=True, description="List of feed IDs to unsubscribe from")],
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[TokenData, Depends(get_current_user)],
) -> BulkDeleteResponse:
    """
    Delete multiple feed subscriptions. Only deletes subscriptions owned by the user.
    """
    if not feed_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="feed_ids list cannot be empty",
        )

    logger.bind(user_id=current_user.sub, action="bulk_delete")
    user_uuid = UUID(current_user.sub)

    deleted_ids = await bulk_delete_subscriptions(db=db, feed_ids=feed_ids, user_id=user_uuid)

    logger.info("Bulk delete feeds completed", deleted_count=len(deleted_ids))

    return BulkDeleteResponse(
        deleted_count=len(deleted_ids),
        deleted_ids=deleted_ids,
    )


@router.patch(
    "/folder",
    status_code=status.HTTP_200_OK,
    summary="Bulk move feeds to folder",
    response_model=BulkUpdateResponse,
)
async def bulk_update_feeds_folder(
    feed_ids: Annotated[list[UUID], Body(description="List of feed IDs to move")],
    folder_id: Annotated[UUID, Body(description="Target folder ID")],
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[TokenData, Depends(get_current_user)],
) -> BulkUpdateResponse:
    """
    Move multiple feed subscriptions to a different folder.
    """
    if not feed_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="feed_ids list cannot be empty",
        )

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

    return BulkUpdateResponse(
        updated_count=updated_count,
    )
