from typing import List, Optional
from uuid import UUID

from app.models.rss_models import Folder
from app.schemas.rss_schemas import FolderCreate, FolderUpdate
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession


async def get_folder(db: AsyncSession, *, folder_id: UUID, user_id: UUID) -> Optional[Folder]:
    """Get a specific folder by its ID and user ID."""
    result = await db.execute(
        select(Folder).filter(Folder.id == folder_id, Folder.user_id == user_id)
    )
    return result.scalars().first()

async def get_folder_by_name(
    db: AsyncSession, *, name: str, user_id: UUID
) -> Optional[Folder]:
    """Get a specific folder by its name and user ID."""
    result = await db.execute(
        select(Folder).filter(Folder.name == name, Folder.user_id == user_id)
    )
    return result.scalars().first()

async def get_folders_by_user(
    db: AsyncSession, *, user_id: UUID, skip: int = 0, limit: int = 100
) -> List[Folder]:
    """Get all folders for a specific user with pagination."""
    result = await db.execute(
        select(Folder)
        .filter(Folder.user_id == user_id)
        .order_by(Folder.name)
        .offset(skip)
        .limit(limit)
    )
    return result.scalars().all()

async def create_folder(
    db: AsyncSession, *, folder_in: FolderCreate, user_id: UUID
) -> Folder:
    """Create a new folder for a user."""
    # Check if folder with the same name already exists for this user
    existing_folder = await get_folder_by_name(db, name=folder_in.name, user_id=user_id)
    if existing_folder:
        # Consider raising a custom exception or returning the existing one
        # For now, let's prevent duplicates by raising an error that can be caught by the API layer
        raise IntegrityError(
            f"Folder with name '{folder_in.name}' already exists for this user.",
            params=None,
            orig=None
        ) 

    db_folder = Folder(**folder_in.model_dump(), user_id=user_id)
    db.add(db_folder)
    await db.commit()
    await db.refresh(db_folder)
    return db_folder

async def update_folder(
    db: AsyncSession, *, folder_db: Folder, folder_in: FolderUpdate
) -> Folder:
    """Update an existing folder."""
    update_data = folder_in.model_dump(exclude_unset=True)
    if "name" in update_data and update_data["name"] != folder_db.name:
        # Check if the new name conflicts with an existing folder for the same user
        existing_folder_with_new_name = await get_folder_by_name(db, name=update_data["name"], user_id=folder_db.user_id)
        if existing_folder_with_new_name and existing_folder_with_new_name.id != folder_db.id:
            raise IntegrityError(
                f"Another folder with name '{update_data['name']}' already exists for this user.",
                params=None,
                orig=None
            )

    for field, value in update_data.items():
        setattr(folder_db, field, value)
    
    db.add(folder_db)
    await db.commit()
    await db.refresh(folder_db)
    return folder_db

async def delete_folder(db: AsyncSession, *, folder_id: UUID, user_id: UUID) -> Optional[Folder]:
    """Delete a folder by its ID and user ID.
    Note: This will fail if the folder has feeds associated due to foreign key constraints,
    unless cascade delete is configured (which it is not by default for this relation).
    The service layer should handle checking for associated feeds before deletion.
    """
    # First, fetch the folder to ensure it exists and belongs to the user
    db_folder = await get_folder(db, folder_id=folder_id, user_id=user_id)
    if db_folder:
        await db.delete(db_folder)
        await db.commit()
    return db_folder 