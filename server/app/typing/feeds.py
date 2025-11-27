"""Feed schemas - DRY approach using SQLModel as base."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field, HttpUrl, field_validator

from app.typing.common import FeedCategory, response_config

# ================= Base (Field Bundles) =================


class FeedBase(BaseModel):
    """Core feed fields - reused across schemas."""

    url: str
    title: str = Field(..., max_length=500)
    link: str | None = None

    @field_validator("url", "link", mode="before")
    @classmethod
    def empty_str_to_none(cls, v):
        return v or None


# ================= Requests =================


class FeedCreate(BaseModel):
    """Input for discovering/adding a feed."""

    url: HttpUrl  # TODO: HttpUrl, but allow rsshub://
    folder_id: UUID | str = "default"


class FeedUpdateInternal(BaseModel):
    """Used by the worker to update global metadata."""

    title: str | None = None
    description: str | None = None
    language: str | None = None
    image_url: str | None = None

    # HTTP caching headers for conditional GET
    etag_header: str | None = None
    last_modified_header: str | None = None
    adaptive_fetch_interval_minutes: int | None = None


class AdminFeedUpdate(BaseModel):
    """Admin-only schema for updating global feed properties."""

    title: str | None = None
    description: str | None = None
    link: str | None = None
    language: str | None = None
    image_url: str | None = None
    url: HttpUrl | None = None
    top_level_category: FeedCategory | None = None
    popularity_score: float | None = None


# ================= Responses =================


class FeedSummary(FeedBase):
    """
    Lightweight feed info.
    Used in: Subscriptions List, Search Results, embedded in articles.
    """

    model_config = response_config

    id: UUID
    image_url: str | None = None
    language: str | None = None

    # Vital Stats
    last_fetched_at: datetime | None = None
    health_status: int = Field(default=0, serialization_alias="error_count")


class FeedDetail(FeedSummary):
    """
    Heavy feed info - extends summary with full metadata.
    Used in: Feed Settings, Inspector.
    """

    description: str | None = None

    # Advanced Metadata
    popularity_score: float = 0.0
    subscriber_count: int = 0
    top_level_category: FeedCategory | None = None

    # Subscription status (for preview mode)
    is_subscribed: bool = False

    # Scheduling info (Debugging)
    next_fetch_at: datetime | None = None
    created_at: datetime
    updated_at: datetime | None = None


class FeedEnrichmentResponse(BaseModel):
    """
    AI enrichment response for feed metadata.
    Used in: Batch feed enrichment via Gemini API.
    """

    enhanced_description: str | None = None
    tags: list[str] = Field(default_factory=list)
    category: str
    popularity_estimate: int = Field(ge=1, le=100)
