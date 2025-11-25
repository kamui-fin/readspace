from typing import Any
from uuid import UUID

import structlog
from fastapi import APIRouter, Body, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud import folder as crud_folder
from app.crud.article.actions import mark_all_as_read
from app.db.session import get_db
from app.services import folder as folder_service
from app.services.user.auth import get_current_user
from app.typing.folders import FolderCreate, FolderResponse, FolderUpdate
from app.typing.user import TokenData

logger = structlog.get_logger(__name__)
router = APIRouter(prefix="/folders", tags=["RSS Folders"])


@router.post("/", response_model=FolderResponse, status_code=status.HTTP_201_CREATED)
async def create_folder(
    *,
    db: AsyncSession = Depends(get_db),
    folder_in: FolderCreate = Body(...),
    current_user: TokenData = Depends(get_current_user),
) -> FolderResponse:
    """Create a new folder for the current user."""
    user_id = UUID(current_user.sub)
    folder = await folder_service.create_folder(db, user_id, folder_in)
    logger.info("Folder created", folder_id=folder.id, user_id=current_user.sub)
    return folder


@router.get("/", response_model=list[FolderResponse])
async def list_folders(
    db: AsyncSession = Depends(get_db),
    skip: int = 0,
    limit: int = 100,
    current_user: TokenData = Depends(get_current_user),
) -> list[FolderResponse]:
    """List all folders for the current user."""
    user_id = UUID(current_user.sub)
    return await folder_service.list_folders(db, user_id, skip, limit)


@router.get("/{folder_id}", response_model=FolderResponse)
async def get_folder(
    folder_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
) -> FolderResponse:
    """Get a specific folder by its ID."""
    user_id = UUID(current_user.sub)
    folder = await crud_folder.get_by_id(db, folder_id, user_id)
    if not folder:
        logger.warning("Folder not found", folder_id=folder_id, user_id=current_user.sub)
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Folder not found")
    return FolderResponse.model_validate(folder)


@router.put("/{folder_id}", response_model=FolderResponse)
async def update_folder(
    folder_id: UUID,
    folder_in: FolderUpdate = Body(...),
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
) -> FolderResponse:
    """Update a folder's details."""
    user_id = UUID(current_user.sub)
    updated = await folder_service.update_folder(db, user_id, folder_id, folder_in)
    logger.info("Folder updated", folder_id=folder_id, user_id=current_user.sub)
    return updated


@router.delete("/{folder_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_folder(
    folder_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
) -> None:
    """Delete a folder."""
    user_id = UUID(current_user.sub)
    await folder_service.delete_folder(db, user_id, folder_id)
    logger.info("Folder deleted", folder_id=folder_id, user_id=current_user.sub)


@router.put(
    "/{folder_id}/read-status",
    status_code=status.HTTP_200_OK,
    summary="Mark all articles in a folder as read",
)
async def mark_folder_all_read(
    *,
    folder_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
) -> dict[str, Any]:
    """Mark all articles in all feeds within a folder as read."""
    user_id = UUID(current_user.sub)
    # Use existing CRUD function
    updated_count = await mark_all_as_read(db, user_id=user_id, folder_id=folder_id)

    logger.info("Marked folder as read", folder_id=str(folder_id), updated_subscriptions=updated_count)

    return {
        "message": "All articles in folder marked as read",
        "folder_id": str(folder_id),
        "updated_subscriptions": updated_count,
    }
