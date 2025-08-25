from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class HighlightBase(BaseModel):
    """Base schema for highlight data."""

    original_text: str
    color: str | None = None
    note: str | None = None
    html_range: dict[str, Any] | None = None
    chapter_href: str | None = None
    chapter_idx: int | None = None
    chapter_title: str | None = None
    page: int | None = None
    pdf_rect_position: dict[str, Any] | None = None


class HighlightCreate(HighlightBase):
    """Schema for creating a new highlight."""

    user_book_lib_id: UUID


class HighlightUpdate(BaseModel):
    """Schema for updating a highlight."""

    original_text: str | None = None
    color: str | None = None
    note: str | None = None
    html_range: dict[str, Any] | None = None
    chapter_href: str | None = None
    chapter_idx: int | None = None
    chapter_title: str | None = None
    page: int | None = None
    pdf_rect_position: dict[str, Any] | None = None


class HighlightResponse(HighlightBase):
    """Schema for highlight response."""

    id: UUID
    user_book_lib_id: UUID

    model_config = ConfigDict(from_attributes=True)
