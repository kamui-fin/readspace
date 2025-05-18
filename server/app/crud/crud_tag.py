from typing import List, Optional
from uuid import UUID

from app.models.rss_models import Tag
from app.schemas.rss_schemas import TagCreate, TagUpdate
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession


async def get_tag(db: AsyncSession, *, tag_id: UUID, user_id: UUID) -> Optional[Tag]:
    """Get a specific tag by its ID and user ID."""
    result = await db.execute(
        select(Tag).filter(Tag.id == tag_id, Tag.user_id == user_id)
    )
    return result.scalars().first()

async def get_tag_by_name(db: AsyncSession, *, name: str, user_id: UUID) -> Optional[Tag]:
    """Get a specific tag by its name and user ID."""
    # Tag names should be case-insensitive unique per user
    result = await db.execute(
        select(Tag).filter(Tag.user_id == user_id, Tag.name.ilike(name))
    )
    return result.scalars().first()

async def get_tags_by_user(
    db: AsyncSession, *, user_id: UUID, skip: int = 0, limit: int = 100
) -> List[Tag]:
    """Get all tags for a specific user with pagination."""
    result = await db.execute(
        select(Tag)
        .filter(Tag.user_id == user_id)
        .order_by(Tag.name)
        .offset(skip)
        .limit(limit)
    )
    return result.scalars().all()

async def get_or_create_tag(db: AsyncSession, *, name: str, user_id: UUID) -> Tag:
    """Get a tag by name or create it if it doesn't exist for the user."""
    tag = await get_tag_by_name(db, name=name, user_id=user_id)
    if not tag:
        tag_in = TagCreate(name=name) # Name will be normalized by the service/API layer if needed
        tag = await create_tag(db, tag_in=tag_in, user_id=user_id)
    return tag

async def create_tag(db: AsyncSession, *, tag_in: TagCreate, user_id: UUID) -> Tag:
    """Create a new tag for a user."""
    # Normalize tag name (e.g., lowercase) before checking for existence
    # This should ideally be done consistently before calling this CRUD function
    normalized_name = tag_in.name # Assuming name is pre-normalized as per service layer
    existing_tag = await get_tag_by_name(db, name=normalized_name, user_id=user_id)
    if existing_tag:
        raise IntegrityError(
            f"Tag with name '{normalized_name}' already exists for this user.",
            params=None,
            orig=None
        )

    db_tag = Tag(name=normalized_name, user_id=user_id)
    db.add(db_tag)
    await db.commit()
    await db.refresh(db_tag)
    return db_tag

async def update_tag(
    db: AsyncSession, *, tag_db: Tag, tag_in: TagUpdate
) -> Tag:
    """Update an existing tag."""
    update_data = tag_in.model_dump(exclude_unset=True)
    if "name" in update_data and update_data["name"] != tag_db.name:
        # Normalize new tag name (service layer should ensure this is normalized coming in TagUpdate)
        normalized_new_name = update_data["name"]
        existing_tag_with_new_name = await get_tag_by_name(db, name=normalized_new_name, user_id=tag_db.user_id)
        if existing_tag_with_new_name and existing_tag_with_new_name.id != tag_db.id:
            raise IntegrityError(
                f"Another tag with name '{normalized_new_name}' already exists for this user.",
                params=None,
                orig=None
            )
        tag_db.name = normalized_new_name # Assign normalized name
        
        # Handle other fields if any (currently none for TagUpdate besides name)
        for field, value in update_data.items():
            if field != "name":
                setattr(tag_db, field, value)
    else: # If name is not in update_data, still apply other potential updates (currently none for TagUpdate)
        for field, value in update_data.items():
             if field != "name": # Ensure we don't somehow unset the name if it wasn't in update_data initially
                setattr(tag_db, field, value)

    db.add(tag_db)
    await db.commit()
    await db.refresh(tag_db)
    return tag_db

async def delete_tag(db: AsyncSession, *, tag_id: UUID, user_id: UUID) -> Optional[Tag]:
    """Delete a tag by its ID and user ID.
    Note: Associated feeds will have this tag removed from their tags list (many-to-many).
    The association itself handles this, so the tag can be deleted.
    """
    db_tag = await get_tag(db, tag_id=tag_id, user_id=user_id)
    if db_tag:
        # Feeds associated with this tag will automatically have the association removed
        # due to the nature of the many-to-many relationship setup without cascade delete on Tag itself.
        await db.delete(db_tag)
        await db.commit()
    return db_tag 