"""Folder management routes."""

from typing import Annotated
from uuid import UUID

import structlog
from fastapi import APIRouter, Body, Depends, Query, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.custom_exceptions import NotFoundError
from app.crud import folder as crud_folder
from app.crud.article.actions import mark_all_as_read
from app.db.session import get_db
from app.services import folder as folder_service
from app.services.user.auth import get_current_user
from app.typing.folders import FolderCreate, FolderResponse, FolderUpdate
from app.typing.user import TokenData

logger = structlog.get_logger(__name__)
router = APIRouter(prefix="/folders", tags=["RSS Folders"])


# --- Response Models ---
class FolderReadStatusResponse(BaseModel):
    message: str
    folder_id: str
    updated_subscriptions: int


# --- Helpers ---
async def verify_folder_exists(db: AsyncSession, folder_id: UUID, user_id: UUID) -> None:
    """Verifies folder existence or raises NotFoundError."""
    folder = await crud_folder.get_by_id(db, folder_id, user_id)
    if not folder:
        raise NotFoundError(message="Folder not found")


# --- Routes ---
@router.post(
    "/",
    response_model=FolderResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create folder",
)
async def create_folder(
    folder_in: Annotated[FolderCreate, Body(description="Folder creation data")],
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[TokenData, Depends(get_current_user)],
) -> FolderResponse:
    """
    Create a new folder for the current user.
    """
    logger.bind(user_id=current_user.sub, folder_title=folder_in.name)

    folder = await folder_service.create_folder(db, UUID(current_user.sub), folder_in)

    logger.info("Folder created successfully", folder_id=str(folder.id))
    return folder


@router.get("/", response_model=list[FolderResponse], summary="List user folders")
async def list_folders(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[TokenData, Depends(get_current_user)],
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=200),
) -> list[FolderResponse]:
    """
    List all folders for the current user.
    """
    logger.bind(user_id=current_user.sub)
    return await folder_service.list_folders(db, UUID(current_user.sub), skip, limit)


@router.put("/{folder_id}", response_model=FolderResponse, summary="Update folder")
async def update_folder(
    folder_id: UUID,
    folder_in: Annotated[FolderUpdate, Body(description="Update data")],
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[TokenData, Depends(get_current_user)],
) -> FolderResponse:
    """
    Update a folder's details.
    """
    logger.bind(user_id=current_user.sub, folder_id=str(folder_id))

    # Service should raise NotFoundError if folder doesn't exist
    updated = await folder_service.update_folder(db, UUID(current_user.sub), folder_id, folder_in)

    logger.info("Folder updated successfully")
    return updated


@router.delete("/{folder_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete folder")
async def delete_folder(
    folder_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[TokenData, Depends(get_current_user)],
) -> None:
    """
    Delete a folder.
    """
    logger.bind(user_id=current_user.sub, folder_id=str(folder_id))

    # Service handles logic and raises exceptions if needed
    await folder_service.delete_folder(db, UUID(current_user.sub), folder_id)

    # Explicit commit before response to prevent UI refetch race condition
    await db.commit()

    logger.info("Folder deleted successfully")


@router.put(
    "/{folder_id}/read-status",
    status_code=status.HTTP_200_OK,
    response_model=FolderReadStatusResponse,
    summary="Mark all articles in a folder as read",
)
async def mark_folder_all_read(
    folder_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[TokenData, Depends(get_current_user)],
) -> FolderReadStatusResponse:
    """
    Mark all articles in all feeds within a folder as read.
    """
    logger.bind(user_id=current_user.sub, folder_id=str(folder_id))
    user_uuid = UUID(current_user.sub)

    # 1. Verify existence first
    await verify_folder_exists(db, folder_id, user_uuid)

    # 2. Perform Action
    updated_count = await mark_all_as_read(db, user_id=user_uuid, folder_id=folder_id)

    logger.info("Marked folder as read", updated_subscriptions=updated_count)

    return FolderReadStatusResponse(
        message="All articles in folder marked as read",
        folder_id=str(folder_id),
        updated_subscriptions=updated_count,
    )
