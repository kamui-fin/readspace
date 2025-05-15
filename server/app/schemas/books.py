from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel


class BookBase(BaseModel):
    """Base schema for book data."""

    title: str
    author: Optional[str] = None
    description: Optional[str] = None
    cover_url: Optional[str] = None
    file_url: str
    file_type: str
    language: Optional[str] = None
    total_pages: Optional[int] = None
    current_page: Optional[int] = None
    epub_progress: Optional[dict] = None
    pdf_page: Optional[int] = None
    last_recall_page: Optional[int] = None


class BookCreate(BookBase):
    """Schema for creating a new book."""

    user_id: UUID


class BookUpdate(BaseModel):
    """Schema for updating a book."""

    title: Optional[str] = None
    author: Optional[str] = None
    description: Optional[str] = None
    cover_url: Optional[str] = None
    file_url: Optional[str] = None
    file_type: Optional[str] = None
    language: Optional[str] = None
    total_pages: Optional[int] = None
    current_page: Optional[int] = None
    epub_progress: Optional[dict] = None
    pdf_page: Optional[int] = None
    last_recall_page: Optional[int] = None


class BookProgress(BaseModel):
    """Schema for updating book progress."""

    current_page: Optional[int] = None
    epub_progress: Optional[dict] = None
    pdf_page: Optional[int] = None


class BookResponse(BookBase):
    """Schema for book response."""

    id: UUID
    user_id: UUID
    date_added: datetime
    last_modified: datetime

    class Config:
        from_attributes = True
