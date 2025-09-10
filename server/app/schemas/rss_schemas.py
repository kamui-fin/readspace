from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, HttpUrl, AnyUrl


# Generic Paginated Response
class PaginatedResponse[T](BaseModel):
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


class FolderUpdate(FolderBase):
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


# TODO: can't this be based on FeedBase
class FeedUpdate(BaseModel):
    url: AnyUrl | None = None
    title: str | None = Field(None, max_length=500)
    description: str | None = None
    link: AnyUrl | None = None
    language: str | None = Field(None, max_length=50)
    image_url: str | None = None
    folder_id: UUID | None = None
    ttl: int | None = Field(None, gt=0)
    skip_hours: list[int] | None = Field(None, min_length=0, max_length=24)
    skip_days: list[str] | None = Field(None, min_length=0, max_length=7)


class FeedResponse(FeedBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
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
    link: AnyUrl
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
    feed: dict[str, Any] | None = (
        None  # Nested feed info for both RSS and clipped articles
    )


# Legacy schemas (kept for backward compatibility)
Article = FeedArticleResponse


# ========= OPML Schemas =========
class OpmlImportRequest(BaseModel):
    opml_content: str  # The raw OPML XML content as a string


class OpmlOutline(BaseModel):
    text: str | None = None
    title: str | None = None
    type: str | None = None
    xmlUrl: AnyUrl | None = None
    htmlUrl: AnyUrl | None = None
    # For nested outlines/folders
    children: list["OpmlOutline"] | None = None


class OpmlExport(BaseModel):
    opml_content: str


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
    refined_title: str = Field(..., min_length=3, max_length=120, description="Clean title without RSS/Feed words")
    refined_description: str = Field(..., max_length=300, description="What the feed offers generally")
    tags: list[str] = Field(..., min_items=1, max_items=10, description="Specific keywords and topics")
    category: str = Field(..., description="One of the 12 predefined categories")
    popularity_estimate: int = Field(..., ge=1, le=100, description="Popularity estimate on scale 1-100")
