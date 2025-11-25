"""Article schemas."""

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel

from .common import ArticlePriority


class ArticleCreate(BaseModel):
    """
    Internal Schema for creating a new article from a feed.
    Used by the Feed Ingester.
    """

    title: str | None = None
    link: str
    guid: str

    # Content
    description: str | None = None
    content: str | None = None

    # Metadata
    author: str | None = None
    published_at: datetime
    image_url: str | None = None
    estimated_read_time_minutes: int | None = 1

    # Relations
    feed_id: UUID | None = None  # Optional during parsing phase

    # Extra metadata for processing
    user_id: UUID | None = None  # Optional, for context


class ArticleUpdate(BaseModel):
    """User interaction updates for articles."""

    is_read: bool | None = None
    is_read_later: bool | None = None
    priority: ArticlePriority | str | None = None
    user_note: str | None = None


class FeedInfo(BaseModel):
    """Feed information in article response."""

    id: UUID
    title: str
    url: str
    link: str | None = None
    image_url: str | None = None


class ArticleResponse(BaseModel):
    """Article response schema for API."""

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
