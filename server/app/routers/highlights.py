from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user, get_highlight_repository
from app.db.session import get_db
from app.models.book_models import Highlight, UserBookLibrary
from app.repositories.highlights import HighlightRepository
from app.schemas.auth import TokenData
from app.schemas.highlights import HighlightCreate, HighlightResponse, HighlightUpdate

router = APIRouter(prefix="/highlights", tags=["Highlights"])
highlight_repo = HighlightRepository()


class NoteUpdate(BaseModel):
    """Schema for updating a highlight's note content."""

    note: str


@router.get(
    "/book/{book_id}",
    response_model=list[HighlightResponse],
    status_code=status.HTTP_200_OK,
    summary="Get book highlights",
    description="Retrieve all highlights for a specific book",
    responses={
        200: {
            "description": "List of highlights successfully retrieved",
            "content": {
                "application/json": {
                    "example": [
                        {
                            "id": "123e4567-e89b-12d3-a456-426614174000",
                            "user_book_lib_id": "987fcdeb-51a2-43d7-8c9f-123456789abc",
                            "original_text": "This is an important passage",
                            "color": "YELLOW",
                            "note": "Key insight about the topic",
                            "chapter_title": "Chapter 1: Introduction",
                            "page": 15,
                        }
                    ]
                }
            },
        },
        422: {"description": "Invalid book ID format"},
    },
)
async def get_book_highlights(
    book_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    highlight_repo: HighlightRepository = Depends(get_highlight_repository),
) -> list[HighlightResponse]:
    """
    Retrieve all highlights for a specific book.

    This endpoint returns all highlights that belong to a specific book,
    including their text content, colors, notes, and positional information.

    Args:
        book_id: The UUID of the book to retrieve highlights for
        db: Database session dependency
        highlight_repo: Highlight repository dependency

    Returns:
        List of HighlightResponse objects containing highlight data

    Raises:
        HTTPException: 422 if book_id is not a valid UUID format
    """
    highlights = await highlight_repo.get_book_highlights(db, book_id)
    return [HighlightResponse.model_validate(highlight) for highlight in highlights]


@router.post(
    "/",
    response_model=HighlightResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new highlight",
    description="Create a new highlight for a book with text content, color, notes, and position data",
    responses={
        201: {
            "description": "Highlight successfully created",
            "content": {
                "application/json": {
                    "example": {
                        "id": "123e4567-e89b-12d3-a456-426614174000",
                        "user_book_lib_id": "987fcdeb-51a2-43d7-8c9f-123456789abc",
                        "original_text": "This is an important passage",
                        "color": "YELLOW",
                        "note": "Key insight about the topic",
                        "chapter_title": "Chapter 1: Introduction",
                        "page": 15,
                    }
                }
            },
        },
        401: {"description": "User not authenticated"},
        404: {"description": "Book not found in user's library"},
        422: {"description": "Invalid request data"},
    },
)
async def create_highlight(
    highlight_data: HighlightCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[TokenData | None, Depends(get_current_user)] = None,
) -> HighlightResponse:
    """
    Create a new highlight entry for a book.

    Creates a new highlight with the provided text content, color, optional notes,
    and positional information. The highlight is associated with a specific book
    in the user's library through the user_book_lib_id.

    Args:
        highlight_data: HighlightCreate schema containing:
            - user_book_lib_id: UUID of the book in user's library
            - original_text: The highlighted text content
            - color: Optional highlight color (will be uppercased)
            - note: Optional user note about the highlight
            - chapter_idx: Optional chapter index
            - chapter_href: Optional chapter reference
            - chapter_title: Optional chapter title
            - page: Optional page number
            - html_range: Optional HTML range data for web-based books
            - pdf_rect_position: Optional PDF rectangle position data
        db: Database session dependency
        user: Current authenticated user data

    Returns:
        HighlightResponse containing the created highlight data including its new ID

    Raises:
        HTTPException:
            - 401 if user is not authenticated
            - 404 if the specified book is not found in user's library
            - 422 if request data is invalid
    """
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not authenticated")

    # Get the user_book_library entry using the correct ID
    stmt = select(UserBookLibrary).where(
        UserBookLibrary.user_id == user.sub,
        UserBookLibrary.id == highlight_data.user_book_lib_id,
    )
    result = await db.execute(stmt)
    user_book_lib = result.scalar_one_or_none()

    if not user_book_lib:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=(
                "Book not found in user's library. Ensure 'user_book_lib_id' "
                "in the request refers to a valid UserBookLibrary entry."
            ),
        )

    # Create the Highlight object
    db_highlight = Highlight(
        user_book_lib_id=user_book_lib.id,
        color=highlight_data.color.upper() if highlight_data.color else None,
        original_text=highlight_data.original_text,
        note=highlight_data.note,
        chapter_idx=highlight_data.chapter_idx,
        chapter_href=highlight_data.chapter_href,
        chapter_title=highlight_data.chapter_title,
        page=highlight_data.page,  # Assuming epub_est_page is for general page number
        html_range=highlight_data.html_range,
        pdf_rect_position=highlight_data.pdf_rect_position,
    )
    db.add(db_highlight)
    await db.flush()  # Flush to get the db_highlight.id before creating location

    await db.commit()
    await db.refresh(db_highlight)
    # We might need to refresh db_highlight_location as well if we return it or its fields
    # For now, HighlightResponse doesn't seem to directly include location details other than what's in HighlightBase
    return db_highlight


@router.put(
    "/{highlight_id}",
    response_model=HighlightResponse,
    status_code=status.HTTP_200_OK,
    summary="Update a highlight",
    description="Update an existing highlight's properties including text, color, notes, and position",
    responses={
        200: {
            "description": "Highlight successfully updated",
            "content": {
                "application/json": {
                    "example": {
                        "id": "123e4567-e89b-12d3-a456-426614174000",
                        "user_book_lib_id": "987fcdeb-51a2-43d7-8c9f-123456789abc",
                        "original_text": "Updated important passage",
                        "color": "RED",
                        "note": "Updated insight about the topic",
                        "chapter_title": "Chapter 1: Introduction",
                        "page": 15,
                    }
                }
            },
        },
        404: {"description": "Highlight not found"},
        422: {"description": "Invalid highlight ID format or update data"},
    },
)
async def update_highlight(
    highlight_id: UUID,
    highlight: HighlightUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    highlight_repo: HighlightRepository = Depends(get_highlight_repository),
) -> HighlightResponse:
    """
    Update an existing highlight's properties.

    Updates any combination of highlight properties including text content,
    color, notes, and positional information. Only provided fields will be updated.

    Args:
        highlight_id: UUID of the highlight to update
        highlight: HighlightUpdate schema containing fields to update:
            - original_text: Updated highlighted text content
            - color: Updated highlight color
            - note: Updated user note
            - chapter_idx: Updated chapter index
            - chapter_href: Updated chapter reference
            - chapter_title: Updated chapter title
            - page: Updated page number
            - html_range: Updated HTML range data
            - pdf_rect_position: Updated PDF rectangle position
        db: Database session dependency
        highlight_repo: Highlight repository dependency

    Returns:
        HighlightResponse containing the updated highlight data

    Raises:
        HTTPException:
            - 404 if highlight with the specified ID is not found
            - 422 if highlight_id is not a valid UUID format or update data is invalid
    """
    updated_highlight = await highlight_repo.update(db, id=highlight_id, obj_in=highlight)
    if not updated_highlight:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Highlight not found")
    return updated_highlight


@router.delete(
    "/{highlight_id}",
    status_code=status.HTTP_200_OK,
    summary="Delete a highlight",
    description="Permanently delete a specific highlight by its ID",
    responses={
        200: {
            "description": "Highlight successfully deleted",
            "content": {"application/json": {"example": {"ok": True, "message": "Highlight deleted successfully"}}},
        },
        404: {"description": "Highlight not found"},
        422: {"description": "Invalid highlight ID format"},
    },
)
async def delete_highlight(
    highlight_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    highlight_repo: HighlightRepository = Depends(get_highlight_repository),
) -> dict[str, str | bool]:
    """
    Permanently delete a specific highlight.

    Removes a highlight from the database. This action cannot be undone.

    Args:
        highlight_id: UUID of the highlight to delete
        db: Database session dependency
        highlight_repo: Highlight repository dependency

    Returns:
        Dictionary containing success status and confirmation message

    Raises:
        HTTPException:
            - 404 if highlight with the specified ID is not found
            - 422 if highlight_id is not a valid UUID format
    """
    success = await highlight_repo.delete(db, id=highlight_id)
    if not success:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Highlight not found")
    return {"ok": True, "message": "Highlight deleted successfully"}


@router.delete(
    "/text/{text}",
    status_code=status.HTTP_200_OK,
    summary="Delete highlights by text content",
    description="Delete all highlights that contain the specified text content",
    responses={
        200: {
            "description": "Highlights with matching text successfully deleted",
            "content": {"application/json": {"example": {"ok": True, "message": "Highlights deleted successfully"}}},
        },
        404: {"description": "No highlights found with the given text"},
    },
)
async def delete_highlights_by_text(
    text: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    highlight_repo: HighlightRepository = Depends(get_highlight_repository),
) -> dict[str, str | bool]:
    """
    Delete all highlights that contain the specified text content.

    Removes all highlights whose original_text field matches the provided text.
    This operation affects multiple highlights and cannot be undone.

    Args:
        text: The text content to search for in highlights' original_text field
        db: Database session dependency
        highlight_repo: Highlight repository dependency

    Returns:
        Dictionary containing success status and confirmation message

    Raises:
        HTTPException:
            - 404 if no highlights are found with the specified text content
    """
    success = await highlight_repo.delete_by_text(db, text)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No highlights found with the given text",
        )
    return {"ok": True, "message": "Highlights deleted successfully"}


@router.put(
    "/{highlight_id}/note",
    response_model=HighlightResponse,
    status_code=status.HTTP_200_OK,
    summary="Update highlight note",
    description="Update only the note field of a specific highlight",
    responses={
        200: {
            "description": "Highlight note successfully updated",
            "content": {
                "application/json": {
                    "example": {
                        "id": "123e4567-e89b-12d3-a456-426614174000",
                        "user_book_lib_id": "987fcdeb-51a2-43d7-8c9f-123456789abc",
                        "original_text": "This is an important passage",
                        "color": "YELLOW",
                        "note": "Updated note content",
                        "chapter_title": "Chapter 1: Introduction",
                        "page": 15,
                    }
                }
            },
        },
        404: {"description": "Highlight not found"},
        422: {"description": "Invalid highlight ID format or note data"},
    },
)
async def update_highlight_note(
    highlight_id: UUID,
    note_data: NoteUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    highlight_repo: HighlightRepository = Depends(get_highlight_repository),
) -> HighlightResponse:
    """
    Update only the note field of a specific highlight.

    This is a convenience endpoint for updating just the note content of a highlight
    without needing to provide all other fields.

    Args:
        highlight_id: UUID of the highlight to update
        note_data: NoteUpdate schema containing the new note content
        db: Database session dependency
        highlight_repo: Highlight repository dependency

    Returns:
        HighlightResponse containing the updated highlight data

    Raises:
        HTTPException:
            - 404 if highlight with the specified ID is not found
            - 422 if highlight_id is not a valid UUID format or note data is invalid
    """
    updated_highlight = await highlight_repo.update_note(db, highlight_id, note_data.note)
    if not updated_highlight:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Highlight not found")
    return updated_highlight


@router.put(
    "/text/{text}/note",
    response_model=HighlightResponse,
    status_code=status.HTTP_200_OK,
    summary="Update highlight note by text content",
    description="Update the note field of a highlight identified by its text content",
    responses={
        200: {
            "description": "Highlight note successfully updated",
            "content": {
                "application/json": {
                    "example": {
                        "id": "123e4567-e89b-12d3-a456-426614174000",
                        "user_book_lib_id": "987fcdeb-51a2-43d7-8c9f-123456789abc",
                        "original_text": "This is an important passage",
                        "color": "YELLOW",
                        "note": "Updated note content",
                        "chapter_title": "Chapter 1: Introduction",
                        "page": 15,
                    }
                }
            },
        },
        404: {"description": "Highlight with specified text not found"},
        422: {"description": "Invalid note data"},
    },
)
async def update_highlight_note_by_text(
    text: str,
    note_data: NoteUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    highlight_repo: HighlightRepository = Depends(get_highlight_repository),
) -> HighlightResponse:
    """
    Update the note field of a highlight identified by its text content.

    This endpoint allows updating a highlight's note when you know the highlighted
    text content but not the highlight ID. It finds the first highlight with
    matching original_text and updates its note.

    Args:
        text: The original text content of the highlight to update
        note_data: NoteUpdate schema containing the new note content
        db: Database session dependency
        highlight_repo: Highlight repository dependency

    Returns:
        HighlightResponse containing the updated highlight data

    Raises:
        HTTPException:
            - 404 if no highlight is found with the specified text content
            - 422 if note data is invalid

    Note:
        If multiple highlights have the same text content, only the first one
        found will be updated.
    """
    updated_highlight = await highlight_repo.update_note_by_text(db, text, note_data.note)
    if not updated_highlight:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Highlight not found")
    return updated_highlight


@router.get(
    "/{highlight_id}",
    response_model=HighlightResponse,
    status_code=status.HTTP_200_OK,
    summary="Get highlight by ID",
    description="Retrieve a specific highlight by its unique identifier",
    responses={
        200: {
            "description": "Highlight successfully retrieved",
            "content": {
                "application/json": {
                    "example": {
                        "id": "123e4567-e89b-12d3-a456-426614174000",
                        "user_book_lib_id": "987fcdeb-51a2-43d7-8c9f-123456789abc",
                        "original_text": "This is an important passage",
                        "color": "YELLOW",
                        "note": "Key insight about the topic",
                        "chapter_title": "Chapter 1: Introduction",
                        "page": 15,
                    }
                }
            },
        },
        404: {"description": "Highlight not found"},
        422: {"description": "Invalid highlight ID format"},
    },
)
async def get_highlight_by_id(
    highlight_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    highlight_repo: HighlightRepository = Depends(get_highlight_repository),
) -> HighlightResponse:
    """
    Retrieve a specific highlight by its unique identifier.

    Returns detailed information about a single highlight including its text content,
    color, notes, and positional information.

    Args:
        highlight_id: UUID of the highlight to retrieve
        db: Database session dependency
        highlight_repo: Highlight repository dependency

    Returns:
        HighlightResponse containing the complete highlight data

    Raises:
        HTTPException:
            - 404 if highlight with the specified ID is not found
            - 422 if highlight_id is not a valid UUID format
    """
    highlight = await highlight_repo.get(db, highlight_id)
    if not highlight:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Highlight not found")
    return highlight
