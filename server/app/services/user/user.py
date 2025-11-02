"""
User profile service
"""

from uuid import UUID

import structlog
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud.profile import crud_profile
from app.models.user import Profile
from app.schemas.auth import TokenData

logger = structlog.get_logger(__name__)


class UserService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def ensure_user_profile_exists(self, token_data: TokenData) -> Profile:
        """
        Ensure that a user profile exists in the database.
        Create one if it doesn't exist.
        """
        user_id = UUID(token_data.sub)
        email = token_data.email

        if not email:
            raise ValueError("User token must contain email")

        logger.debug(
            "Ensuring profile exists",
            user_id=user_id,
            email=email,
        )

        profile = await crud_profile.create_if_not_exists(self.db, user_id=user_id, email=email)

        logger.info(
            "User profile ensured",
            user_id=profile.id,
            email=profile.email,
            created_new=profile.created_at.replace(microsecond=0) == profile.updated_at.replace(microsecond=0),
        )

        return profile
