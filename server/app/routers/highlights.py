from typing import Annotated, List, Optional
from uuid import UUID

from app.core.database import get_db
from app.core.dependencies import HighlightRepo, get_current_user
from app.models.book_models import Highlight, UserBookLibrary
from app.repositories.highlights import HighlightRepository
from app.schemas.auth import TokenData
from app.schemas.highlights import HighlightCreate, HighlightResponse, HighlightUpdate
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(prefix="/highlights", tags=["highlights"])
highlight_repo = HighlightRepository()


@router.get("/book/{book_id}", response_model=List[HighlightResponse])
async def get_book_highlights(
    book_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    highlight_repo: HighlightRepository = Depends(HighlightRepo),
) -> List[HighlightResponse]:
    """Get all highlights for a book."""
    highlights = await highlight_repo.get_book_highlights(db, book_id)
    return highlights


@router.post("/", response_model=HighlightResponse)
async def create_highlight(
    highlight_data: HighlightCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[Optional[TokenData], Depends(get_current_user)] = None
):
    """
    Create a new highlight entry and its location.
    """
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not authenticated")

    # Get the user_book_library entry using the correct ID
    stmt = select(UserBookLibrary).where(
        UserBookLibrary.user_id == user.sub,
        UserBookLibrary.id == highlight_data.user_book_lib_id
    )
    result = await db.execute(stmt)
    user_book_lib = result.scalar_one_or_none()
    
    if not user_book_lib:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Book not found in user's library. Ensure 'user_book_lib_id' in the request refers to a valid UserBookLibrary entry."
        )

    # Create the Highlight object
    db_highlight = Highlight(
        user_book_lib_id=user_book_lib.id,
        color=highlight_data.color,
        original_text=highlight_data.text,
        note=highlight_data.note,
        chapter_idx=highlight_data.epub_chapter_idx,
        chapter_href=highlight_data.epub_chapter_href,
        chapter_title=highlight_data.epub_chapter_title,
        page=highlight_data.epub_est_page, # Assuming epub_est_page is for general page number
        html_range=highlight_data.epub_range,
        pdf_rect_position=highlight_data.pdf_rect_position
    )
    db.add(db_highlight)
    await db.flush()  # Flush to get the db_highlight.id before creating location
    
    await db.commit()
    await db.refresh(db_highlight)
    # We might need to refresh db_highlight_location as well if we return it or its fields
    # For now, HighlightResponse doesn't seem to directly include location details other than what's in HighlightBase
    return db_highlight


@router.put("/{highlight_id}", response_model=HighlightResponse)
async def update_highlight(
    highlight_id: UUID,
    highlight: HighlightUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    highlight_repo: HighlightRepository = Depends(HighlightRepo),
) -> HighlightResponse:
    """Update a highlight."""
    updated_highlight = await highlight_repo.update(highlight_id, highlight)
    if not updated_highlight:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Highlight not found"
        )
    return updated_highlight


@router.delete("/{highlight_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_highlight(
    highlight_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    highlight_repo: HighlightRepository = Depends(HighlightRepo),
) -> None:
    """Delete a highlight."""
    success = await highlight_repo.delete(highlight_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Highlight not found"
        )


@router.delete("/text/{text}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_highlights_by_text(
    text: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    highlight_repo: HighlightRepository = Depends(HighlightRepo),
) -> None:
    """Delete highlights by text content."""
    success = await highlight_repo.delete_by_text(text)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No highlights found with the given text",
        )


@router.put("/{highlight_id}/note", response_model=HighlightResponse)
async def update_highlight_note(
    highlight_id: UUID,
    note: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    highlight_repo: HighlightRepository = Depends(HighlightRepo),
) -> HighlightResponse:
    """Update a highlight's note."""
    updated_highlight = await highlight_repo.update_note(highlight_id, note)
    if not updated_highlight:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Highlight not found"
        )
    return updated_highlight


@router.get("/{highlight_id}", response_model=HighlightResponse)
async def get_highlight_by_id(
    highlight_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)]
):
    highlight = await highlight_repo.get(db, highlight_id)
    if not highlight:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Highlight not found")
    return highlight
