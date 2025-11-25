"""
Folder Service.
Handles logic for folder management, including validation and 'My Feeds' default.
"""

from uuid import UUID

import structlog
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud import folder as crud_folder
from app.typing.folders import FolderCreate, FolderResponse, FolderUpdate
from app.utils.common import validate_folder_name

logger = structlog.get_logger(__name__)


async def create_folder(db: AsyncSession, user_id: UUID, folder_in: FolderCreate) -> FolderResponse:
    """
    Create a new folder.
    Validates name and checks for duplicates.
    """
    # 1. Validation
    is_valid, error_msg = validate_folder_name(folder_in.name)
    if not is_valid:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=error_msg)

    # 2. Check Duplicates
    existing = await crud_folder.get_by_name(db, folder_in.name, user_id)
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"Folder '{folder_in.name}' already exists.")

    # 3. Create
    folder = await crud_folder.create(db, folder_in, user_id)
    return FolderResponse.model_validate(folder)


async def update_folder(db: AsyncSession, user_id: UUID, folder_id: UUID, folder_in: FolderUpdate) -> FolderResponse:
    """
    Update folder name.
    """
    # 1. Get Existing
    folder = await crud_folder.get_by_id(db, folder_id, user_id)
    if not folder:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Folder not found")

    # 2. Validate New Name (if changed)
    if folder_in.name and folder_in.name != folder.name:
        is_valid, error_msg = validate_folder_name(folder_in.name)
        if not is_valid:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=error_msg)

        # Check duplicate
        duplicate = await crud_folder.get_by_name(db, folder_in.name, user_id)
        if duplicate and str(duplicate.id) != str(folder_id):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT, detail=f"Folder '{folder_in.name}' already exists."
            )

    # 3. Update
    updated = await crud_folder.update(db, folder, folder_in)
    return FolderResponse.model_validate(updated)


async def delete_folder(db: AsyncSession, user_id: UUID, folder_id: UUID) -> None:
    """
    Delete a folder.
    Note: Foreign key constraints (on FeedSubscription) should be handled
    either by DB cascade or check before delete. Assuming DB Cascade for simplicity here.
    """
    folder = await crud_folder.get_by_id(db, folder_id, user_id)
    if not folder:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Folder not found")

    await crud_folder.delete(db, folder)
    logger.info("Folder deleted", folder_id=folder_id, user_id=user_id)


async def list_folders(db: AsyncSession, user_id: UUID, skip: int = 0, limit: int = 100) -> list[FolderResponse]:
    """List folders."""
    folders = await crud_folder.list_by_user(db, user_id, skip, limit)
    return [FolderResponse.model_validate(f) for f in folders]


async def ensure_default_folder(db: AsyncSession, user_id: UUID) -> FolderResponse:
    """
    Get or Create the 'My Feeds' default folder.
    """
    # Try finding it first (fastest)
    default_name = "My Feeds"
    folder = await crud_folder.get_by_name(db, default_name, user_id)

    if folder:
        return FolderResponse.model_validate(folder)

    # Fallback: Create it
    logger.info("Creating default folder", user_id=user_id)
    try:
        new_folder = await crud_folder.create(db, FolderCreate(name=default_name), user_id)
        return FolderResponse.model_validate(new_folder)
    except Exception:
        # Race condition handling: if parallel request created it
        folder = await crud_folder.get_by_name(db, default_name, user_id)
        if folder:
            return FolderResponse.model_validate(folder)
        raise


async def create_folders_batch(db: AsyncSession, user_id: UUID, names: list[str]) -> dict[str, UUID]:
    """Bulk create helper."""
    return await crud_folder.upsert_batch(db, names, user_id)
