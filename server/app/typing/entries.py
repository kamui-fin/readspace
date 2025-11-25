"""
Unified Entry Schemas.
Replaces the old split between 'FeedArticle' and 'ClippedArticle'.
Matches the 'UserEntry' database model.
"""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, HttpUrl

from .common import ArticlePriority

# ================= Inputs =================


class EntryCreateExternal(BaseModel):
    """For manually saving a URL (Read-Later/Clipped)."""

    url: HttpUrl
    title: str | None = None
    content: str | None = None  # Optional manual content override
    priority: ArticlePriority = ArticlePriority.MEDIUM
    note: str | None = None


class EntryUpdate(BaseModel):
    """User interaction updates."""

    is_read: bool | None = None
    is_read_later: bool | None = None
    is_favorite: bool | None = None
    priority: ArticlePriority | None = None
    user_note: str | None = None


# ================= Outputs =================


class EntryBase(BaseModel):
    """Common fields for list and detail views."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID

    # Content Metadata (Flattened from ArticleContent)
    title: str | None = None
    link: str
    image_url: str | None = None
    author: str | None = None
    published_at: datetime | None = None
    estimated_read_time_minutes: int | None = None

    # User State (From UserEntry)
    is_read: bool = False
    is_read_later: bool = False
    is_favorite: bool = False
    priority: ArticlePriority = ArticlePriority.MEDIUM

    # Context
    feed_id: UUID | None = None
    feed_title: str | None = None  # Denormalized for convenience
    feed_icon: str | None = None  # Denormalized for convenience


class EntrySummary(EntryBase):
    """
    The List View.
    STRICTLY NO HTML CONTENT.
    """

    description: str | None = Field(None, max_length=300, description="Short text preview")


class EntryDetail(EntryBase):
    """
    The Reader View.
    Includes full HTML content.
    """

    # The heavy fields
    description: str | None = None  # Full description
    content: str | None = None  # Full HTML body

    user_note: str | None = None
    read_at: datetime | None = None
    created_at: datetime
