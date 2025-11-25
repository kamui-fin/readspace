from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr


class ProfileBase(BaseModel):
    email: EmailStr


class ProfileResponse(ProfileBase):
    id: UUID
    role: str
    created_at: datetime
    updated_at: datetime


class TokenData(BaseModel):
    sub: str
    email: str | None = None
    role: str | None = None
