from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


class BookMetadataBase(BaseModel):
    """Base model for book metadata."""

    title: str
    author: str
    description: str = ""
    cover_url: str | None = None
    format: str  # "PDF" or "EPUB"
    file_url: str
    file_size_bytes: int | None = Field(None, le=5 * 1024 * 1024)  # 5MB max
    num_pages: int | None = None
    pdf_toc: dict[str, Any] | list[dict[str, Any]] | None = None  # Allow both dict and list
    epub_chapter_char_counts: list[int] | None = None
    epub_page_char_counts: list[int] | None = None

    @field_validator("format")
    @classmethod
    def validate_format(cls, v: str) -> str:
        if v not in ["PDF", "EPUB"]:
            raise ValueError("Format must be either 'PDF' or 'EPUB'")
        return v


class BookMetadataCreate(BookMetadataBase):
    """Model for creating book metadata."""

    pass


class BookMetadataUpdate(BaseModel):
    """Model for updating book metadata."""

    title: str | None = None
    author: str | None = None
    description: str | None = None
    cover_url: str | None = None
    file_url: str | None = None
    file_size_bytes: int | None = None
    num_pages: int | None = None
    pdf_toc: dict[str, Any] | list[dict[str, Any]] | None = None  # Allow both dict and list
    epub_chapter_char_counts: list[int] | None = None


class BookMetadataResponse(BookMetadataBase):
    """Model for book metadata response."""

    id: UUID
    # Allow created_at to be either string or datetime
    created_at: str | datetime

    model_config = ConfigDict(from_attributes=True)

    @field_validator("created_at", mode="before")
    @classmethod
    def validate_datetime(cls, value: str | datetime) -> str:
        """Convert datetime to string if it's a datetime object."""
        if isinstance(value, datetime):
            return value.isoformat()
        return value


class UserBookLibraryBase(BaseModel):
    """Base model for user book library."""

    user_id: UUID
    book_metadata_id: UUID
    pdf_current_page: int | None = None
    epub_progress: dict[str, Any] | None = None


class UserBookLibraryCreate(UserBookLibraryBase):
    """Model for creating user book library."""

    pass


class UserBookLibraryUpdate(BaseModel):
    """Model for updating user book library."""

    pdf_current_page: int | None = None
    epub_progress: dict[str, Any] | None = None


class UserBookLibraryResponse(UserBookLibraryBase):
    """Model for user book library response."""

    id: UUID
    # Allow date_added to be either string or datetime
    date_added: str | datetime
    book_metadata: BookMetadataResponse

    model_config = ConfigDict(from_attributes=True)

    @field_validator("date_added", mode="before")
    @classmethod
    def validate_date_added(cls, value: str | datetime) -> str:
        """Convert datetime to string if it's a datetime object."""
        if isinstance(value, datetime):
            return value.isoformat()
        return value
