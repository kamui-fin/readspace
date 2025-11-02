from uuid import UUID

import structlog
from fastapi import APIRouter, Body, Depends, HTTPException, status
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.schemas import FolderCreate, FolderResponse, FolderUpdate
from app.schemas.auth import TokenData
from app.services.folder import FolderService
from app.services.user.auth import get_current_user

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
    folder_service = FolderService(db=db, user_id=UUID(current_user.sub))
    try:
        folder = await folder_service.create_folder(folder_in=folder_in)
        logger.info("Folder created successfully", folder_id=folder.id, user_id=current_user.sub)
        return folder
    except ValueError as e:
        logger.warning(
            "Failed to create folder due to value error",
            error=str(e),
            user_id=current_user.sub,
            folder_name=folder_in.name,
        )
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid folder data") from e
    except Exception as e:
        logger.error(
            "Unexpected error creating folder",
            error=str(e),
            user_id=current_user.sub,
            folder_name=folder_in.name,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred while creating the folder.",
        ) from e


@router.get("/", response_model=list[FolderResponse])
async def list_folders(
    db: AsyncSession = Depends(get_db),
    skip: int = 0,
    limit: int = 100,
    current_user: TokenData = Depends(get_current_user),
) -> list[FolderResponse]:
    """List all folders for the current user."""
    folder_service = FolderService(db=db, user_id=UUID(current_user.sub))
    folders = await folder_service.list_folders(skip=skip, limit=limit)
    return folders


@router.get("/{folder_id}", response_model=FolderResponse)
async def get_folder(
    folder_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
) -> FolderResponse:
    """Get a specific folder by its ID."""
    folder_service = FolderService(db=db, user_id=UUID(current_user.sub))
    folder = await folder_service.get_folder(folder_id=folder_id)
    if not folder:
        logger.warning(
            "Folder not found or access denied",
            folder_id=folder_id,
            user_id=current_user.sub,
        )
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Folder not found")
    return folder


@router.put("/{folder_id}", response_model=FolderResponse)
async def update_folder(
    folder_id: UUID,
    folder_in: FolderUpdate = Body(...),
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
) -> FolderResponse:
    """Update a folder's details."""
    folder_service = FolderService(db=db, user_id=UUID(current_user.sub))
    try:
        updated_folder = await folder_service.update_folder(folder_id=folder_id, folder_in=folder_in)
        if not updated_folder:
            logger.warning(
                "Folder not found for update or access denied",
                folder_id=folder_id,
                user_id=current_user.sub,
            )
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Folder not found")
        logger.info(
            "Folder updated successfully",
            folder_id=updated_folder.id,
            user_id=current_user.sub,
        )
        return updated_folder
    except ValueError as e:
        logger.warning(
            "Failed to update folder due to value error",
            error=str(e),
            user_id=current_user.sub,
            folder_id=folder_id,
        )
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid folder data") from e
    except Exception as e:
        logger.error(
            "Unexpected error updating folder",
            error=str(e),
            user_id=current_user.sub,
            folder_id=folder_id,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred while updating the folder.",
        ) from e


@router.delete("/{folder_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_folder(
    folder_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
) -> JSONResponse:
    """Delete a folder."""
    folder_service = FolderService(db=db, user_id=UUID(current_user.sub))
    try:
        # First check if folder exists
        folder = await folder_service.get_folder(folder_id=folder_id)
        if not folder:
            logger.warning(
                "Folder not found for deletion",
                folder_id=folder_id,
                user_id=current_user.sub,
            )
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Folder not found")

        # Then try to delete it
        success = await folder_service.delete_folder(folder_id=folder_id)
        if not success:
            # This shouldn't happen since we already checked existence, but just in case
            logger.warning(
                "Deletion returned false despite folder existing",
                folder_id=folder_id,
                user_id=current_user.sub,
            )
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Folder not found")

        logger.info("Folder deleted successfully", folder_id=folder_id, user_id=current_user.sub)
        return JSONResponse(status_code=status.HTTP_200_OK, content={"ok": True})
    except ValueError as e:
        logger.warning(
            "Failed to delete folder due to value error",
            error=str(e),
            user_id=current_user.sub,
            folder_id=folder_id,
        )
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid folder data") from e
    except Exception as e:
        logger.error(
            "Unexpected error deleting folder",
            error=str(e),
            user_id=current_user.sub,
            folder_id=folder_id,
            exc_info=True,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred while deleting the folder",
        ) from e
