"""User/Profile schemas - pure Pydantic, separate from DB models."""

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field

from app.models.enums import UserRole
from app.typing.common import response_config

# ================= Requests =================


class ProfileUpdate(BaseModel):
    """Update profile - all fields optional for PATCH."""

    email: EmailStr | None = None
    is_onboarded: bool | None = None


class DowngradeResolveRequest(BaseModel):
    """Feeds a downgraded user keeps; every other subscription (and all newsletters) is removed."""

    keep_feed_ids: list[UUID] = Field(default_factory=list)


# ================= Responses =================


class ProfileResponse(BaseModel):
    """Public profile response."""

    model_config = response_config

    id: UUID
    email: str
    role: UserRole
    is_onboarded: bool
    created_at: datetime
    updated_at: datetime


class OverLimitResource(BaseModel):
    """Usage vs. limit for one resource; ``over`` is True when current holdings exceed the limit."""

    usage: int
    limit: int  # -1 = unlimited
    over: bool


class OverLimitState(BaseModel):
    """What a user holds beyond their plan, e.g. after a Pro -> Basic downgrade.

    ``downgrade_required`` gates Basic users until they pick what to keep. Paid users retain
    access to existing holdings above newly introduced caps. Saved
    articles are informational only: excess saves are kept, and new saves stay blocked by the
    regular saved-articles cap.
    """

    downgrade_required: bool
    subscriptions: OverLimitResource
    newsletters: OverLimitResource
    saved_articles: OverLimitResource


class UserLimitsResponse(BaseModel):
    """Resource limits and current usage response."""

    model_config = response_config

    role: UserRole
    limits: dict[str, Any]
    usage: dict[str, Any]
    over_limit: OverLimitState


class DowngradeResolveResponse(BaseModel):
    """Outcome of resolving a downgrade."""

    kept_count: int
    removed_feed_count: int
    removed_newsletter_count: int
    # Holdings vs. limits after the change, so clients can lift their gate from this response
    over_limit: OverLimitState


# ================= Auth =================


class TokenData(BaseModel):
    """JWT token payload data."""

    sub: str  # User ID
    email: str | None = None
    role: str | None = None
