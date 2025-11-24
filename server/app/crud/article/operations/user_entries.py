"""CRUD operations for UserEntry model."""

from uuid import UUID

from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.crud.article.operations.base import CRUDBase
from app.models import UserEntry
from app.schemas import UserEntryCreate, UserEntryUpdate


class CRUDUserEntry:
    """CRUD operations for user article entries."""

    async def get_by_user_and_content(self, db: AsyncSession, *, user_id: UUID, content_id: UUID) -> UserEntry | None:
        """Get user entry by user ID and content ID."""
        result = await db.execute(
            select(UserEntry)
            .options(selectinload(UserEntry.content))
            .where(and_(UserEntry.user_id == user_id, UserEntry.content_id == content_id))
        )
        return result.scalar_one_or_none()

    async def get_read_later(self, db: AsyncSession, *, user_id: UUID, limit: int = 50) -> list[UserEntry]:
        """Get user's read later articles."""
        result = await db.execute(
            select(UserEntry)
            .options(selectinload(UserEntry.content))
            .where(and_(UserEntry.user_id == user_id, UserEntry.is_read_later == True))
            .order_by(UserEntry.created_at.desc())
            .limit(limit)
        )
        return list(result.scalars().all())

    async def get_favorites(self, db: AsyncSession, *, user_id: UUID, limit: int = 50) -> list[UserEntry]:
        """Get user's favorite articles."""
        result = await db.execute(
            select(UserEntry)
            .options(selectinload(UserEntry.content))
            .where(and_(UserEntry.user_id == user_id, UserEntry.is_favorite == True))
            .order_by(UserEntry.created_at.desc())
            .limit(limit)
        )
        return list(result.scalars().all())

    async def upsert_entry(
        self, db: AsyncSession, *, user_id: UUID, content_id: UUID, feed_article_id: UUID | None = None, **kwargs
    ) -> UserEntry:
        """Create or update a user entry."""
        entry = await self.get_by_user_and_content(db, user_id=user_id, content_id=content_id)

        if entry:
            # Update existing
            for key, value in kwargs.items():
                setattr(entry, key, value)
        else:
            # Create new
            entry = UserEntry(user_id=user_id, content_id=content_id, feed_article_id=feed_article_id, **kwargs)
            db.add(entry)

        await db.flush()
        await db.refresh(entry)
        return entry


# Create instance
user_entries = CRUDUserEntry(UserEntry)
