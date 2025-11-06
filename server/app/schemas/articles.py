"""Article schema definitions."""

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import AnyUrl, BaseModel, ConfigDict, Field, HttpUrl, field_validator

from app.models.enums import ArticlePriority


# ========= Article Content Schemas =========
class ArticleContentBase(BaseModel):
    """Base schema for article content."""

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
    """Schema for creating article content."""

    pass


class ArticleContentResponse(ArticleContentBase):
    """Schema for article content responses."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    created_at: datetime
    updated_at: datetime


# ========= Feed Article Schemas =========
class FeedArticleBase(BaseModel):
    """Base schema for feed articles."""

    guid: str = Field(..., max_length=1024)
    is_read: bool = False
    is_read_later: bool = False
    is_favorite: bool = False


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
    """Schema for feed article responses."""

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


# ========= Clipped Article Schemas =========
class ClippedArticleBase(BaseModel):
    """Base schema for clipped articles."""

    priority: ArticlePriority = ArticlePriority.MEDIUM
    note: str | None = Field(None, max_length=2000)
    is_read: bool = False
    is_read_later: bool = True
    is_favorite: bool = False


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
    is_favorite: bool | None = None
    read_at: datetime | None = None


class ClippedArticleResponse(ClippedArticleBase):
    """Schema for clipped article responses."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    content_id: UUID
    user_id: UUID
    read_at: datetime | None = None
    created_at: datetime

    # Include the content
    content: ArticleContentResponse


# ========= Unified Article Schemas =========
class ArticleBase(BaseModel):
    """Unified article schema that can represent both feed and clipped articles."""

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
    folder_id: UUID | None = None


class ArticleCreate(BaseModel):
    """Schema for creating an article from RSS feed."""

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
    """Schema for updating article state."""

    is_read: bool | None = None
    is_read_later: bool | None = None
    is_favorite: bool | None = None
    article_type: str | None = Field(None, pattern="^(feed|clipped)$")


class ArticleResponse(ArticleBase):
    """Schema for unified article responses."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    created_at: datetime
    updated_at: datetime

    # Additional metadata for API consumers
    article_type: str  # "feed" or "clipped"
    feed: dict[str, Any] | None = None

    # Auto-extracted content fields
    extracted_content: str | None = None
    extracted_read_time: int | None = Field(None, ge=0)

    # Performance optimization: truncated description for list views
    # Full description field may be None in list views to save bandwidth
    # Use description_preview for display in article lists
    description_preview: str | None = Field(None, max_length=250)


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
        """Validate metadata size and nesting depth."""
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
