"""
User and profile schemas
"""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr


class ProfileBase(BaseModel):
    email: EmailStr


class ProfileCreate(ProfileBase):
    id: UUID


class ProfileUpdate(BaseModel):
    email: EmailStr | None = None


class ProfileResponse(ProfileBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    role: str
    created_at: datetime
    updated_at: datetime
