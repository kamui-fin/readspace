"""Article schema definitions."""

import json
from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import AnyUrl, BaseModel, ConfigDict, Field, HttpUrl, field_validator

from typing import Annotated, Union
from app.models.enums import ArticlePriority

T = TypeVar("T")


class PaginatedResponse(BaseModel, Generic[T]):
    """Generic paginated response wrapper."""

    items: list[T]
    total: int
    page: int
    size: int
    pages: int



# ========= Article Content Schemas =========
class ArticleContentBase(BaseModel):
    """Base schema for article content."""

    title: str | None = None
    link: str  # Changed from AnyUrl - validation only on input, not output
    description: str | None = None
    content: str | None = None
    image_url: str | None = None
    author: str | None = Field(None, max_length=500)
    published_at: datetime | None = None
    estimated_read_time_minutes: int | None = Field(None, ge=0)


class ArticleContentCreate(ArticleContentBase):
    """Schema for creating article content."""

    link: AnyUrl  # Validate URLs on input


class ArticleContentResponse(ArticleContentBase):
    """Schema for article content responses."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    created_at: datetime
    updated_at: datetime


class ArticleContentListResponse(BaseModel):
    """Minimal content schema for list views - excludes heavy content field."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    title: str | None = None
    link: str
    description: str | None = None
    image_url: str | None = None
    author: str | None = Field(None, max_length=500)
    published_at: datetime | None = None
    estimated_read_time_minutes: int | None = Field(None, ge=0)
    created_at: datetime
    updated_at: datetime


# ========= Feed Article Schemas =========
class FeedArticleBase(BaseModel):
    """Base schema for feed articles."""

    guid: str = Field(..., max_length=1024)
    is_read: bool = False
    is_read_later: bool = False


class FeedArticleCreate(FeedArticleBase):
    """Schema for creating a feed article."""

    feed_id: UUID
    user_id: UUID
    content_id: UUID


class FeedArticleUpdate(BaseModel):
    """Schema for updating feed article state."""

    is_read: bool | None = None
    is_read_later: bool | None = None
    is_favorite: bool | None = None


class FeedArticleResponse(FeedArticleBase):
    """Schema for feed article detail responses - includes full content."""

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


class FeedArticleListResponse(FeedArticleBase):
    """Schema for feed article list responses - excludes heavy content field."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    feed_id: UUID
    content_id: UUID
    user_id: UUID
    read_at: datetime | None = None
    created_at: datetime
    updated_at: datetime

    # Include minimal content (no 'content' field)
    content: ArticleContentListResponse


# ========= Clipped Article Schemas =========
class ClippedArticleBase(BaseModel):
    """Base schema for clipped articles."""

    priority: ArticlePriority = ArticlePriority.MEDIUM
    note: str | None = Field(None, max_length=2000)
    is_read: bool = False
    is_read_later: bool = True


class ClippedArticleCreate(ClippedArticleBase):
    """Schema for creating a clipped article."""

    user_id: UUID
    content_id: UUID


class ClippedArticleUpdate(BaseModel):
    """Schema for updating clipped article."""

    title: str | None = Field(None, max_length=1000)
    priority: ArticlePriority | None = None
    note: str | None = Field(None, max_length=2000)
    is_read: bool | None = None
    is_read_later: bool | None = None
    read_at: datetime | None = None

    @field_validator("priority", mode="before")
    @classmethod
    def convert_priority_to_uppercase(cls, v: str | ArticlePriority | None) -> ArticlePriority | None:
        """Convert priority string to uppercase enum value."""
        if v is None or isinstance(v, ArticlePriority):
            return v
        if isinstance(v, str):
            return ArticlePriority(v.upper())
        return v


class ClippedArticleResponse(ClippedArticleBase):
    """Schema for clipped article detail responses - includes full content."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    content_id: UUID
    user_id: UUID
    read_at: datetime | None = None
    created_at: datetime

    # Include the content
    content: ArticleContentResponse


class ClippedArticleListResponse(ClippedArticleBase):
    """Schema for clipped article list responses - excludes heavy content field."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    content_id: UUID
    user_id: UUID
    read_at: datetime | None = None
    created_at: datetime

    # Include minimal content (no 'content' field)
    content: ArticleContentListResponse


# ========= Unified Article Schemas (Polymorphic) =========
class UnifiedArticleBase(BaseModel):
    """Base fields common to all article types."""

    id: UUID
    title: str | None = None
    link: str
    description: str | None = None
    image_url: str | None = None
    author: str | None = Field(None, max_length=500)
    published_at: datetime | None = None
    estimated_read_time_minutes: int | None = Field(None, ge=0)

    # User interaction state
    is_read: bool = False
    is_read_later: bool = False
    read_at: datetime | None = None

    created_at: datetime
    updated_at: datetime

    # Auto-extracted content fields
    extracted_content: str | None = None
    extracted_read_time: int | None = Field(None, ge=0)


class FeedArticleUnifiedResponse(UnifiedArticleBase):
    """Unified response for feed articles - type-safe, no nullable feed fields."""

    model_config = ConfigDict(from_attributes=True)

    article_type: str = Field(default="feed", pattern="^feed$")

    # Feed-specific fields (always present, never null)
    feed_id: UUID
    guid: str
    folder_id: UUID | None = None
    feed: dict[str, Any] | None = None

    # Full content for detail view
    content: str | None = None
    description_preview: str | None = Field(None, max_length=250)


class ClippedArticleUnifiedResponse(UnifiedArticleBase):
    """Unified response for clipped articles - type-safe, no nullable clipped fields."""

    model_config = ConfigDict(from_attributes=True)

    article_type: str = Field(default="clipped", pattern="^clipped$")

    # Clipped-specific fields (always present, never null)
    priority: str
    note: str | None = None

    # Full content for detail view
    content: str | None = None
    description_preview: str | None = Field(None, max_length=250)


class FeedArticleUnifiedListResponse(UnifiedArticleBase):
    """List response for feed articles - excludes heavy content field."""

    model_config = ConfigDict(from_attributes=True)

    article_type: str = Field(default="feed", pattern="^feed$")

    feed_id: UUID
    guid: str
    folder_id: UUID | None = None
    feed: dict[str, Any] | None = None

    # No 'content' field in list view
    description_preview: str | None = Field(None, max_length=250)


class ClippedArticleUnifiedListResponse(UnifiedArticleBase):
    """List response for clipped articles - excludes heavy content field."""

    model_config = ConfigDict(from_attributes=True)

    article_type: str = Field(default="clipped", pattern="^clipped$")

    priority: str
    note: str | None = None

    # No 'content' field in list view
    description_preview: str | None = Field(None, max_length=250)


# Polymorphic union types using discriminator for automatic type selection

UnifiedArticleResponse = Annotated[
    Union[FeedArticleUnifiedResponse, ClippedArticleUnifiedResponse], Field(discriminator="article_type")
]

UnifiedArticleListResponse = Annotated[
    Union[FeedArticleUnifiedListResponse, ClippedArticleUnifiedListResponse], Field(discriminator="article_type")
]


class ArticleCreate(BaseModel):
    """Schema for creating an article from RSS feed."""

    feed_id: UUID
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


class ArticleUpdate(BaseModel):
    """Schema for updating article state."""

    is_read: bool | None = None
    is_read_later: bool | None = None
    article_type: str | None = Field(None, pattern="^(feed|clipped)$")


class SaveArticleRequest(BaseModel):
    """Schema for saving external articles to the user's collection."""

    url: HttpUrl  # Validate on input
    title: str | None = Field(None, max_length=1000)
    content: str | None = Field(None, max_length=5_000_000)  # 5MB content limit
    metadata: dict[str, Any] | None = Field(None, max_length=50)
    priority: str | None = Field(None, max_length=20)
    note: str | None = Field(None, max_length=10_000)


# = ======== User Entry Schemas =========
class UserEntryBase(BaseModel):
    """Base schema for user entries."""

    is_read: bool = False
    is_read_later: bool = False
    is_favorite: bool = False
    is_archived: bool = False
    read_at: datetime | None = None
    user_note: str | None = None
    user_tags: list[str] | None = None


class UserEntryCreate(UserEntryBase):
    """Schema for creating a user entry."""

    user_id: UUID
    content_id: UUID
    feed_article_id: UUID | None = None


class UserEntryUpdate(BaseModel):
    """Schema for updating a user entry."""

    is_read: bool | None = None
    is_read_later: bool | None = None
    is_favorite: bool | None = None
    is_archived: bool | None = None
    read_at: datetime | None = None
    user_note: str | None = None
    user_tags: list[str] | None = None


class UserEntryResponse(UserEntryBase):
    """Schema for user entry responses."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: UUID
    content_id: UUID
    feed_article_id: UUID | None
    created_at: datetime
    updated_at: datetime
