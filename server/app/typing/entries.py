"""
Entry schemas - Unified schema for both feed articles and clipped/saved articles.
Maps directly to DB model: ArticleContent + UserEntry + FeedArticle.
"""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field, HttpUrl, field_validator

from app.models.enums import ArticlePriority
from app.typing.common import response_config

# ================= Base Field Bundles =================


class ContentFields(BaseModel):
    """Core content fields - maps to ArticleContent table."""

    title: str | None = None
    link: str
    description: str | None = None
    content: str | None = None
    image_url: str | None = None
    author: str | None = None


class UserStateFields(BaseModel):
    """User interaction state - maps to UserEntry table."""

    is_read: bool = False
    is_saved: bool = False
    priority: ArticlePriority = ArticlePriority.MEDIUM
    user_note: str | None = None
    read_at: datetime | None = None


class FeedContextFields(BaseModel):
    """Denormalized feed context - NO embedded objects for performance."""

    feed_id: UUID | None = None
    feed_title: str | None = None
    feed_icon: str | None = None
    published_at: datetime | None = None


# ================= API Responses =================


class EntryListItem(ContentFields, UserStateFields, FeedContextFields):
    """
    List view - lightweight, NO heavy content.
    Optimized for feed/list rendering.
    """

    model_config = response_config

    id: UUID
    source_domain: str | None = None
    created_at: datetime

    # Override to exclude heavy fields in lists
    description: str | None = Field(None, description="Truncated preview")
    content: None = None  # Never include in lists


class EntryDetail(ContentFields, UserStateFields, FeedContextFields):
    """
    Detail view - includes full HTML content.
    Used for article reading page.
    """

    model_config = response_config

    id: UUID
    source_domain: str | None = None
    created_at: datetime

    # Full fields (not truncated)
    description: str | None = None
    content: str | None = None

    # Auto-extraction fields (added by service layer)
    extracted_content: str | None = None


# ================= API Requests =================


class EntryCreateExternal(BaseModel):
    """Create a manually saved entry (Read-Later/Clipped)."""

    url: HttpUrl
    title: str | None = None
    content: str | None = None
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
    is_saved: bool | None = None
    priority: ArticlePriority | None = None
    user_note: str | None = None


# ================= Internal (Feed Parsing) =================


class ArticleCreate(BaseModel):
    """
    Internal schema for feed ingestion - NOT exposed in API.
    Used by feed parsing workers.
    """

    feed_id: UUID | None = None
    title: str | None = None
    link: str
    description: str | None = None
    content: str | None = None
    image_url: str | None = None
    author: str | None = None
    published_at: datetime
    guid: str
