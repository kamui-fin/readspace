from typing import List, Optional
from uuid import UUID

from app.core.exceptions import StorageError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.models.book_models import BookMetadata, UserBookLibrary
from app.repositories.base import BaseRepository
from app.schemas.book import BookCreate, BookUpdate

class BookRepository(BaseRepository[BookMetadata, BookCreate, BookUpdate]):
    """Repository for book operations."""

    def __init__(self):
        super().__init__(BookMetadata)

    async def get_by_title(self, db: AsyncSession, title: str) -> Optional[BookMetadata]:
        """Get a book by its title."""
        try:
            query = select(self.model).where(self.model.title == title)
            result = await db.execute(query)
            return result.scalar_one_or_none()
        except Exception as e:
            raise StorageError(f"Failed to get book by title: {str(e)}")

    async def get_user_books(
        self,
        db: AsyncSession,
        user_id: UUID,
        skip: int = 0,
        limit: int = 100
    ) -> List[BookMetadata]:
        """Get all books for a specific user."""
        try:
            query = (
                select(self.model)
                .join(UserBookLibrary)
                .where(UserBookLibrary.user_id == user_id)
                .offset(skip)
                .limit(limit)
            )
            result = await db.execute(query)
            return result.scalars().all()
        except Exception as e:
            raise StorageError(f"Failed to get user books: {str(e)}")

    async def update_progress(
        self,
        db: AsyncSession,
        book_id: UUID,
        progress_data: dict
    ) -> BookMetadata:
        """Update book progress."""
        try:
            query = (
                select(self.model)
                .where(self.model.id == book_id)
            )
            result = await db.execute(query)
            book = result.scalar_one_or_none()
            
            if not book:
                raise StorageError(f"Book not found: {book_id}")

            # Update progress based on book format
            if book.format == "epub":
                book.epub_progress = progress_data
            else:
                book.pdf_current_page = progress_data.get("page", 0)

            await db.commit()
            await db.refresh(book)
            return book
        except Exception as e:
            await db.rollback()
            raise StorageError(f"Failed to update book progress: {str(e)}")

    async def get_with_highlights(
        self,
        db: AsyncSession,
        book_id: UUID
    ) -> Optional[BookMetadata]:
        """Get a book with its highlights."""
        try:
            query = (
                select(self.model)
                .options(selectinload(self.model.highlights))
                .where(self.model.id == book_id)
            )
            result = await db.execute(query)
            return result.scalar_one_or_none()
        except Exception as e:
            raise StorageError(f"Failed to get book with highlights: {str(e)}") 