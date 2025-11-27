"""Folder schemas - DRY approach using SQLModel as base."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

from app.typing.common import response_config

# ================= Base (Field Bundle) =================


class FolderBase(BaseModel):
    """Shared fields for folder operations."""

    name: str = Field(..., min_length=1, max_length=100)


# ================= Requests =================


class FolderCreate(FolderBase):
    """Create folder request - inherits validation from base."""

    pass


class FolderUpdate(BaseModel):
    """Update folder request - all fields optional for PATCH."""

    name: str | None = Field(default=None, min_length=1, max_length=100)


# ================= Responses =================


class FolderResponse(FolderBase):
    """Public folder response."""

    model_config = response_config

    id: UUID
    created_at: datetime
