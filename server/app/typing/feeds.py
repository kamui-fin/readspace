"""Feed schemas - DRY approach using SQLModel as base."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, HttpUrl, field_validator

from app.models.enums import FeedCategory
from app.typing.common import response_config
from app.typing.entries import ArticleCreate

# ================= Base (Field Bundles) =================


class FeedBase(BaseModel):
    """Core feed fields - reused across schemas."""

    url: str
    title: str = Field(...)
    description: str = "Follow recent articles from this feed"
    link: str | None = None
    language: str = "en"
    image_url: str | None = None

    @classmethod
    def empty_str_to_none(cls, v):
        return v or None


# ================= Requests =================


class FeedCreate(BaseModel):
    """Input for discovering/adding a feed."""

    url: HttpUrl
    folder_id: UUID | str = "default"


class AdminFeedUpdate(BaseModel):
    """Admin-only schema for updating global feed properties."""

    title: str | None = None
    description: str | None = None
    link: HttpUrl | None = None
    language: str | None = None
    image_url: str | None = None
    url: str | None = None
    top_level_category: FeedCategory | None = None
    popularity_score: float | None = None
    tags: list[str] | None = None


# ================= Responses =================


class FeedSummary(FeedBase):
    """
    Lightweight feed info.
    Used in: Subscriptions List, Search Results, embedded in articles.
    """

    model_config = response_config

    id: UUID


class FeedDetail(FeedSummary):
    """
    Heavy feed info - extends summary with full metadata.
    Used in: Feed Settings, Inspector.
    """

    description: str | None = None
    language: str = "en"

    # Fetching Logic
    last_fetched_at: datetime | None = None
    next_fetch_at: datetime | None = None
    adaptive_fetch_interval_minutes: int | None = None
    last_error_message: str | None = None
    error_count: int = Field(default=0, serialization_alias="error_count")

    # Advanced Metadata
    popularity_score: float = 0.0
    subscriber_count: int = 0

    top_level_category: FeedCategory | None = None
    tags: list[str] = Field(default_factory=list)

    @field_validator("tags", mode="before")
    @classmethod
    def none_to_list(cls, v):
        return v or []

    # Subscription status (for preview mode)
    is_subscribed: bool = False

    # Timestamps
    created_at: datetime
    last_updated_at: datetime | None = None


class FeedEnrichmentResponse(BaseModel):
    """
    AI enrichment response for feed metadata.
    Used in: Batch feed enrichment via Gemini API.
    """

    enhanced_description: str | None = None
    tags: list[str] = Field(default_factory=list)
    category: str
    popularity_estimate: int = Field(ge=1, le=100)


class FeedEnrichmentInput(BaseModel):
    """
    Input for batch feed enrichment.
    """

    title: str
    description: str | None = None
    domain: str
    language: str = "en"
    link: str | None = None
    url: str | None = None
    tags: list[str] = Field(default_factory=list)
    contributors: list[str] = Field(default_factory=list)
    articles: list[str] = Field(default_factory=list)


class FaviconResult(BaseModel):
    """Result from favicon extraction."""

    image_url: str | None = None
    canonical_link: str | None = None


class ArticleStats(BaseModel):
    """Statistics about recent articles for quality scoring."""

    count: int = 0
    image_ratio: float = 0.0
    avg_content_length: float = 0.0
    days_since_last_article: int = 999


class FeedScoringData(BaseModel):
    """Feed metadata used for scoring."""

    id: UUID | str | None = None
    title: str | None = None
    description: str | None = None
    image_url: str | None = None
    language: str | None = None
    domain: str | None = None


class FeedEnrichmentSnapshot(FeedScoringData):
    """Snapshot of feed data for enrichment processing."""

    link: str | None = None
    url: str | None = None
    article_stats: ArticleStats | None = None


class MeilisearchFeedDocument(BaseModel):
    """Feed document structure for Meilisearch indexing."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    url: str
    title: str
    description: str | None = None
    link: str | None = None
    language: str | None = None
    image_url: str | None = None
    tags: list[str] = Field(default_factory=list)
    top_level_category: str | None = None
    popularity_score: float = 0.0

    @field_validator("top_level_category", mode="before")
    @classmethod
    def convert_enum_to_str(cls, v):
        if hasattr(v, "value"):
            return v.value
        return v


class ParsedFeed(BaseModel):
    """
    Schema for feed preview data.
    Returned by the discovery/preview endpoint.
    """

    title: str
    id: str | None = None
    url: str | None = None
    description: str | None = None
    link: str | None = None
    language: str | None = None
    image_url: str | None = None
    last_updated_at: datetime | None = None
    tags: list[str] = Field(default_factory=list)
    articles: list["ArticleCreate"] = Field(default_factory=list)


class BulkDeleteResponse(BaseModel):
    """Response for bulk delete operations."""

    deleted_count: int
    deleted_ids: list[UUID]


class BulkUpdateResponse(BaseModel):
    """Response for bulk update operations."""

    updated_count: int
