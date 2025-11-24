"""Article schemas."""

from datetime import datetime
from uuid import UUID
from pydantic import BaseModel


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
