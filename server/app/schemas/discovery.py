"""Feed discovery and search schema definitions."""

from typing import Any

from pydantic import AnyUrl, BaseModel, ConfigDict, Field


class DiscoverSearchRequest(BaseModel):
    """Request schema for RSS feed discovery search."""

    query: str | None = Field(None, max_length=500, description="Search query text")
    category: str | None = Field(None, max_length=100, description="Feed category to filter by")
    language: str = Field("en", max_length=10, description="Language code for filtering")
    limit: int = Field(10, ge=1, le=20, description="Maximum number of results")


class RecommendationsRequest(BaseModel):
    """Request schema for getting feed recommendations based on multiple categories."""

    categories: list[str] = Field(..., min_length=1, max_length=20, description="List of category names")
    language: str = Field("en", max_length=10, description="Language code for filtering")
    limit: int = Field(20, ge=1, le=100, description="Maximum number of results")


class FeedDiscoveryResult(BaseModel):
    """Feed result with relevance score for discovery."""

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
    """Response schema for RSS feed discovery search."""

    results: list[FeedDiscoveryResult]
    total_count: int
    query: str | None
    category: str | None
    language: str


class CategoryInfo(BaseModel):
    """Category information for the discovery grid."""

    name: str
    display_name: str
    avg_popularity: float


class DiscoverCategoriesResponse(BaseModel):
    """Response schema for discovery categories."""

    categories: list[CategoryInfo]
    language: str
