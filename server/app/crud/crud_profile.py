"""
CRUD operations for Profile model
"""

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud.base import CRUDBase
from app.models.user_models import Profile
from app.schemas.user_schemas import ProfileCreate, ProfileUpdate


class CRUDProfile(CRUDBase[Profile, ProfileCreate, ProfileUpdate]):
    """CRUD operations for user profiles"""

    async def get_by_id(self, db: AsyncSession, *, user_id: UUID) -> Profile | None:
        """Get profile by user ID"""
        result = await db.execute(select(Profile).where(Profile.id == user_id))
        return result.scalar_one_or_none()

    async def create_if_not_exists(
        self, db: AsyncSession, *, user_id: UUID, email: str
    ) -> Profile:
        """Create profile if it doesn't exist, otherwise return existing"""
        existing = await self.get_by_id(db, user_id=user_id)
        if existing:
            return existing

        profile_data = ProfileCreate(id=user_id, email=email)
        return await self.create(db, obj_in=profile_data)


# Create instance
crud_profile = CRUDProfile(Profile)
