from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class FolderBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)


class FolderCreate(FolderBase):
    pass


class FolderUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)


class FolderResponse(FolderBase):
    id: UUID
    created_at: datetime
