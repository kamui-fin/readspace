"""Bulk feed operations - delete and move multiple feeds."""

from typing import Any
from uuid import UUID

import structlog
from fastapi import APIRouter, Body, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

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

    deleted_ids = []
    user_uuid = UUID(current_user.sub)
    for feed_id in feed_ids:
        subscription = await get_subscription_by_feed_id(db=db, feed_id=feed_id, user_id=user_uuid)
        if subscription:
            await delete_subscription(db=db, subscription_id=subscription.id, user_id=user_uuid)
            deleted_ids.append(feed_id)

    logger.info(
        "Bulk delete feeds completed",
        deleted_count=len(deleted_ids),
        user_id=current_user.sub,
    )

    return {
        "deleted_count": len(deleted_ids),
        "deleted_ids": [str(fid) for fid in deleted_ids],
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
    folder = await get_folder(db, folder_id=folder_id, user_id=UUID(current_user.sub))
    if not folder:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Folder not found or does not belong to user",
        )

    # Bulk update subscriptions using CRUD function
    updated_count = await bulk_update_subscriptions_folder(
        db=db,
        feed_ids=feed_ids,
        user_id=UUID(current_user.sub),
        folder_id=folder_id,
    )

    logger.info(
        "Bulk update feeds folder completed",
        updated_count=updated_count,
        folder_id=folder_id,
        user_id=current_user.sub,
    )

    return {
        "updated_count": updated_count,
        "updated_ids": [str(fid) for fid in feed_ids],
        "folder_id": str(folder_id),
    }
