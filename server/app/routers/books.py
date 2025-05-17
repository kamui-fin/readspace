from typing import Annotated, List
from uuid import UUID

import structlog  # Added for logging
from app.core.database import get_db
from app.models.book_models import (  # Added UserBookLibrary for type hint
    BookMetadata,
    UserBookLibrary,
)
from app.repositories.books import BookRepository
from app.repositories.supabase import (
    StorageError,
    SupabaseStorageClient,
    get_storage_client,
)
from app.schemas.auth import TokenData
from app.schemas.books import (
    BookMetadataCreate,
    BookMetadataResponse,
    BookMetadataUpdate,
    UserBookLibraryCreate,
    UserBookLibraryResponse,
    UserBookLibraryUpdate,
)
from app.services.auth import get_current_user
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(prefix="/books", tags=["books"])
book_repo = BookRepository()
logger = structlog.get_logger(__name__) # Added logger instance

# Metadata endpoints
@router.post("/metadata", response_model=BookMetadataResponse)
async def create_book_metadata(
    metadata: BookMetadataCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[TokenData, Depends(get_current_user)]
):
    """Create a new book metadata entry."""
    db_obj = BookMetadata(**metadata.model_dump())
    db.add(db_obj)
    await db.commit()
    await db.refresh(db_obj)
    return db_obj

@router.put("/metadata/{metadata_id}", response_model=BookMetadataResponse)
async def update_book_metadata(
    metadata_id: UUID,
    metadata: BookMetadataUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[TokenData, Depends(get_current_user)]
):
    """Update a book metadata entry."""
    query = select(BookMetadata).where(BookMetadata.id == metadata_id)
    result = await db.execute(query)
    db_obj = result.scalar_one_or_none()
    
    if not db_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Book metadata not found"
        )

    update_data = metadata.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_obj, field, value)

    await db.commit()
    await db.refresh(db_obj)
    return db_obj

@router.get("/", response_model=List[UserBookLibraryResponse])
async def get_user_books(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[TokenData, Depends(get_current_user)],
    skip: int = 0,
    limit: int = 100
):
    """Get all books in a user's library."""
    return await book_repo.get_user_books(db, user_id=current_user.sub, skip=skip, limit=limit)


@router.get("/{library_id}", response_model=UserBookLibraryResponse)
async def get_user_book(
    library_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[TokenData, Depends(get_current_user)]
) -> UserBookLibrary: # Return type hint for clarity if db_user_book_library_entry uses it
    """Get a specific book from a user's library."""
    # Note: book_repo.get_user_book should ideally handle the "not found" for the user
    # and raise an appropriate exception or return None, which is then handled.
    book = await book_repo.get_user_book(db, library_id=library_id, user_id=current_user.sub)
    if not book:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Book with ID {library_id} not found in user's library"
        )
    return book


@router.post("/", response_model=UserBookLibraryResponse)
async def add_book_to_library(
    book: UserBookLibraryCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[TokenData, Depends(get_current_user)]
):
    """Add a book to user's library."""
    book.user_id = current_user.sub # Ensure user_id is set from authenticated user
    return await book_repo.add_to_library(db, obj_in=book)


@router.put("/{library_id}", response_model=UserBookLibraryResponse)
async def update_user_book(
    library_id: UUID,
    book: UserBookLibraryUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[TokenData, Depends(get_current_user)]
):
    """Update a book in user's library."""
    updated_book = await book_repo.update_user_book(
        db, library_id=library_id, user_id=current_user.sub, obj_in=book
    )
    if not updated_book:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Book not found in user's library"
        )
    return updated_book


@router.delete("/{library_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_book_from_library(
    library_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[TokenData, Depends(get_current_user)],
    storage_client: Annotated[SupabaseStorageClient, Depends(get_storage_client)] # Added storage_client
):
    """Remove a book from user's library and its associated file from storage."""
    
    # 1. Fetch the book library entry to get metadata, especially the file_url
    # get_user_book will raise 404 if not found for this user.
    db_user_book_library_entry = await get_user_book(library_id, db, current_user)
    # No need for an additional "if not db_user_book_library_entry" check here,
    # as get_user_book (this router's version) would have raised HTTPException.

    file_url_to_delete = None
    # Ensure book_metadata exists and has a file_url
    if db_user_book_library_entry.book_metadata and db_user_book_library_entry.book_metadata.file_url:
        file_url_to_delete = db_user_book_library_entry.book_metadata.file_url

    # 2. Attempt to delete the associated file from Supabase storage if file_url exists
    if file_url_to_delete:
        try:
            logger.info("Attempting to delete file from storage", storage_path=file_url_to_delete, book_id=library_id, user_id=current_user.sub)
            await storage_client.delete_file(object_name=file_url_to_delete)
            logger.info("Successfully initiated deletion for file from storage (if it existed)", storage_path=file_url_to_delete)
        except StorageError as se:
            logger.error("StorageError while deleting file from storage", storage_path=file_url_to_delete, error=str(se), exc_info=False)
            # Log and continue. File deletion failure should not prevent DB record deletion.
        except Exception as e:
            logger.error("Unexpected error while deleting file from storage", storage_path=file_url_to_delete, error=str(e), exc_info=True)
            # Log and continue.

    # 3. Remove the book from the library (database record)
    success_db_delete = await book_repo.remove_from_library(db, library_id=library_id, user_id=current_user.sub)
    
    if not success_db_delete:
        # This case should ideally not be reached if get_user_book above found the entry.
        # However, it's a final check from the repository.
        logger.warn("Book repository indicated failure to delete DB entry, though it was fetched prior.", library_id=library_id, user_id=current_user.sub)
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Book not found in user's library at the final deletion stage."
        )
    
    # On success, FastAPI returns HTTP 204 No Content automatically due to the status_code parameter.
    logger.info("Successfully removed book from library (DB entry)", library_id=library_id, user_id=current_user.sub)

@router.put("/{library_id}/progress", response_model=UserBookLibraryResponse)
async def update_book_progress(
    library_id: UUID,
    progress: dict,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[TokenData, Depends(get_current_user)]
):
    """Update reading progress for a book."""
    logger.info("Updating book progress", library_id=str(library_id), user_id=str(current_user.sub), progress=progress)
    
    # First, get the user book to ensure it exists
    book = await book_repo.get_user_book(db, library_id=library_id, user_id=current_user.sub)
    if not book:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Book with ID {library_id} not found in user's library"
        )
    
    # For PDF books, handle the page progress
    if 'pdf_current_page' in progress:
        logger.info("Updating PDF page progress", page=progress['pdf_current_page'])
        
        # Create update object with the progress
        update_obj = UserBookLibraryUpdate(pdf_current_page=progress['pdf_current_page'])
        
        # Update the book using direct SQL rather than the repository
        # to avoid the async relationship loading issue
        book.pdf_current_page = progress['pdf_current_page']
        await db.commit()
        
        # Explicitly refresh the object with its relationships to ensure
        # they're properly loaded in the async context
        await db.refresh(book, ["book_metadata"])
        
        return book
    
    # For EPUB books, handle the location progress
    elif 'epub_progress' in progress:
        logger.info("Updating EPUB progress")
        
        # Create update object with the progress
        update_obj = UserBookLibraryUpdate(epub_progress=progress['epub_progress'])
        
        # Update directly and refresh
        book.epub_progress = progress['epub_progress']
        await db.commit()
        await db.refresh(book, ["book_metadata"])
        
        return book
    
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid progress data. Must include 'pdf_current_page' or 'epub_progress'."
        )
