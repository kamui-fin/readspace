from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field


class FolderBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)


class FolderCreate(FolderBase):
    pass


class FolderUpdate(FolderBase):
    pass


class FolderResponse(FolderBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    created_at: datetime
