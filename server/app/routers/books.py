from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import BookRepo, DatabaseSession
from app.repositories.books import BookRepository
from app.schemas.books import BookCreate, BookUpdate, BookProgress, BookResponse

router = APIRouter(prefix="/books", tags=["books"])

@router.get("/", response_model=List[BookResponse])
async def get_books(
    user_id: UUID,
    skip: int = 0,
    limit: int = 100,
    db: DatabaseSession = Depends(),
    book_repo: BookRepository = Depends(BookRepo)
) -> List[BookResponse]:
    """Get all books for a user."""
    books = await book_repo.get_user_books(user_id, skip=skip, limit=limit)
    return books

@router.get("/{book_id}", response_model=BookResponse)
async def get_book(
    book_id: UUID,
    db: DatabaseSession = Depends(),
    book_repo: BookRepository = Depends(BookRepo)
) -> BookResponse:
    """Get a specific book by ID."""
    book = await book_repo.get(book_id)
    if not book:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Book not found"
        )
    return book

@router.post("/", response_model=BookResponse)
async def create_book(
    book: BookCreate,
    db: DatabaseSession = Depends(),
    book_repo: BookRepository = Depends(BookRepo)
) -> BookResponse:
    """Create a new book."""
    return await book_repo.create(book)

@router.put("/{book_id}", response_model=BookResponse)
async def update_book(
    book_id: UUID,
    book: BookUpdate,
    db: DatabaseSession = Depends(),
    book_repo: BookRepository = Depends(BookRepo)
) -> BookResponse:
    """Update a book."""
    updated_book = await book_repo.update(book_id, book)
    if not updated_book:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Book not found"
        )
    return updated_book

@router.delete("/{book_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_book(
    book_id: UUID,
    db: DatabaseSession = Depends(),
    book_repo: BookRepository = Depends(BookRepo)
) -> None:
    """Delete a book."""
    success = await book_repo.delete(book_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Book not found"
        )

@router.put("/{book_id}/progress", response_model=BookResponse)
async def update_book_progress(
    book_id: UUID,
    progress: BookProgress,
    db: DatabaseSession = Depends(),
    book_repo: BookRepository = Depends(BookRepo)
) -> BookResponse:
    """Update a book's progress."""
    updated_book = await book_repo.update_progress(book_id, progress)
    if not updated_book:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Book not found"
        )
    return updated_book

@router.put("/{book_id}/language", response_model=BookResponse)
async def update_book_language(
    book_id: UUID,
    language: str,
    db: DatabaseSession = Depends(),
    book_repo: BookRepository = Depends(BookRepo)
) -> BookResponse:
    """Update a book's language."""
    updated_book = await book_repo.update_language(book_id, language)
    if not updated_book:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Book not found"
        )
    return updated_book 