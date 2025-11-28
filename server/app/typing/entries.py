"""
Entry schemas - DRY approach using SQLModel as base.
Unified schema for both feed articles and clipped/saved articles.
"""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field, HttpUrl, field_validator

from app.models.enums import ArticlePriority
from app.typing.common import response_config

# ================= Base (Field Bundles) =================


class EntryContentBase(BaseModel):
    """Core content fields - from ArticleContent model."""

    title: str | None = None
    link: str
    image_url: str | None = None
    author: str | None = None
    published_at: datetime | None = None
    estimated_read_time_minutes: int | None = None


class EntryUserStateBase(BaseModel):
    """User interaction state - from UserEntry model."""

    is_read: bool = False
    is_read_later: bool = False
    is_favorite: bool = False
    priority: ArticlePriority = ArticlePriority.MEDIUM


# ================= Requests =================


class EntryCreateExternal(BaseModel):
    """Create a manually saved entry (Read-Later/Clipped)."""

    url: HttpUrl
    title: str | None = None
    content: str | None = None  # Optional manual content override
    priority: ArticlePriority = ArticlePriority.MEDIUM
    note: str | None = None

    @field_validator("priority", mode="before")
    @classmethod
    def normalize_priority(cls, v):
        """Normalize priority to uppercase if it's a string."""
        if isinstance(v, str):
            return v.upper()
        return v


class EntryUpdate(BaseModel):
    """Update user interaction state - all fields optional for PATCH."""

    is_read: bool | None = None
    is_read_later: bool | None = None
    is_favorite: bool | None = None
    priority: ArticlePriority | None = None
    user_note: str | None = None


# ================= Responses =================


class EntryBase(EntryContentBase, EntryUserStateBase):
    """
    Base response combining content + user state.
    Shared by list and detail views.
    """

    model_config = response_config

    id: UUID

    # Context (denormalized for performance)
    feed_id: UUID | None = None
    feed_title: str | None = None
    feed_icon: str | None = None


class EntrySummary(EntryBase):
    """
    List view - lightweight, NO HTML content.
    Optimized for feed/list rendering.
    """

    description: str | None = Field(None, max_length=300, description="Short text preview")


class EntryDetail(EntryBase):
    """
    Reader view - includes full HTML content.
    Used for article reading page.
    """

    # Heavy fields (deferred in DB queries)
    description: str | None = None  # Full description
    content: str | None = None  # Full HTML body

    user_note: str | None = None
    read_at: datetime | None = None
    created_at: datetime
