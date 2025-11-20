"""Feed schema definitions."""

from datetime import datetime
from typing import TYPE_CHECKING
from uuid import UUID

from pydantic import AnyUrl, BaseModel, ConfigDict, Field, field_validator

if TYPE_CHECKING:
    from app.schemas.articles import ArticleResponse


class FeedBase(BaseModel):
    """Base feed schema."""

    url: AnyUrl
    title: str = Field(..., max_length=500)
    description: str | None = None
    link: AnyUrl | None = None
    language: str | None = Field(None, max_length=50)
    image_url: str | None = None
    ttl: int | None = Field(None, gt=0)
    skip_hours: list[int] | None = Field(None, min_length=0, max_length=24)
    skip_days: list[str] | None = Field(None, min_length=0, max_length=7)


class FeedCreate(BaseModel):
    """Schema for creating a feed subscription.

    Note: Title is optional here because it will be automatically parsed from the RSS feed.
    The feed parser always provides a title (with fallback to domain name).
    """

    url: AnyUrl
    folder_id: UUID
    title: str | None = Field(None, max_length=500)


class FeedUpdate(BaseModel):
    """Schema for updating user-specific feed subscription settings.

    Only allows updating subscription-specific fields:
    - title: Custom title override (stored as custom_title in subscription)
    - folder_id: Move feed to a different folder
    - is_favorite: Toggle favorite status

    Note: Global feed properties (url, description, etc.) can only be updated
    via the admin endpoint.
    """

    # Custom title override for this user's subscription
    title: str | None = Field(None, max_length=500)
    # Folder assignment
    folder_id: UUID | None = None
    # Favorite status
    is_favorite: bool | None = None


class AdminFeedUpdate(BaseModel):
    """Schema for updating global feed properties (admin only).

    Allows updating any global feed metadata that affects all users:
    - Basic metadata: title, description, link, language, image_url
    - RSS-specific: ttl, skip_hours, skip_days
    - Feed classification: top_level_category, popularity_score
    - Feed URL: url (the RSS feed endpoint itself)

    All fields are optional - only provided fields will be updated.
    """

    # Basic feed metadata
    title: str | None = Field(None, max_length=500)
    description: str | None = Field(None, max_length=2000)
    link: AnyUrl | None = None
    language: str | None = Field(None, max_length=50)
    image_url: str | None = None

    # RSS-specific metadata
    ttl: int | None = Field(None, gt=0)
    skip_hours: list[int] | None = Field(None, min_length=0, max_length=24)
    skip_days: list[str] | None = Field(None, min_length=0, max_length=7)

    # Feed classification
    top_level_category: str | None = None
    popularity_score: float | None = Field(None, ge=0.0, le=100.0)

    # Feed URL (the RSS feed endpoint)
    url: AnyUrl | None = None


class FeedResponse(FeedBase):
    """Schema for feed responses."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    tags: list[str] | None = None
    top_level_category: str | None = None
    popularity_score: float | None = None
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
    is_favorite: bool | None = None

    @field_validator("link", mode="before")
    @classmethod
    def convert_empty_string_to_none(cls, v: str | None) -> str | None:
        """Convert empty strings to None for URL fields."""
        return None if v == "" else v


class FeedBasicInfo(BaseModel):
    """Minimal feed info for nesting in Article responses."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    title: str
    url: AnyUrl
    image_url: str | None


class FeedWithArticlesResponse(FeedResponse):
    """Feed response with nested articles."""

    articles: list["ArticleResponse"] = []


class FeedEnrichmentResponse(BaseModel):
    """Schema for structured AI response during feed enrichment."""

    enhanced_description: str = Field(
        ..., max_length=300, description="Enhanced/expanded description for better context"
    )
    tags: list[str] = Field(..., min_length=1, max_length=10, description="Specific keywords and topics")
    category: str = Field(..., description="One of the 12 predefined categories")
    popularity_estimate: int = Field(..., ge=1, le=100, description="Popularity estimate on scale 1-100")
