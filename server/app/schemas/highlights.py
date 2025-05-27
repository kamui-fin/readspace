from datetime import datetime
from typing import Any, Dict, Optional
from uuid import UUID

from pydantic import BaseModel


class HighlightBase(BaseModel):
    """Base schema for highlight data."""

    original_text: str
    color: Optional[str] = None
    note: Optional[str] = None
    html_range: Optional[Dict[str, Any]] = None
    chapter_href: Optional[str] = None
    chapter_idx: Optional[int] = None
    chapter_title: Optional[str] = None
    page: Optional[int] = None
    pdf_rect_position: Optional[Dict[str, Any]] = None


class HighlightCreate(HighlightBase):
    """Schema for creating a new highlight."""
    user_book_lib_id: UUID


class HighlightUpdate(BaseModel):
    """Schema for updating a highlight."""

    original_text: Optional[str] = None
    color: Optional[str] = None
    note: Optional[str] = None
    html_range: Optional[Dict[str, Any]] = None
    chapter_href: Optional[str] = None
    chapter_idx: Optional[int] = None
    chapter_title: Optional[str] = None
    page: Optional[int] = None
    pdf_rect_position: Optional[Dict[str, Any]] = None


class HighlightResponse(HighlightBase):
    """Schema for highlight response."""

    id: UUID
    user_book_lib_id: UUID

    class Config:
        from_attributes = True
