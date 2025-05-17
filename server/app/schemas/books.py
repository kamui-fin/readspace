from datetime import datetime
from typing import Any, Dict, List, Optional, Union
from uuid import UUID

from pydantic import BaseModel, field_validator


class BookMetadataBase(BaseModel):
    """Base model for book metadata."""

    title: str
    author: str
    description: str = ""
    cover_url: Optional[str] = None
    format: str  # "PDF" or "EPUB"
    file_url: Optional[str] = None
    file_size_bytes: Optional[int] = None
    num_pages: Optional[int] = None
    pdf_toc: Optional[Union[Dict[str, Any], List[Dict[str, Any]]]] = None  # Allow both dict and list
    epub_chapter_char_counts: Optional[List[int]] = None


class BookMetadataCreate(BookMetadataBase):
    """Model for creating book metadata."""

    pass


class BookMetadataUpdate(BaseModel):
    """Model for updating book metadata."""

    title: Optional[str] = None
    author: Optional[str] = None
    description: Optional[str] = None
    cover_url: Optional[str] = None
    file_url: Optional[str] = None
    file_size_bytes: Optional[int] = None
    num_pages: Optional[int] = None
    pdf_toc: Optional[Union[Dict[str, Any], List[Dict[str, Any]]]] = None  # Allow both dict and list
    epub_chapter_char_counts: Optional[List[int]] = None


class BookMetadataResponse(BookMetadataBase):
    """Model for book metadata response."""

    id: UUID
    # Allow created_at and updated_at to be either string or datetime
    created_at: Union[str, datetime]
    updated_at: Union[str, datetime]

    class Config:
        from_attributes = True

    @field_validator('created_at', 'updated_at', mode='before')
    @classmethod
    def validate_datetime(cls, value):
        """Convert datetime to string if it's a datetime object."""
        if isinstance(value, datetime):
            return value.isoformat()
        return value


class UserBookLibraryBase(BaseModel):
    """Base model for user book library."""

    user_id: UUID
    book_metadata_id: UUID
    pdf_current_page: Optional[int] = None
    epub_progress: Optional[Dict[str, Any]] = None


class UserBookLibraryCreate(UserBookLibraryBase):
    """Model for creating user book library."""

    pass


class UserBookLibraryUpdate(BaseModel):
    """Model for updating user book library."""

    pdf_current_page: Optional[int] = None
    epub_progress: Optional[Dict[str, Any]] = None


class UserBookLibraryResponse(UserBookLibraryBase):
    """Model for user book library response."""

    id: UUID
    # Allow date_added to be either string or datetime
    date_added: Union[str, datetime]
    book_metadata: BookMetadataResponse

    class Config:
        from_attributes = True

    @field_validator('date_added', mode='before')
    @classmethod
    def validate_date_added(cls, value):
        """Convert datetime to string if it's a datetime object."""
        if isinstance(value, datetime):
            return value.isoformat()
        return value 