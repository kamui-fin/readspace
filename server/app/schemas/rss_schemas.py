from datetime import datetime
from typing import Any, Generic, TypeVar
from uuid import UUID

from pydantic import AnyUrl, BaseModel, ConfigDict, Field, HttpUrl, field_validator

from app.models.rss_models import FeedCategory

T = TypeVar("T")


# Generic Paginated Response
class PaginatedResponse(BaseModel, Generic[T]):
    items: list[T]
    total: int
    page: int
    size: int
    pages: int


# ========= Folder Schemas =========
class FolderBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)


class FolderCreate(FolderBase):
    pass


class FolderUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=100)


class FolderResponse(FolderBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: UUID
    created_at: datetime
    updated_at: datetime


# ========= Feed Schemas =========
class FeedBase(BaseModel):
    url: AnyUrl
    title: str | None = Field(None, max_length=500)
    description: str | None = None
    link: AnyUrl | None = None
    language: str | None = Field(None, max_length=50)
    image_url: str | None = None
    ttl: int | None = Field(None, gt=0)
    skip_hours: list[int] | None = Field(None, min_length=0, max_length=24)
    skip_days: list[str] | None = Field(None, min_length=0, max_length=7)


class FeedCreate(FeedBase):
    folder_id: UUID


class FeedUpdate(BaseModel):
    """Schema for updating feed information - all fields optional."""

    url: AnyUrl | None = None
    title: str | None = Field(None, max_length=500)
    description: str | None = None
    link: AnyUrl | None = None
    language: str | None = Field(None, max_length=50)
    image_url: str | None = None
    folder_id: UUID | None = None
    top_level_category: FeedCategory | None = None
    popularity_score: float | None = Field(None, ge=0.0, le=100.0)
    ttl: int | None = Field(None, gt=0)
    skip_hours: list[int] | None = Field(None, min_length=0, max_length=24)
    skip_days: list[str] | None = Field(None, min_length=0, max_length=7)


class FeedResponse(FeedBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    top_level_category: str | None = None  # Serialized as string from enum
    last_fetched_at: datetime | None = None
    last_modified_header: str | None = None
    etag_header: str | None = None
    last_article_published_at: datetime | None = None
    created_at: datetime
    updated_at: datetime

    # Subscription-specific fields (only present when user is subscribed)
    is_subscribed: bool = False
    user_id: UUID | None = None
    folder_id: UUID | None = None
    unread_count: int | None = None

    @field_validator("link", mode="before")
    @classmethod
    def convert_empty_string_to_none(cls, v: str | None) -> str | None:
        """Convert empty strings to None for URL fields."""
        return None if v == "" else v


# Minimal feed info for nesting in Article
class FeedBasicInfo(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    title: str | None
    url: AnyUrl
    image_url: str | None


# ========= Article Schemas =========
class ArticleContentBase(BaseModel):
    title: str | None = None
    link: AnyUrl
    description: str | None = None
    content: str | None = None
    image_url: str | None = None
    author: str | None = Field(None, max_length=500)
    published_at: datetime | None = None
    estimated_read_time_minutes: int | None = Field(None, ge=0)
    custom_metadata: dict[str, Any] | None = None


class ArticleContentCreate(ArticleContentBase):
    pass


class ArticleContentResponse(ArticleContentBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    created_at: datetime
    updated_at: datetime


# FeedArticle schemas (RSS articles)
class FeedArticleBase(BaseModel):
    guid: str = Field(..., max_length=1024)
    is_read: bool = False
    is_read_later: bool = False
    is_favorite: bool = False


class FeedArticleCreate(FeedArticleBase):
    feed_id: UUID
    user_id: UUID
    content_id: UUID


class FeedArticleUpdate(BaseModel):
    is_read: bool | None = None
    is_read_later: bool | None = None
    is_favorite: bool | None = None


class FeedArticleResponse(FeedArticleBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    feed_id: UUID
    content_id: UUID
    user_id: UUID
    read_at: datetime | None = None
    created_at: datetime
    updated_at: datetime

    # Include the content
    content: ArticleContentResponse


# ClippedArticle schemas (manually saved web articles)
class ClippedArticleBase(BaseModel):
    priority: str = Field("medium", pattern="^(low|medium|high)$")
    note: str | None = Field(None, max_length=2000)
    is_read: bool = False
    is_read_later: bool = True
    is_favorite: bool = False


class ClippedArticleCreate(ClippedArticleBase):
    user_id: UUID
    content_id: UUID


class ClippedArticleUpdate(BaseModel):
    priority: str | None = Field(None, pattern="^(low|medium|high)$")
    note: str | None = Field(None, max_length=2000)
    is_read: bool | None = None
    is_read_later: bool | None = None
    is_favorite: bool | None = None
    read_at: datetime | None = None


class ClippedArticleResponse(ClippedArticleBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    content_id: UUID
    user_id: UUID
    read_at: datetime | None = None
    created_at: datetime

    # Include the content
    content: ArticleContentResponse


# Unified Article schemas (for backward compatibility and API responses)
class ArticleBase(BaseModel):
    """Unified article schema that can represent both feed and clipped articles"""

    # Core content (from ArticleContent)
    title: str | None = None
    link: AnyUrl
    description: str | None = None
    content: str | None = None
    image_url: str | None = None
    author: str | None = Field(None, max_length=500)
    published_at: datetime | None = None
    estimated_read_time_minutes: int | None = Field(None, ge=0)

    # User interaction state
    is_read: bool = False
    is_read_later: bool = False
    is_favorite: bool = False
    read_at: datetime | None = None

    # Clipped article specific (only present for clipped articles)
    priority: str | None = None
    note: str | None = None

    # Feed specific (only present for feed articles)
    feed_id: UUID | None = None
    guid: str | None = None
    folder_id: UUID | None = None  # From feed's folder for feed articles


class ArticleCreate(BaseModel):
    """For backward compatibility with RSS system"""

    feed_id: UUID
    user_id: UUID
    guid: str
    title: str | None = None
    link: str
    description: str | None = None
    content: str | None = None
    author: str | None = None
    image_url: str | None = None
    published_at: datetime | None = None
    estimated_read_time_minutes: int | None = None
    custom_metadata: dict[str, Any] | None = None
    is_read: bool = False
    is_read_later: bool = False
    is_favorite: bool = False


class ArticleUpdate(BaseModel):
    is_read: bool | None = None
    is_read_later: bool | None = None
    is_favorite: bool | None = None
    article_type: str | None = Field(None, pattern="^(feed|clipped)$")


class ArticleResponse(ArticleBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    created_at: datetime
    updated_at: datetime

    # Additional metadata for API consumers
    article_type: str  # "feed" or "clipped"
    feed: dict[str, Any] | None = None  # Nested feed info for both RSS and clipped articles


# Legacy schemas (kept for backward compatibility)
Article = FeedArticleResponse


# ========= OPML Schemas =========
class OpmlImportRequest(BaseModel):
    opml_content: str  # The raw OPML XML content as a string


class OpmlOutline(BaseModel):
    text: str | None = None
    title: str | None = None
    type: str | None = None
    xmlUrl: AnyUrl | None = None  # noqa: N815
    htmlUrl: AnyUrl | None = None  # noqa: N815
    # For nested outlines/folders
    children: list["OpmlOutline"] | None = None


class OpmlExport(BaseModel):
    opml_content: str


# OPML Import Response Schemas
class OpmlImportResponse(BaseModel):
    """Response schema for OPML import endpoint"""

    processing_mode: str = Field(..., description="Processing mode: 'background' for async processing")
    task_id: str = Field(..., description="Celery task ID for tracking import progress")
    message: str = Field(..., description="Human-readable status message")
    estimated_feeds: int = Field(..., ge=0, description="Estimated number of feeds to import")
    check_status_url: str = Field(..., description="API endpoint to check import status")
    status_page_url: str = Field(..., description="Frontend URL to view import progress")


class OpmlTaskMetadata(BaseModel):
    """Metadata for OPML import tasks stored in Redis"""

    user_id: str = Field(..., description="User ID who owns this import task")
    task_id: str = Field(..., description="Celery task ID")
    estimated_feeds: int = Field(..., ge=0, description="Estimated number of feeds")
    filename: str = Field(..., description="Original filename of uploaded OPML")
    created_at: str = Field(..., description="ISO timestamp when task was created")
    status: str = Field(..., description="Current task status")
    current_status: str | None = Field(None, description="Real-time status from Celery")


class OpmlImportProgress(BaseModel):
    """Progress information for active OPML imports"""

    completed: int = Field(..., ge=0, description="Number of feeds processed")
    total: int = Field(..., ge=0, description="Total number of feeds to process")
    successful: int = Field(..., ge=0, description="Number of successfully imported feeds")
    failed: int = Field(..., ge=0, description="Number of failed feed imports")
    already_existed: int = Field(..., ge=0, description="Number of feeds that already existed")


class OpmlImportResult(BaseModel):
    """Final result summary for completed OPML imports"""

    imported_count: int = Field(..., ge=0, description="Number of new feeds imported")
    failed_count: int = Field(..., ge=0, description="Number of feeds that failed to import")
    already_existed_count: int = Field(..., ge=0, description="Number of feeds that already existed")
    total_feeds: int = Field(..., ge=0, description="Total number of feeds processed")
    summary: dict[str, int] = Field(..., description="Summary breakdown of results")
    message: str = Field(..., description="Human-readable result summary")
    errors: list[dict[str, Any]] | None = Field(None, description="Detailed error information for failed imports")


class OpmlImportStatusResponse(BaseModel):
    """Response schema for import status endpoint"""

    task_id: str = Field(..., description="Celery task ID")
    status: str = Field(..., description="Current status: pending, in_progress, completed, failed")
    message: str = Field(..., description="Human-readable status message")
    progress: OpmlImportProgress | dict[str, Any] | None = Field(
        None, description="Progress information for active imports"
    )
    result: OpmlImportResult | None = Field(None, description="Final results for completed imports")
    error: str | None = Field(None, description="Error message for failed imports")
    metadata: OpmlTaskMetadata | None = Field(None, description="Task metadata from Redis")


class OpmlImportCancelResponse(BaseModel):
    """Response schema for import cancellation endpoint"""

    task_id: str = Field(..., description="Celery task ID that was cancelled")
    message: str = Field(..., description="Human-readable cancellation message")
    cancelled: bool = Field(..., description="Whether the cancellation was successful")
    cancelled_subtasks: int = Field(0, ge=0, description="Number of individual feed tasks cancelled")
    previous_state: str | None = Field(None, description="Previous task state if already completed")


class OpmlExportResponse(BaseModel):
    """Response schema for OPML export (returned as PlainTextResponse)"""

    content: str = Field(..., description="OPML XML content")
    filename: str = Field(default="readspace_feeds_export.opml", description="Suggested filename")
    media_type: str = Field(default="application/xml", description="MIME type")


# For parsing OPML structure
OpmlOutline.model_rebuild()


# Response for feed with its articles (example)
class FeedWithArticlesResponse(FeedResponse):
    articles: list[ArticleResponse] = []


# ========= Discover Schemas =========
class DiscoverSearchRequest(BaseModel):
    """Request schema for RSS feed discovery search"""

    query: str | None = Field(None, max_length=500, description="Search query text")
    category: str | None = Field(None, max_length=100, description="Feed category to filter by")
    language: str = Field("en", max_length=10, description="Language code for filtering")
    limit: int = Field(10, ge=1, le=20, description="Maximum number of results")


class FeedDiscoveryResult(BaseModel):
    """Feed result with relevance score for discovery"""

    model_config = ConfigDict(from_attributes=True)

    id: str
    title: str | None
    description: str | None
    url: AnyUrl
    link: AnyUrl | None
    image_url: str | None
    tags: list[str]
    language: str | None
    category: str | None
    popularity_score: float
    relevance: float = Field(..., ge=0.0, le=1.0, description="Relevance score from 0 to 1")
    search_metadata: dict[str, Any] | None = Field(None, description="Additional search metadata")
    is_preview: bool = Field(False, description="Indicates this is a live preview of a URL")
    preview_url: str | None = Field(None, description="Original URL for following (when is_preview=True)")


class DiscoverSearchResponse(BaseModel):
    """Response schema for RSS feed discovery search"""

    results: list[FeedDiscoveryResult]
    total_count: int
    query: str | None
    category: str | None
    language: str


class CategoryInfo(BaseModel):
    """Category information for the discovery grid"""

    name: str
    display_name: str
    feed_count: int
    avg_popularity: float


class DiscoverCategoriesResponse(BaseModel):
    """Response schema for discovery categories"""

    categories: list[CategoryInfo]
    language: str


# ========= Feed Enrichment Schemas =========
class FeedEnrichmentResponse(BaseModel):
    """Schema for structured AI response during feed enrichment"""

    refined_title: str = Field(
        ...,
        min_length=3,
        max_length=120,
        description="Clean title without RSS/Feed words",
    )
    refined_description: str = Field(..., max_length=300, description="What the feed offers generally")
    tags: list[str] = Field(..., min_length=1, max_length=10, description="Specific keywords and topics")
    category: str = Field(..., description="One of the 12 predefined categories")
    popularity_estimate: int = Field(..., ge=1, le=100, description="Popularity estimate on scale 1-100")


# ========= Article Management Schemas =========


class SaveArticleRequest(BaseModel):
    """Schema for saving external articles to the user's collection."""

    url: HttpUrl
    title: str | None = Field(None, max_length=1000)
    content: str | None = Field(None, max_length=5_000_000)  # 5MB content limit
    metadata: dict[str, Any] | None = Field(None, max_length=50)
    priority: str | None = Field(None, max_length=20)
    note: str | None = Field(None, max_length=10_000)

    @field_validator("metadata")
    @classmethod
    def validate_metadata(cls, v: dict[str, Any] | None) -> dict[str, Any] | None:
        if v is None:
            return v

        # Limit total metadata size by serialized JSON length
        import json

        serialized = json.dumps(v)
        if len(serialized) > 100_000:  # 100KB limit for metadata JSON
            raise ValueError("Metadata too large - maximum 100KB when serialized")

        # Prevent deeply nested objects to avoid DoS
        def check_depth(obj: Any, max_depth: int = 10, current_depth: int = 0) -> None:
            if current_depth > max_depth:
                raise ValueError("Metadata nesting too deep - maximum 10 levels")
            if isinstance(obj, dict):
                for value in obj.values():
                    check_depth(value, max_depth, current_depth + 1)
            elif isinstance(obj, list):
                for item in obj:
                    check_depth(item, max_depth, current_depth + 1)

        check_depth(v)
        return v
