from datetime import datetime
from typing import Optional, Dict, Any
from uuid import UUID

from pydantic import BaseModel

class HighlightBase(BaseModel):
    """Base schema for highlight data."""
    book_id: UUID
    text: str
    color: Optional[str] = None
    note: Optional[str] = None
    epub_range: Optional[Dict[str, Any]] = None
    epub_chapter_href: Optional[str] = None
    epub_chapter_idx: Optional[int] = None
    epub_chapter_title: Optional[str] = None
    epub_est_page: Optional[int] = None
    pdf_rect_position: Optional[Dict[str, Any]] = None

class HighlightCreate(HighlightBase):
    """Schema for creating a new highlight."""
    pass

class HighlightUpdate(BaseModel):
    """Schema for updating a highlight."""
    text: Optional[str] = None
    color: Optional[str] = None
    note: Optional[str] = None
    epub_range: Optional[Dict[str, Any]] = None
    epub_chapter_href: Optional[str] = None
    epub_chapter_idx: Optional[int] = None
    epub_chapter_title: Optional[str] = None
    epub_est_page: Optional[int] = None
    pdf_rect_position: Optional[Dict[str, Any]] = None

class HighlightResponse(HighlightBase):
    """Schema for highlight response."""
    id: UUID
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True 