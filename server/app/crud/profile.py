"""
CRUD operations for Profile model
"""

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import Profile
from app.schemas.user import ProfileCreate


async def get_profile_by_id(db: AsyncSession, *, user_id: UUID) -> Profile | None:
    """Get profile by user ID"""
    result = await db.execute(select(Profile).where(Profile.id == user_id))
    return result.scalar_one_or_none()


async def create_profile(db: AsyncSession, *, profile_in: ProfileCreate) -> Profile:
    """Create a new profile"""
    db_profile = Profile(**profile_in.model_dump())
    db.add(db_profile)
    await db.flush()
    await db.refresh(db_profile)
    return db_profile


async def create_profile_if_not_exists(db: AsyncSession, *, user_id: UUID, email: str) -> Profile:
    """Create profile if it doesn't exist, otherwise return existing"""
    existing = await get_profile_by_id(db, user_id=user_id)
    if existing:
        return existing

    profile_data = ProfileCreate(id=user_id, email=email)
    return await create_profile(db, profile_in=profile_data)
