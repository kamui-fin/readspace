from typing import List, Optional
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.feedback_models import Feedback
from app.repositories.base import BaseRepository
from app.schemas.feedback import FeedbackCreate

class FeedbackRepository(BaseRepository[Feedback, FeedbackCreate, FeedbackCreate]):
    """Repository for feedback operations."""

    def __init__(self):
        super().__init__(Feedback)

    async def get_all(self, db: AsyncSession, skip: int = 0, limit: int = 100) -> List[Feedback]:
        """Get all feedback entries."""
        query = select(self.model).offset(skip).limit(limit)
        result = await db.execute(query)
        return result.scalars().all()

    async def get(self, db: AsyncSession, feedback_id: UUID) -> Optional[Feedback]:
        """Get a feedback entry by ID."""
        query = select(self.model).where(self.model.id == feedback_id)
        result = await db.execute(query)
        return result.scalar_one_or_none() 