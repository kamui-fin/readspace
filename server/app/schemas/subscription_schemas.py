"""Schemas for the new subscription-based feed architecture."""

from datetime import datetime
from uuid import UUID

from pydantic import AnyUrl, BaseModel, ConfigDict, Field, field_validator

from app.schemas.rss_schemas import FolderResponse


# ========= Feed Schemas (Updated for Global Feeds) =========
class FeedResponse(BaseModel):
    """Response schema for global feeds."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    url: AnyUrl
    title: str | None = None
    description: str | None = None
    link: AnyUrl | None = None
    language: str | None = None
    image_url: str | None = None
    ttl: int | None = None
    skip_hours: list[int] | None = None
    skip_days: list[str] | None = None

    # Feed fetching state
    last_fetched_at: datetime | None = None
    last_modified_header: str | None = None
    etag_header: str | None = None
    last_article_published_at: datetime | None = None
    # Note: Error tracking and subscriber count fields removed from model

    created_at: datetime
    updated_at: datetime

    @field_validator("link", mode="before")
    @classmethod
    def convert_empty_string_to_none(cls, v: str | None) -> str | None:
        """Convert empty strings to None for URL fields."""
        return None if v == "" else v


# ========= Subscription Schemas =========
class SubscriptionBase(BaseModel):
    """Base subscription schema."""

    is_favorite: bool = False
    custom_title: str | None = Field(None, max_length=500)
    is_paused: bool = False


class SubscriptionCreate(SubscriptionBase):
    """Schema for creating a new subscription."""

    url: str  # URL of the feed to subscribe to (allows any URL scheme including rsshub://)
    folder_id: UUID | str  # Allow 'default' string for onboarding
    # tag_ids removed - using ARRAY field on feeds


class SubscriptionCreateByFeedId(SubscriptionBase):
    """Schema for creating a subscription to an existing feed by ID."""

    folder_id: UUID | str  # Allow 'default' string for onboarding


class SubscriptionUpdate(BaseModel):
    """Schema for updating a subscription."""

    folder_id: UUID | None = None
    # tag_ids removed - using ARRAY field on feeds
    is_favorite: bool | None = None
    custom_title: str | None = Field(None, max_length=500)
    is_paused: bool | None = None


class SubscriptionResponse(BaseModel):
    """Full subscription response with feed and folder info."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: UUID
    feed_id: UUID
    folder_id: UUID

    # User-specific feed settings (matching actual database model)
    is_favorite: bool
    custom_title: str | None = None

    # Subscription metadata - matching the actual database model
    created_at: datetime
    updated_at: datetime

    # Related data
    feed: FeedResponse
    folder: FolderResponse


# ========= User Article State Schemas =========
class UserArticleStateBase(BaseModel):
    """Base schema for user article states."""

    is_read: bool = False
    is_read_later: bool = False
    is_favorite: bool = False
    user_note: str | None = None
    user_tags: list[str] | None = None


class UserArticleStateCreate(UserArticleStateBase):
    """Schema for creating user article state."""

    user_id: UUID
    article_id: UUID


class UserArticleStateUpdate(BaseModel):
    """Schema for updating user article state."""

    is_read: bool | None = None
    is_read_later: bool | None = None
    is_favorite: bool | None = None
    user_note: str | None = None
    user_tags: list[str] | None = None


class UserArticleStateResponse(UserArticleStateBase):
    """Response schema for user article states."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: UUID
    article_id: UUID
    read_at: datetime | None = None

    created_at: datetime
    updated_at: datetime


# ========= Feed Article Schemas (Updated) =========
class FeedArticleBase(BaseModel):
    """Base schema for new feed articles."""

    guid: str = Field(..., max_length=1024)


class FeedArticleCreate(FeedArticleBase):
    """Schema for creating new feed articles."""

    feed_id: UUID
    content_id: UUID


class FeedArticleResponse(FeedArticleBase):
    """Response schema for new feed articles."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    feed_id: UUID
    content_id: UUID

    created_at: datetime
    updated_at: datetime


# ========= Enhanced Article Response (with User State) =========
class ArticleWithStateResponse(BaseModel):
    """Enhanced article response that includes user state."""

    model_config = ConfigDict(from_attributes=True)

    # Article data
    id: UUID
    feed_id: UUID
    content_id: UUID
    guid: str
    created_at: datetime
    updated_at: datetime

    # Content data (from article_contents)
    title: str | None = None
    link: AnyUrl | None = None
    description: str | None = None
    content: str | None = None
    image_url: str | None = None
    author: str | None = None
    published_at: datetime | None = None
    estimated_read_time_minutes: int | None = None

    # User state (from user_article_states if exists)
    is_read: bool = False
    read_at: datetime | None = None
    is_read_later: bool = False
    is_favorite: bool = False
    user_note: str | None = None
    user_tags: list[str] | None = None

    # Feed info (from subscription)
    feed_title: str | None = None
    custom_feed_title: str | None = None
    folder_id: UUID | None = None
    folder_name: str | None = None


# ========= Backward Compatibility Schemas =========
class LegacyFeedResponse(BaseModel):
    """Legacy feed response for backward compatibility."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID  # This will be subscription ID for compatibility
    user_id: UUID
    folder_id: UUID
    url: AnyUrl
    title: str | None = None
    description: str | None = None
    link: AnyUrl | None = None
    language: str | None = None
    image_url: str | None = None
    is_favorite: bool = False
    ttl: int | None = None
    skip_hours: list[int] | None = None
    skip_days: list[str] | None = None

    # Feed fetching state (from global feed)
    last_fetched_at: datetime | None = None
    last_modified_header: str | None = None
    etag_header: str | None = None
    last_article_published_at: datetime | None = None
    # Note: Error tracking fields removed from model

    created_at: datetime
    updated_at: datetime
