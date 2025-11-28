"""
Article schemas - DEPRECATED, use entries.py instead.
Kept for backward compatibility during migration.
"""

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel

from app.models.enums import ArticlePriority
from app.typing.common import response_config

# ================= Requests =================


class ArticleCreate(BaseModel):
    """
    Schema for creating articles during feed parsing.
    Used internally by feed ingestion system.
    """

    feed_id: UUID | None = None  # Set by service layer
    title: str | None = None
    link: str
    description: str | None = None
    content: str | None = None
    image_url: str | None = None
    author: str | None = None
    published_at: datetime
    guid: str
    estimated_read_time_minutes: int | None = None


class ArticleUpdate(BaseModel):
    """
    User interaction updates for articles.
    DEPRECATED: Use EntryUpdate from entries.py instead.
    """

    is_read: bool | None = None
    is_saved: bool | None = None
    priority: ArticlePriority | None = None
    user_note: str | None = None


# ================= Responses =================


class FeedInfo(BaseModel):
    """
    Feed information embedded in article response.
    Lightweight version of FeedSummary.
    """

    model_config = response_config

    id: UUID
    title: str
    url: str
    link: str | None = None
    image_url: str | None = None


class ArticleResponse(BaseModel):
    """
    Article response schema for API.
    DEPRECATED: Migrate to EntryDetail from entries.py for new code.
    """

    model_config = response_config

    id: UUID
    title: str | None = None
    link: str
    description: str | None = None
    content: str | None = None
    image_url: str | None = None
    author: str | None = None
    published_at: datetime
    estimated_read_time_minutes: int | None = None
    source_domain: str | None = None

    is_read: bool = False
    is_read_later: bool = False
    priority: str = "MEDIUM"
    read_at: datetime | None = None
    user_note: str | None = None
    article_type: str = "feed"

    created_at: datetime
    feed: FeedInfo | dict[str, Any] | None = None

    # Auto-extracted content fields
    extracted_content: str | None = None
    extracted_read_time: int | None = None
