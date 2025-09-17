import logging
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import StorageError
from app.models.book_models import Highlight, UserBookLibrary
from app.repositories.base import BaseRepository
from app.schemas.highlights import HighlightCreate, HighlightUpdate

logger = logging.getLogger(__name__)


class HighlightRepository(BaseRepository[Highlight, HighlightCreate, HighlightUpdate]):
    """Repository for highlight operations."""

    def __init__(self) -> None:
        super().__init__(Highlight)

    async def get_book_highlights(self, db: AsyncSession, book_id: UUID) -> list[Highlight]:
        """Get all highlights for a book."""
        try:
            logger.info(f"Building query for book_id: {book_id}")
            query = select(self.model).join(UserBookLibrary).where(UserBookLibrary.id == book_id)
            logger.info(f"Executing query: {query}")
            result = await db.execute(query)
            highlights = result.scalars().all()
            logger.info(f"Query returned {len(highlights)} highlights")
            return list(highlights)
        except Exception as e:
            logger.error(f"Failed to get book highlights: {str(e)}", exc_info=True)
            raise StorageError(f"Failed to get book highlights: {str(e)}") from e

    async def get_by_text(self, db: AsyncSession, text: str) -> Highlight | None:
        """Get a highlight by its text content."""
        try:
            query = select(self.model).where(self.model.original_text == text)
            result = await db.execute(query)
            return result.scalar_one_or_none()
        except Exception as e:
            raise StorageError(f"Failed to get highlight by text: {str(e)}") from e

    async def delete_by_text(self, db: AsyncSession, text: str) -> bool:
        """Delete highlights by text content using bulk operations."""
        try:
            # Use bulk delete for better performance
            from sqlalchemy import delete

            delete_stmt = delete(self.model).where(self.model.original_text == text)
            result = await db.execute(delete_stmt)
            await db.commit()
            return result.rowcount > 0
        except Exception as e:
            await db.rollback()
            raise StorageError(f"Failed to delete highlights by text: {str(e)}") from e

    async def update_note(self, db: AsyncSession, highlight_id: UUID, note: str) -> Highlight:
        """Update a highlight's note."""
        try:
            query = select(self.model).where(self.model.id == highlight_id)
            result = await db.execute(query)
            highlight: Highlight | None = result.scalar_one_or_none()

            if not highlight:
                raise StorageError(f"Highlight not found: {highlight_id}")

            assert highlight is not None  # Type narrowing for mypy
            highlight.note = note  # type: ignore[assignment]
            await db.commit()
            await db.refresh(highlight)
            return highlight
        except Exception as e:
            await db.rollback()
            raise StorageError(f"Failed to update highlight note: {str(e)}") from e

    async def update_note_by_text(self, db: AsyncSession, text: str, note: str) -> Highlight:
        """Update a highlight's note by text content."""
        try:
            query = select(self.model).where(self.model.original_text == text)
            result = await db.execute(query)
            highlight: Highlight | None = result.scalar_one_or_none()

            if not highlight:
                raise StorageError(f"Highlight not found with text: {text}")

            assert highlight is not None  # Type narrowing for mypy
            highlight.note = note  # type: ignore[assignment]
            await db.commit()
            await db.refresh(highlight)
            return highlight
        except Exception as e:
            await db.rollback()
            raise StorageError(f"Failed to update highlight note by text: {str(e)}") from e
