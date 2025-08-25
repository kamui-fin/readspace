"""Service for folder operations."""

from uuid import UUID

import structlog
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud import crud_folder
from app.schemas.rss_schemas import FolderCreate, FolderResponse, FolderUpdate

logger = structlog.get_logger(__name__)


class FolderService:
    """Service for managing RSS feed folders."""

    def __init__(self, db: AsyncSession, user_id: UUID):
        self.db = db
        self.user_id = user_id

    async def create_folder(self, folder_in: FolderCreate) -> FolderResponse:
        """Create a new folder for the user."""
        logger.info("Creating new folder", user_id=self.user_id, name=folder_in.name)
        folder_db = await crud_folder.create_folder(
            db=self.db, folder_in=folder_in, user_id=self.user_id
        )
        return FolderResponse.model_validate(folder_db)

    async def get_folder(self, folder_id: UUID) -> FolderResponse | None:
        """Get folder by ID for the current user."""
        folder_db = await crud_folder.get_folder(
            db=self.db, folder_id=folder_id, user_id=self.user_id
        )
        return FolderResponse.model_validate(folder_db) if folder_db else None

    async def list_folders(
        self, skip: int = 0, limit: int = 100
    ) -> list[FolderResponse]:
        """List all folders for the current user."""
        folders_db = await crud_folder.get_folders_by_user(
            db=self.db, user_id=self.user_id, skip=skip, limit=limit
        )
        return [FolderResponse.model_validate(folder) for folder in folders_db]

    async def update_folder(
        self, folder_id: UUID, folder_in: FolderUpdate
    ) -> FolderResponse | None:
        """Update folder name or other editable attributes."""
        logger.info("Updating folder", folder_id=folder_id, user_id=self.user_id)
        updated_folder = await crud_folder.update_folder(
            db=self.db, folder_id=folder_id, folder_in=folder_in, user_id=self.user_id
        )
        if updated_folder:
            return FolderResponse.model_validate(updated_folder)
        return None

    async def delete_folder(self, folder_id: UUID) -> bool:
        """Delete a folder. Associated feeds will be moved to the default folder."""
        logger.info("Deleting folder", folder_id=folder_id, user_id=self.user_id)
        result = await crud_folder.delete_folder(
            db=self.db, folder_id=folder_id, user_id=self.user_id
        )
        if result:
            logger.info("Folder deleted successfully", folder_id=folder_id)
        else:
            logger.warning(
                "Folder not found or couldn't be deleted", folder_id=folder_id
            )
        return result
