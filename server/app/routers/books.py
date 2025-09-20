from typing import Annotated, Any
from uuid import UUID

import structlog  # Added for logging
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.decorators import require_resource_limit
from app.db.session import get_db
from app.models.book_models import (  # Added UserBookLibrary for type hint
    BookMetadata,
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

router = APIRouter(prefix="/books", tags=["Books"])
book_repo = BookRepository()
logger = structlog.get_logger(__name__)  # Added logger instance


# Metadata endpoints
@router.post(
    "/metadata",
    response_model=BookMetadataResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create book metadata",
    description="Create a new book metadata entry with title, author, format, and file information.",
    responses={
        201: {
            "description": "Book metadata created successfully",
            "model": BookMetadataResponse,
        },
        400: {
            "description": "Invalid input data",
            "content": {"application/json": {"example": {"detail": "Format must be either 'PDF' or 'EPUB'"}}},
        },
        401: {
            "description": "Authentication required",
            "content": {"application/json": {"example": {"detail": "Not authenticated"}}},
        },
        422: {
            "description": "Validation error",
            "content": {
                "application/json": {
                    "example": {
                        "detail": [
                            {
                                "loc": ["body", "title"],
                                "msg": "field required",
                                "type": "value_error.missing",
                            }
                        ]
                    }
                }
            },
        },
    },
)
async def create_book_metadata(
    metadata: BookMetadataCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[TokenData, Depends(get_current_user)],
) -> BookMetadataResponse:
    """Create a new book metadata entry.

    This endpoint allows authenticated users to create metadata for a book that can later
    be added to user libraries. The metadata includes essential information like title,
    author, format (PDF or EPUB), and file location.

    Args:
        metadata: Book metadata containing title, author, format, file_url, and optional fields
        db: Database session dependency
        current_user: Authenticated user information

    Returns:
        BookMetadataResponse: Created book metadata with generated ID and timestamp

    Raises:
        HTTPException:
            - 400: Invalid format (must be 'PDF' or 'EPUB')
            - 401: User not authenticated
            - 422: Invalid input data or missing required fields

    Example:
        ```json
        {
            "title": "The Great Gatsby",
            "author": "F. Scott Fitzgerald",
            "description": "A classic American novel",
            "format": "PDF",
            "file_url": "https://storage.example.com/books/gatsby.pdf",
            "file_size_bytes": 2048576,
            "num_pages": 180
        }
        ```
    """
    db_obj = BookMetadata(**metadata.model_dump())
    db.add(db_obj)
    await db.commit()
    await db.refresh(db_obj)
    return db_obj


@router.put(
    "/metadata/{metadata_id}",
    response_model=BookMetadataResponse,
    status_code=status.HTTP_200_OK,
    summary="Update book metadata",
    description="Update an existing book metadata entry. Only provided fields will be updated.",
    responses={
        200: {
            "description": "Book metadata updated successfully",
            "model": BookMetadataResponse,
        },
        401: {
            "description": "Authentication required",
            "content": {"application/json": {"example": {"detail": "Not authenticated"}}},
        },
        404: {
            "description": "Book metadata not found",
            "content": {"application/json": {"example": {"detail": "Book metadata not found"}}},
        },
        422: {
            "description": "Validation error",
            "content": {
                "application/json": {
                    "example": {
                        "detail": [
                            {
                                "loc": ["body", "file_size_bytes"],
                                "msg": "ensure this value is less than or equal to 5242880",
                                "type": "value_error.number.not_le",
                            }
                        ]
                    }
                }
            },
        },
    },
)
async def update_book_metadata(
    metadata_id: UUID,
    metadata: BookMetadataUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[TokenData, Depends(get_current_user)],
) -> BookMetadataResponse:
    """Update an existing book metadata entry.

    This endpoint allows authenticated users to update book metadata. Only the fields
    provided in the request body will be updated - other fields remain unchanged.
    This uses a partial update approach.

    Args:
        metadata_id: UUID of the book metadata to update
        metadata: Book metadata update data (all fields optional)
        db: Database session dependency
        current_user: Authenticated user information

    Returns:
        BookMetadataResponse: Updated book metadata with current values

    Raises:
        HTTPException:
            - 401: User not authenticated
            - 404: Book metadata with the specified ID not found
            - 422: Invalid input data (e.g., file size exceeds limit)

    Example:
        ```json
        {
            "title": "The Great Gatsby (Updated Edition)",
            "description": "An updated description of this classic novel"
        }
        ```

    Note:
        Only provided fields will be updated. Omitted fields retain their current values.
    """
    query = select(BookMetadata).where(BookMetadata.id == metadata_id)
    result = await db.execute(query)
    db_obj = result.scalar_one_or_none()

    if not db_obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Book metadata not found")

    update_data = metadata.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_obj, field, value)

    await db.commit()
    await db.refresh(db_obj)
    return db_obj


@router.delete(
    "/metadata/{metadata_id}",
    status_code=status.HTTP_200_OK,
    summary="Delete book metadata",
    description="Delete a book metadata entry and its associated file from storage. "
    "This will cascade delete all user library entries.",
    responses={
        200: {
            "description": "Book metadata deleted successfully",
            "content": {"application/json": {"example": {"ok": True, "message": "Book metadata deleted successfully"}}},
        },
        401: {
            "description": "Authentication required",
            "content": {"application/json": {"example": {"detail": "Not authenticated"}}},
        },
        404: {
            "description": "Book metadata not found",
            "content": {"application/json": {"example": {"detail": "Book metadata not found"}}},
        },
    },
)
async def delete_book_metadata(
    metadata_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[TokenData, Depends(get_current_user)],
    storage_client: Annotated[SupabaseStorageClient, Depends(get_storage_client)],
) -> dict[str, Any]:
    """Delete a book metadata entry and its associated file from storage.

    This endpoint performs a complete cleanup when removing book metadata:
    1. Removes the associated file from Supabase storage (if it exists)
    2. Deletes the metadata record from the database
    3. Automatically cascade deletes all user library entries referencing this metadata

    The operation continues even if file deletion from storage fails, ensuring the
    database records are always cleaned up properly.

    Args:
        metadata_id: UUID of the book metadata to delete
        db: Database session dependency
        current_user: Authenticated user information
        storage_client: Supabase storage client for file operations

    Returns:
        dict: Success confirmation with message

    Raises:
        HTTPException:
            - 401: User not authenticated
            - 404: Book metadata with the specified ID not found

    Warning:
        This operation is irreversible. All user library entries referencing
        this metadata will be permanently deleted due to cascade constraints.

    Note:
        Storage file deletion failures are logged but do not prevent the operation
        from completing. The database records will be cleaned up regardless.
    """

    # 1. First fetch the metadata to get the file_url before deletion
    query = select(BookMetadata).where(BookMetadata.id == metadata_id)
    result = await db.execute(query)
    db_metadata = result.scalar_one_or_none()

    if not db_metadata:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Book metadata not found")

    file_url_to_delete = str(db_metadata.file_url) if db_metadata.file_url else None

    # 2. Attempt to delete the associated file from Supabase storage if file_url exists
    if file_url_to_delete:
        try:
            logger.info(
                "Attempting to delete file from storage",
                storage_path=file_url_to_delete,
                metadata_id=metadata_id,
                user_id=current_user.sub,
            )
            await storage_client.delete_file(object_name=file_url_to_delete)
            logger.info(
                "Successfully initiated deletion for file from storage (if it existed)",
                storage_path=file_url_to_delete,
            )
        except StorageError as se:
            logger.error(
                "StorageError while deleting file from storage",
                storage_path=file_url_to_delete,
                error=str(se),
                exc_info=False,
            )
            # Log and continue. File deletion failure should not prevent DB record deletion.
        except Exception as e:
            logger.error(
                "Unexpected error while deleting file from storage",
                storage_path=file_url_to_delete,
                error=str(e),
                exc_info=True,
            )
            # Log and continue.

    # 3. Delete the metadata entry (this will cascade delete all related library entries)
    await db.delete(db_metadata)
    await db.commit()

    logger.info(
        "Successfully deleted book metadata (and cascaded library entries)",
        metadata_id=metadata_id,
        user_id=current_user.sub,
    )

    return {"ok": True, "message": "Book metadata deleted successfully"}


@router.get(
    "/",
    response_model=list[UserBookLibraryResponse],
    status_code=status.HTTP_200_OK,
    summary="Get user's book library",
    description="Retrieve all books in the authenticated user's library with pagination support.",
    responses={
        200: {
            "description": "List of books in user's library",
            "model": list[UserBookLibraryResponse],
        },
        401: {
            "description": "Authentication required",
            "content": {"application/json": {"example": {"detail": "Not authenticated"}}},
        },
    },
)
async def get_user_books(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[TokenData, Depends(get_current_user)],
    skip: int = Query(0, ge=0, description="Number of records to skip for pagination"),
    limit: int = Query(100, ge=1, le=1000, description="Maximum number of records to return"),
) -> list[UserBookLibraryResponse]:
    """Get all books in the authenticated user's library.

    This endpoint returns a paginated list of all books in the user's personal library,
    including their reading progress and the complete book metadata for each entry.

    Args:
        db: Database session dependency
        current_user: Authenticated user information
        skip: Number of records to skip for pagination (default: 0)
        limit: Maximum number of records to return (default: 100, max: 1000)

    Returns:
        list[UserBookLibraryResponse]: List of books with metadata and reading progress

    Raises:
        HTTPException:
            - 401: User not authenticated

    Example:
        GET /books/?skip=0&limit=10

        Returns books 1-10 from the user's library, each containing:
        - Library entry details (ID, date added, progress)
        - Complete book metadata (title, author, format, etc.)

    Note:
        Results are ordered by date_added (most recent first) and include
        reading progress for both PDF (current page) and EPUB (progress data).
    """
    return await book_repo.get_user_books(db, user_id=UUID(current_user.sub), skip=skip, limit=limit)


@router.get(
    "/{library_id}",
    response_model=UserBookLibraryResponse,
    status_code=status.HTTP_200_OK,
    summary="Get specific book from library",
    description="Retrieve a specific book from the authenticated user's library by library entry ID.",
    responses={
        200: {
            "description": "Book found in user's library",
            "model": UserBookLibraryResponse,
        },
        401: {
            "description": "Authentication required",
            "content": {"application/json": {"example": {"detail": "Not authenticated"}}},
        },
        404: {
            "description": "Book not found in user's library",
            "content": {
                "application/json": {
                    "example": {
                        "detail": "Book with ID 123e4567-e89b-12d3-a456-426614174000 not found in user's library"
                    }
                }
            },
        },
    },
)
async def get_user_book(
    library_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[TokenData, Depends(get_current_user)],
) -> UserBookLibraryResponse:
    """Get a specific book from the authenticated user's library.

    This endpoint retrieves a single book from the user's library using the library
    entry ID (not the book metadata ID). It includes both the library-specific
    information (reading progress, date added) and the complete book metadata.

    Args:
        library_id: UUID of the library entry (UserBookLibrary.id)
        db: Database session dependency
        current_user: Authenticated user information

    Returns:
        UserBookLibraryResponse: Book library entry with complete metadata and progress

    Raises:
        HTTPException:
            - 401: User not authenticated
            - 404: Book not found in user's library (either doesn't exist or
                   belongs to a different user)

    Example:
        GET /books/123e4567-e89b-12d3-a456-426614174000

        Returns the specific book entry including:
        - Reading progress (PDF page or EPUB location)
        - Date when book was added to library
        - Complete book metadata (title, author, file info, etc.)

    Note:
        The library_id is the unique identifier for the user's library entry,
        not the book metadata ID. Multiple users can have the same book metadata
        in their libraries with different library_ids and progress states.
    """
    # Note: book_repo.get_user_book should ideally handle the "not found" for the user
    # and raise an appropriate exception or return None, which is then handled.
    book = await book_repo.get_user_book(db, library_id=library_id, user_id=UUID(current_user.sub))
    if not book:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Book with ID {library_id} not found in user's library",
        )
    return book


@router.post(
    "/",
    response_model=UserBookLibraryResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Add book to library",
    description="Add a book to the authenticated user's library. The book metadata must already exist.",
    responses={
        201: {
            "description": "Book added to library successfully",
            "model": UserBookLibraryResponse,
        },
        400: {
            "description": "Book already exists in library or resource limit exceeded",
            "content": {
                "application/json": {
                    "examples": {
                        "already_exists": {
                            "summary": "Book already in library",
                            "value": {"detail": "Book already exists in user's library"},
                        },
                        "limit_exceeded": {
                            "summary": "Resource limit exceeded",
                            "value": {"detail": "Maximum number of books exceeded"},
                        },
                    }
                }
            },
        },
        401: {
            "description": "Authentication required",
            "content": {"application/json": {"example": {"detail": "Not authenticated"}}},
        },
        404: {
            "description": "Book metadata not found",
            "content": {"application/json": {"example": {"detail": "Book metadata with specified ID not found"}}},
        },
        422: {
            "description": "Validation error",
            "content": {
                "application/json": {
                    "example": {
                        "detail": [
                            {
                                "loc": ["body", "book_metadata_id"],
                                "msg": "field required",
                                "type": "value_error.missing",
                            }
                        ]
                    }
                }
            },
        },
    },
)
@require_resource_limit("max_books")
async def add_book_to_library(
    book: UserBookLibraryCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[TokenData, Depends(get_current_user)],
) -> UserBookLibraryResponse:
    """Add a book to the authenticated user's library.

    This endpoint creates a new library entry linking the user to existing book metadata.
    The book metadata must already exist in the system before it can be added to a library.
    Users cannot add the same book twice to their library.

    Args:
        book: Library entry data containing book_metadata_id and optional progress
        db: Database session dependency
        current_user: Authenticated user information

    Returns:
        UserBookLibraryResponse: Created library entry with book metadata

    Raises:
        HTTPException:
            - 400: Book already exists in library or user has reached book limit
            - 401: User not authenticated
            - 404: Referenced book metadata not found
            - 422: Invalid input data or missing required fields

    Example:
        ```json
        {
            "book_metadata_id": "123e4567-e89b-12d3-a456-426614174000",
            "pdf_current_page": 1,
            "epub_progress": null
        }
        ```

    Note:
        - The user_id is automatically set from the authenticated user
        - Initial reading progress can be set when adding the book
        - This endpoint is protected by resource limits (max_books decorator)
        - Duplicate additions are prevented at the database level
    """
    book.user_id = UUID(current_user.sub)  # Ensure user_id is set from authenticated user
    return await book_repo.add_to_library(db, obj_in=book)


@router.put(
    "/{library_id}",
    response_model=UserBookLibraryResponse,
    status_code=status.HTTP_200_OK,
    summary="Update book in library",
    description="Update reading progress and other library-specific data for a book in the user's library.",
    responses={
        200: {
            "description": "Book library entry updated successfully",
            "model": UserBookLibraryResponse,
        },
        401: {
            "description": "Authentication required",
            "content": {"application/json": {"example": {"detail": "Not authenticated"}}},
        },
        404: {
            "description": "Book not found in user's library",
            "content": {"application/json": {"example": {"detail": "Book not found in user's library"}}},
        },
        422: {
            "description": "Validation error",
            "content": {
                "application/json": {
                    "example": {
                        "detail": [
                            {
                                "loc": ["body", "pdf_current_page"],
                                "msg": "ensure this value is greater than 0",
                                "type": "value_error.number.not_gt",
                            }
                        ]
                    }
                }
            },
        },
    },
)
async def update_user_book(
    library_id: UUID,
    book: UserBookLibraryUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[TokenData, Depends(get_current_user)],
) -> UserBookLibraryResponse:
    """Update reading progress and library data for a book.

    This endpoint allows users to update their library-specific data for a book,
    primarily reading progress. It supports both PDF (page-based) and EPUB
    (location-based) progress tracking.

    Args:
        library_id: UUID of the library entry to update
        book: Update data containing progress information
        db: Database session dependency
        current_user: Authenticated user information

    Returns:
        UserBookLibraryResponse: Updated library entry with current progress

    Raises:
        HTTPException:
            - 401: User not authenticated
            - 404: Book not found in user's library
            - 422: Invalid input data (e.g., negative page numbers)

    Example:
        For PDF books:
        ```json
        {
            "pdf_current_page": 45
        }
        ```

        For EPUB books:
        ```json
        {
            "epub_progress": {
                "chapter": 3,
                "position": "0.45",
                "cfi": "/6/14[chapter03]!/4/2/2[p001]/3:247"
            }
        }
        ```

    Note:
        Only provided fields will be updated. Use null values to clear progress data.
        The update ensures the user can only modify books in their own library.
    """
    updated_book = await book_repo.update_user_book(
        db, library_id=library_id, user_id=UUID(current_user.sub), obj_in=book
    )
    if not updated_book:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Book not found in user's library",
        )
    return updated_book


@router.put(
    "/{library_id}/progress",
    response_model=UserBookLibraryResponse,
    status_code=status.HTTP_200_OK,
    summary="Update book reading progress",
    description="Update reading progress for a book with format-specific progress tracking.",
    responses={
        200: {
            "description": "Reading progress updated successfully",
            "model": UserBookLibraryResponse,
        },
        400: {
            "description": "Invalid progress data format",
            "content": {
                "application/json": {
                    "examples": {
                        "invalid_format": {
                            "summary": "Invalid progress format",
                            "value": {
                                "detail": "Invalid progress data. Must include 'pdf_current_page' or 'epub_progress'."
                            },
                        }
                    }
                }
            },
        },
        401: {
            "description": "Authentication required",
            "content": {"application/json": {"example": {"detail": "Not authenticated"}}},
        },
        404: {
            "description": "Book not found in user's library",
            "content": {
                "application/json": {
                    "example": {
                        "detail": "Book with ID 123e4567-e89b-12d3-a456-426614174000 not found in user's library"
                    }
                }
            },
        },
    },
)
async def update_book_progress(
    library_id: UUID,
    progress: dict,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[TokenData, Depends(get_current_user)],
) -> UserBookLibraryResponse:
    """Update reading progress for a book with format-specific tracking.

    This specialized endpoint handles reading progress updates for different book formats.
    It supports both PDF page-based tracking and EPUB location-based tracking with
    format validation and optimized database operations.

    Args:
        library_id: UUID of the library entry to update
        progress: Progress data dict containing format-specific progress information
        db: Database session dependency
        current_user: Authenticated user information

    Returns:
        UserBookLibraryResponse: Updated library entry with new progress

    Raises:
        HTTPException:
            - 400: Invalid progress data format (missing required fields)
            - 401: User not authenticated
            - 404: Book not found in user's library

    Progress Format Examples:
        For PDF books:
        ```json
        {
            "pdf_current_page": 42
        }
        ```

        For EPUB books:
        ```json
        {
            "epub_progress": {
                "chapter": 5,
                "position": "0.73",
                "cfi": "/6/18[chapter05]!/4/2/2[p001]/7:156",
                "timestamp": "2024-01-15T10:30:00Z"
            }
        }
        ```

    Implementation Notes:
        - Uses direct SQL updates for better performance with async relationships
        - Explicitly refreshes the object with relationships after update
        - Validates progress format before processing
        - Logs progress updates for debugging and analytics

    Validation:
        - Exactly one of 'pdf_current_page' or 'epub_progress' must be provided
        - PDF pages should be positive integers
        - EPUB progress can contain arbitrary structure for reader state
    """
    logger.info(
        "Updating book progress",
        library_id=str(library_id),
        user_id=str(current_user.sub),
        progress=progress,
    )

    # First, get the user book to ensure it exists
    book = await book_repo.get_user_book(db, library_id=library_id, user_id=UUID(current_user.sub))
    if not book:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Book with ID {library_id} not found in user's library",
        )

    # For PDF books, handle the page progress
    if "pdf_current_page" in progress:
        logger.info("Updating PDF page progress", page=progress["pdf_current_page"])

        # Create update object with the progress
        UserBookLibraryUpdate(pdf_current_page=progress["pdf_current_page"])

        # Update the book using direct SQL rather than the repository
        # to avoid the async relationship loading issue
        book.pdf_current_page = progress["pdf_current_page"]
        await db.commit()

        # Explicitly refresh the object with its relationships to ensure
        # they're properly loaded in the async context
        await db.refresh(book, ["book_metadata"])

        return book

    # For EPUB books, handle the location progress
    elif "epub_progress" in progress:
        logger.info("Updating EPUB progress")

        # Create update object with the progress
        UserBookLibraryUpdate(epub_progress=progress["epub_progress"])

        # Update directly and refresh
        book.epub_progress = progress["epub_progress"]
        await db.commit()
        await db.refresh(book, ["book_metadata"])

        return book

    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid progress data. Must include 'pdf_current_page' or 'epub_progress'.",
        )
