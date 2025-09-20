from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.rss_models import Folder
from app.schemas.rss_schemas import FolderCreate, FolderUpdate


async def get_folder(db: AsyncSession, *, folder_id: UUID, user_id: UUID) -> Folder | None:
    """Get a specific folder by its ID and user ID."""
    result = await db.execute(select(Folder).filter(Folder.id == folder_id, Folder.user_id == user_id))
    return result.scalars().first()


async def get_folder_by_name(db: AsyncSession, *, name: str, user_id: UUID) -> Folder | None:
    """Get a specific folder by its name and user ID."""
    result = await db.execute(select(Folder).filter(Folder.name == name, Folder.user_id == user_id))
    return result.scalars().first()


async def get_folders_by_user(db: AsyncSession, *, user_id: UUID, skip: int = 0, limit: int = 100) -> list[Folder]:
    """Get all folders for a specific user with pagination."""
    result = await db.execute(
        select(Folder).filter(Folder.user_id == user_id).order_by(Folder.name).offset(skip).limit(limit)
    )
    return list(result.scalars().all())


async def create_folder(db: AsyncSession, *, folder_in: FolderCreate, user_id: UUID) -> Folder:
    """Create a new folder for a user."""
    # Check if folder with the same name already exists for this user
    existing_folder = await get_folder_by_name(db, name=folder_in.name, user_id=user_id)
    if existing_folder:
        # Consider raising a custom exception or returning the existing one
        # For now, let's prevent duplicates by raising an error that can be caught by the API layer
        raise IntegrityError(
            f"Folder with name '{folder_in.name}' already exists for this user.",
            params=None,
            orig=ValueError("Duplicate folder name"),
        )

    db_folder = Folder(**folder_in.model_dump(), user_id=user_id)
    db.add(db_folder)
    await db.commit()
    await db.refresh(db_folder)
    return db_folder


async def update_folder(db: AsyncSession, *, folder_db: Folder, folder_in: FolderUpdate) -> Folder:
    """Update an existing folder."""
    update_data = folder_in.model_dump(exclude_unset=True)
    if "name" in update_data and update_data["name"] != folder_db.name:
        # Check if the new name conflicts with an existing folder for the same user
        user_id: UUID = folder_db.user_id  # type: ignore
        existing_folder_with_new_name = await get_folder_by_name(db, name=update_data["name"], user_id=user_id)
        if existing_folder_with_new_name and existing_folder_with_new_name.id != folder_db.id:
            raise IntegrityError(
                f"Another folder with name '{update_data['name']}' already exists for this user.",
                params=None,
                orig=ValueError("Duplicate folder name"),
            )

    for field, value in update_data.items():
        setattr(folder_db, field, value)

    db.add(folder_db)
    await db.commit()
    await db.refresh(folder_db)
    return folder_db


async def delete_folder(db: AsyncSession, *, folder_id: UUID, user_id: UUID) -> Folder | None:
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


async def create_folders_batch(db: AsyncSession, *, folder_names: list[str], user_id: UUID) -> dict[str, UUID]:
    """
    Bulk create multiple folders for a user, handling race conditions.
    Returns a mapping of folder name to folder ID.
    """
    if not folder_names:
        return {}

    try:
        # Step 1: Prepare bulk insert data
        current_time = datetime.now(timezone.utc)
        folder_mappings = []

        for name in folder_names:
            folder_mappings.append(
                {
                    "name": name,
                    "user_id": user_id,
                    "created_at": current_time,
                    "updated_at": current_time,
                }
            )

        # Step 2: Bulk insert with ON CONFLICT DO NOTHING to handle race conditions
        folder_insert_stmt = insert(Folder).values(folder_mappings)
        folder_returning_stmt = folder_insert_stmt.on_conflict_do_nothing(
            index_elements=["user_id", "name"]  # Based on unique constraint
        ).returning(
            Folder.id,
            Folder.name,
        )

        result = await db.execute(folder_returning_stmt)
        created_folders = result.fetchall()

        # Step 3: Handle any folders that weren't created due to conflicts
        created_folder_names = {row.name for row in created_folders}
        missing_folder_names = set(folder_names) - created_folder_names

        folder_name_to_id = {row.name: row.id for row in created_folders}

        # Step 4: Fetch existing folders for any that had conflicts
        if missing_folder_names:
            existing_result = await db.execute(
                select(Folder.id, Folder.name).filter(Folder.user_id == user_id, Folder.name.in_(missing_folder_names))
            )
            existing_folders = existing_result.fetchall()

            for row in existing_folders:
                folder_name_to_id[row.name] = row.id

        await db.commit()
        return folder_name_to_id

    except Exception as e:
        await db.rollback()
        raise e
