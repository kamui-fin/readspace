"""Service for folder operations."""

from uuid import UUID

import structlog
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud import crud_folder
from app.schemas import FolderCreate, FolderResponse, FolderUpdate

logger = structlog.get_logger(__name__)


class FolderService:
    """Service for managing RSS feed folders."""

    def __init__(self, db: AsyncSession, user_id: UUID):
        self.db = db
        self.user_id = user_id

    async def create_folder(self, folder_in: FolderCreate) -> FolderResponse:
        """Create a new folder for the user."""
        logger.info("Creating new folder", user_id=self.user_id, name=folder_in.name)
        folder_db = await crud_folder.create_folder(db=self.db, folder_in=folder_in, user_id=self.user_id)
        return FolderResponse.model_validate(folder_db)

    async def get_folder(self, folder_id: UUID) -> FolderResponse | None:
        """Get folder by ID for the current user."""
        folder_db = await crud_folder.get_folder(db=self.db, folder_id=folder_id, user_id=self.user_id)
        return FolderResponse.model_validate(folder_db) if folder_db else None

    async def list_folders(self, skip: int = 0, limit: int = 100) -> list[FolderResponse]:
        """List all folders for the current user."""
        folders_db = await crud_folder.get_folders_by_user(db=self.db, user_id=self.user_id, skip=skip, limit=limit)
        return [FolderResponse.model_validate(folder) for folder in folders_db]

    async def update_folder(self, folder_id: UUID, folder_in: FolderUpdate) -> FolderResponse | None:
        """Update folder name or other editable attributes."""
        logger.info("Updating folder", folder_id=folder_id, user_id=self.user_id)

        # First get the folder to ensure it exists and belongs to the user
        folder_db = await crud_folder.get_folder(db=self.db, folder_id=folder_id, user_id=self.user_id)
        if not folder_db:
            return None

        # Now update it with the CRUD function that expects the database object
        updated_folder = await crud_folder.update_folder(db=self.db, folder_db=folder_db, folder_in=folder_in)
        return FolderResponse.model_validate(updated_folder)

    async def delete_folder(self, folder_id: UUID) -> bool:
        """Delete a folder. Associated feeds will be moved to the default folder."""
        logger.info("Deleting folder", folder_id=folder_id, user_id=self.user_id)
        result = await crud_folder.delete_folder(db=self.db, folder_id=folder_id, user_id=self.user_id)
        if result:
            logger.info("Folder deleted successfully", folder_id=folder_id)
            return True
        else:
            logger.warning("Folder not found or couldn't be deleted", folder_id=folder_id)
            return False

    async def create_folders_batch(self, folder_names: list[str]) -> dict[str, UUID]:
        """
        Bulk create multiple folders, handling race conditions and duplicates.
        Returns a mapping of folder name to folder ID.
        """
        logger.info(
            "Bulk creating folders",
            folder_count=len(folder_names),
            user_id=self.user_id,
            folder_names=folder_names[:5],  # Log first 5 for debugging
        )

        folder_name_to_id = await crud_folder.create_folders_batch(
            db=self.db, folder_names=folder_names, user_id=self.user_id
        )

        logger.info(
            "Bulk folder creation completed",
            created_count=len(folder_name_to_id),
            user_id=self.user_id,
        )

        return folder_name_to_id

    async def get_default_folder(self) -> FolderResponse | None:
        """Get the default 'My Feeds' folder for the user."""
        logger.debug("Getting default folder", user_id=self.user_id)
        folders = await crud_folder.get_folders_by_user(db=self.db, user_id=self.user_id)

        # Find the folder named 'My Feeds' (created by the trigger)
        for folder in folders:
            if folder.name == "My Feeds":
                return FolderResponse.model_validate(folder)

        # If no default folder exists, create one
        # This is a fallback for existing users who didn't have the trigger
        logger.info("Creating default folder for user", user_id=self.user_id)
        folder_create = FolderCreate(name="My Feeds")
        return await self.create_folder(folder_create)
