from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import StorageError
from app.models.book_models import BookMetadata, UserBookLibrary
from app.schemas.books import (
    UserBookLibraryCreate,
    UserBookLibraryResponse,
    UserBookLibraryUpdate,
)


class BookRepository:
    """Repository for book operations."""

    def __init__(self) -> None:
        self.model = BookMetadata

    async def get_by_title(self, db: AsyncSession, title: str) -> BookMetadata | None:
        """Get a book by its title."""
        try:
            query = select(self.model).where(self.model.title == title)
            result = await db.execute(query)
            return result.scalar_one_or_none()
        except Exception as e:
            raise StorageError(f"Failed to get book by title: {str(e)}") from e

    async def get_user_books(
        self, db: AsyncSession, user_id: UUID, skip: int = 0, limit: int = 100
    ) -> list[UserBookLibraryResponse]:
        """Get all books in a user's library."""
        query = (
            select(UserBookLibrary)
            .options(selectinload(UserBookLibrary.book_metadata))
            .where(UserBookLibrary.user_id == user_id)
            .offset(skip)
            .limit(limit)
        )
        result = await db.execute(query)
        return list(result.scalars().all())

    async def get_user_book(self, db: AsyncSession, library_id: UUID, user_id: UUID) -> UserBookLibraryResponse | None:
        """Get a specific book from a user's library."""
        stmt = (
            select(UserBookLibrary)
            .join(BookMetadata, UserBookLibrary.book_metadata_id == BookMetadata.id)
            .where(UserBookLibrary.id == library_id, UserBookLibrary.user_id == user_id)
        )
        result = await db.execute(stmt)
        db_obj = result.scalar_one_or_none()
        if not db_obj:
            return None

        # Ensure the relationship is loaded
        await db.refresh(db_obj, ["book_metadata"])
        return db_obj

    async def add_to_library(self, db: AsyncSession, obj_in: UserBookLibraryCreate) -> UserBookLibraryResponse:
        """Add a book to user's library."""
        db_obj = UserBookLibrary(**obj_in.model_dump())
        db.add(db_obj)
        await db.commit()
        await db.refresh(db_obj)
        # Eagerly load the relationship
        await db.refresh(db_obj, ["book_metadata"])
        return db_obj

    async def update_user_book(
        self,
        db: AsyncSession,
        library_id: UUID,
        user_id: UUID,
        obj_in: UserBookLibraryUpdate,
    ) -> UserBookLibraryResponse | None:
        """Update a book in user's library."""
        query = (
            select(UserBookLibrary)
            .options(selectinload(UserBookLibrary.book_metadata))
            .where(UserBookLibrary.id == library_id, UserBookLibrary.user_id == user_id)
        )
        result = await db.execute(query)
        db_obj = result.scalar_one_or_none()
        if not db_obj:
            return None

        update_data = obj_in.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(db_obj, field, value)

        await db.commit()
        await db.refresh(db_obj)
        return db_obj

    async def remove_from_library(self, db: AsyncSession, library_id: UUID, user_id: UUID) -> bool:
        """Remove a book from user's library."""
        query = select(UserBookLibrary).where(UserBookLibrary.id == library_id, UserBookLibrary.user_id == user_id)
        result = await db.execute(query)
        db_obj = result.scalar_one_or_none()
        if not db_obj:
            return False

        await db.delete(db_obj)
        await db.commit()
        return True

    async def update_progress(self, db: AsyncSession, book_id: UUID, progress_data: dict) -> BookMetadata:
        """Update book progress."""
        try:
            query = select(self.model).where(self.model.id == book_id)
            result = await db.execute(query)
            book: BookMetadata | None = result.scalar_one_or_none()

            if not book:
                raise StorageError(f"Book not found: {book_id}")

            # Update progress based on book format
            if book.format == "EPUB":
                book.epub_progress = progress_data
            else:
                book.pdf_current_page = progress_data.get("page", 0)

            await db.commit()
            await db.refresh(book)
            return book
        except Exception as e:
            await db.rollback()
            raise StorageError(f"Failed to update book progress: {str(e)}") from e

    async def get_with_highlights(self, db: AsyncSession, book_id: UUID) -> BookMetadata | None:
        """Get a book with its highlights."""
        try:
            query = select(self.model).options(selectinload(self.model.highlights)).where(self.model.id == book_id)
            result = await db.execute(query)
            return result.scalar_one_or_none()
        except Exception as e:
            raise StorageError(f"Failed to get book with highlights: {str(e)}") from e
