from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class BookBase(BaseModel):
    """Base book schema with common attributes."""
    title: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = Field(None, max_length=1000)
    file_url: str = Field(..., min_length=1)
    file_type: str = Field(..., min_length=1)
    user_id: str = Field(..., min_length=1)


class BookCreate(BookBase):
    """Schema for creating a new book."""
    pass


class BookUpdate(BaseModel):
    """Schema for updating a book."""
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = Field(None, max_length=1000)
    file_url: Optional[str] = Field(None, min_length=1)
    file_type: Optional[str] = Field(None, min_length=1)


class Book(BookBase):
    """Schema for book responses."""
    id: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True 