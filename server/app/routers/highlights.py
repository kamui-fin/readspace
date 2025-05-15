from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import DatabaseSession, HighlightRepo
from app.repositories.highlights import HighlightRepository
from app.schemas.highlights import HighlightCreate, HighlightUpdate, HighlightResponse

router = APIRouter(prefix="/highlights", tags=["highlights"])

@router.get("/book/{book_id}", response_model=List[HighlightResponse])
async def get_book_highlights(
    book_id: UUID,
    db: DatabaseSession = Depends(),
    highlight_repo: HighlightRepository = Depends(HighlightRepo)
) -> List[HighlightResponse]:
    """Get all highlights for a book."""
    highlights = await highlight_repo.get_book_highlights(book_id)
    return highlights

@router.post("/", response_model=HighlightResponse)
async def create_highlight(
    highlight: HighlightCreate,
    db: DatabaseSession = Depends(),
    highlight_repo: HighlightRepository = Depends(HighlightRepo)
) -> HighlightResponse:
    """Create a new highlight."""
    return await highlight_repo.create(highlight)

@router.put("/{highlight_id}", response_model=HighlightResponse)
async def update_highlight(
    highlight_id: UUID,
    highlight: HighlightUpdate,
    db: DatabaseSession = Depends(),
    highlight_repo: HighlightRepository = Depends(HighlightRepo)
) -> HighlightResponse:
    """Update a highlight."""
    updated_highlight = await highlight_repo.update(highlight_id, highlight)
    if not updated_highlight:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Highlight not found"
        )
    return updated_highlight

@router.delete("/{highlight_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_highlight(
    highlight_id: UUID,
    db: DatabaseSession = Depends(),
    highlight_repo: HighlightRepository = Depends(HighlightRepo)
) -> None:
    """Delete a highlight."""
    success = await highlight_repo.delete(highlight_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Highlight not found"
        )

@router.delete("/text/{text}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_highlights_by_text(
    text: str,
    db: DatabaseSession = Depends(),
    highlight_repo: HighlightRepository = Depends(HighlightRepo)
) -> None:
    """Delete highlights by text content."""
    success = await highlight_repo.delete_by_text(text)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No highlights found with the given text"
        )

@router.put("/{highlight_id}/note", response_model=HighlightResponse)
async def update_highlight_note(
    highlight_id: UUID,
    note: str,
    db: DatabaseSession = Depends(),
    highlight_repo: HighlightRepository = Depends(HighlightRepo)
) -> HighlightResponse:
    """Update a highlight's note."""
    updated_highlight = await highlight_repo.update_note(highlight_id, note)
    if not updated_highlight:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Highlight not found"
        )
    return updated_highlight 