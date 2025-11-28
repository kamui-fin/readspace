"""User/Profile schemas - pure Pydantic, separate from DB models."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, EmailStr

from app.models.enums import UserRole
from app.typing.common import response_config

# ================= Requests =================


class ProfileUpdate(BaseModel):
    """Update profile - all fields optional for PATCH."""

    email: EmailStr | None = None


# ================= Responses =================


class ProfileResponse(BaseModel):
    """Public profile response."""

    model_config = response_config

    id: UUID
    email: str
    role: UserRole
    created_at: datetime
    updated_at: datetime


# ================= Auth =================


class TokenData(BaseModel):
    """JWT token payload data."""

    sub: str  # User ID
    email: str | None = None
    role: str | None = None
