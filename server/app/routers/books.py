from typing import List, Annotated
from uuid import UUID

from app.core.database import get_db
from app.repositories.books import BookRepository
from app.schemas.books import BookCreate, BookProgress, BookResponse, BookUpdate
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(prefix="/books", tags=["books"])
book_repo = BookRepository()


@router.get("/", response_model=List[BookResponse])
async def get_books(
    db: Annotated[AsyncSession, Depends(get_db)],
    skip: int = 0,
    limit: int = 100
):
    """Get all books for a user."""
    return await book_repo.get_multi(db, skip=skip, limit=limit)


@router.get("/{book_id}", response_model=BookResponse)
async def get_book(
    book_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)]
):
    """Get a specific book by ID."""
    book = await book_repo.get(db, book_id)
    if not book:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Book not found"
        )
    return book


@router.post("/", response_model=BookResponse)
async def create_book(
    book: BookCreate,
    db: Annotated[AsyncSession, Depends(get_db)]
):
    """Create a new book."""
    return await book_repo.create(db, book)


@router.put("/{book_id}", response_model=BookResponse)
async def update_book(
    book_id: UUID,
    book: BookUpdate,
    db: Annotated[AsyncSession, Depends(get_db)]
):
    """Update a book."""
    updated_book = await book_repo.update(db, book_id, book)
    if not updated_book:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Book not found"
        )
    return updated_book


@router.delete("/{book_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_book(
    book_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)]
):
    """Delete a book."""
    success = await book_repo.delete(db, book_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Book not found"
        )


@router.put("/{book_id}/progress", response_model=BookResponse)
async def update_book_progress(
    book_id: UUID,
    progress: BookProgress,
    db: Annotated[AsyncSession, Depends(get_db)]
):
    """Update a book's progress."""
    updated_book = await book_repo.update_progress(db, book_id, progress.dict(exclude_unset=True))
    if not updated_book:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Book not found"
        )
    return updated_book
