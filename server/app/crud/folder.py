from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Folder
from app.schemas import FolderCreate, FolderUpdate

async def get_by_id(db: AsyncSession, folder_id: UUID, user_id: UUID) -> Folder | None:
    """Get a specific folder owned by the user."""
    stmt = select(Folder).where(Folder.id == folder_id, Folder.user_id == user_id)
    result = await db.execute(stmt)
    return result.scalar_one_or_none()

async def get_by_name(db: AsyncSession, name: str, user_id: UUID) -> Folder | None:
    """Get a folder by name owned by the user."""
    stmt = select(Folder).where(Folder.name == name, Folder.user_id == user_id)
    result = await db.execute(stmt)
    return result.scalar_one_or_none()

async def list_by_user(
    db: AsyncSession, 
    user_id: UUID, 
    skip: int = 0, 
    limit: int = 100
) -> list[Folder]:
    """List all folders for a user."""
    stmt = (
        select(Folder)
        .where(Folder.user_id == user_id)
        .order_by(Folder.name)
        .offset(skip)
        .limit(limit)
    )
    result = await db.execute(stmt)
    return list(result.scalars().all())

async def create(db: AsyncSession, obj_in: FolderCreate, user_id: UUID) -> Folder:
    """Create a new folder."""
    db_obj = Folder(**obj_in.model_dump(), user_id=user_id)
    db.add(db_obj)
    await db.flush()
    await db.refresh(db_obj)
    return db_obj

async def update(
    db: AsyncSession, 
    db_obj: Folder, 
    obj_in: FolderUpdate
) -> Folder:
    """Update a folder."""
    update_data = obj_in.model_dump(exclude_unset=True)
    
    for field, value in update_data.items():
        setattr(db_obj, field, value)

    db.add(db_obj)
    await db.flush()
    await db.refresh(db_obj)
    return db_obj

async def delete(db: AsyncSession, db_obj: Folder) -> None:
    """Delete a folder."""
    await db.delete(db_obj)

async def upsert_batch(
    db: AsyncSession, 
    folder_names: list[str], 
    user_id: UUID
) -> dict[str, UUID]:
    """
    Batch Insert/Get folders.
    Returns: { "Folder Name": UUID }
    """
    if not folder_names:
        return {}

    current_time = datetime.now(timezone.utc)
    
    # Prepare values
    values = [
        {
            "name": name,
            "user_id": user_id,
            "created_at": current_time,
            "updated_at": current_time,
        }
        for name in folder_names
    ]

    # Efficient Upsert
    stmt = insert(Folder).values(values)
    stmt = stmt.on_conflict_do_update(
        index_elements=["user_id", "name"],
        set_={"updated_at": current_time}, # Touch timestamp to ensure return
    ).returning(Folder.id, Folder.name)

    result = await db.execute(stmt)
    return {row.name: row.id for row in result.fetchall()}