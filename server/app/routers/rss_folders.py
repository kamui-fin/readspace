from typing import List
from uuid import UUID

import structlog
from app.db.session import get_db
from app.schemas.auth import TokenData
from app.schemas.rss_schemas import FolderCreate, FolderResponse, FolderUpdate
from app.services.auth import get_current_user
from app.services.rss_service import RssService
from fastapi import APIRouter, Body, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

logger = structlog.get_logger(__name__)
router = APIRouter()


@router.post("/folders/", response_model=FolderResponse, status_code=status.HTTP_201_CREATED)
async def create_folder(
    *, 
    db: AsyncSession = Depends(get_db),
    folder_in: FolderCreate = Body(...),
    current_user: TokenData = Depends(get_current_user)
):
    """Create a new folder for the current user."""
    rss_service = RssService(db=db, user_id=UUID(current_user.sub))
    try:
        folder = await rss_service.create_folder(folder_in=folder_in)
        logger.info("Folder created successfully", folder_id=folder.id, user_id=current_user.sub)
        return folder
    except ValueError as e:
        logger.warning("Failed to create folder due to value error", error=str(e), user_id=current_user.sub, folder_name=folder_in.name)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error("Unexpected error creating folder", error=str(e), user_id=current_user.sub, folder_name=folder_in.name)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="An unexpected error occurred while creating the folder.")


@router.get("/folders/", response_model=List[FolderResponse])
async def list_folders(
    db: AsyncSession = Depends(get_db),
    skip: int = 0,
    limit: int = 100,
    current_user: TokenData = Depends(get_current_user)
):
    """List all folders for the current user."""
    rss_service = RssService(db=db, user_id=UUID(current_user.sub))
    folders = await rss_service.list_folders(skip=skip, limit=limit)
    return folders


@router.get("/folders/{folder_id}", response_model=FolderResponse)
async def get_folder(
    folder_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user)
):
    """Get a specific folder by its ID."""
    rss_service = RssService(db=db, user_id=UUID(current_user.sub))
    folder = await rss_service.get_folder(folder_id=folder_id)
    if not folder:
        logger.warning("Folder not found or access denied", folder_id=folder_id, user_id=current_user.sub)
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Folder not found")
    return folder


@router.put("/folders/{folder_id}", response_model=FolderResponse)
async def update_folder(
    folder_id: UUID,
    folder_in: FolderUpdate = Body(...),
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user)
):
    """Update a folder's details."""
    rss_service = RssService(db=db, user_id=UUID(current_user.sub))
    try:
        updated_folder = await rss_service.update_folder(folder_id=folder_id, folder_in=folder_in)
        if not updated_folder:
            logger.warning("Folder not found for update or access denied", folder_id=folder_id, user_id=current_user.sub)
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Folder not found")
        logger.info("Folder updated successfully", folder_id=updated_folder.id, user_id=current_user.sub)
        return updated_folder
    except ValueError as e:
        logger.warning("Failed to update folder due to value error", error=str(e), user_id=current_user.sub, folder_id=folder_id)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error("Unexpected error updating folder", error=str(e), user_id=current_user.sub, folder_id=folder_id)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="An unexpected error occurred while updating the folder.")


@router.delete("/folders/{folder_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_folder(
    folder_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user)
):
    """Delete a folder."""
    rss_service = RssService(db=db, user_id=UUID(current_user.sub))
    try:
        success = await rss_service.delete_folder(folder_id=folder_id)
        if not success:
            logger.warning("Folder not found for deletion or access denied", folder_id=folder_id, user_id=current_user.sub)
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Folder not found")
        logger.info("Folder deleted successfully", folder_id=folder_id, user_id=current_user.sub)
        return
    except ValueError as e:
        logger.warning("Failed to delete folder due to value error", error=str(e), user_id=current_user.sub, folder_id=folder_id)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error("Unexpected error deleting folder", error=str(e), user_id=current_user.sub, folder_id=folder_id)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="An unexpected error occurred while deleting the folder.") 