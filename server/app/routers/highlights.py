from typing import Annotated, List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status

from app.core.dependencies import DatabaseSession, HighlightRepo
from app.repositories.highlights import HighlightRepository
from app.schemas.highlights import HighlightCreate, HighlightUpdate, HighlightResponse
from app.core.dependencies import get_current_user
from app.core.database import get_db
from app.models.highlight_models import Highlight
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
    highlights = await highlight_repo.get_book_highlights(book_id)
    return highlights


@router.post("/", response_model=HighlightResponse)
async def create_highlight(
    highlight: HighlightCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[Optional[dict], Depends(get_current_user)] = None
):
    """
    Create a new highlight entry.
    """
    db_highlight = Highlight(
        user_id=user["id"] if user else None,
        book_id=highlight.book_id,
        text=highlight.text,
        page_number=highlight.page_number,
    )
    db.add(db_highlight)
    await db.commit()
    await db.refresh(db_highlight)
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
