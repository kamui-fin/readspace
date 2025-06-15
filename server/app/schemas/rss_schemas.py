from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, HttpUrl


# Generic Paginated Response
class PaginatedResponse[T](BaseModel):
    items: List[T]
    total: int
    page: int
    size: int
    pages: int

# ========= Folder Schemas =========
class FolderBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)

class FolderCreate(FolderBase):
    pass

class FolderUpdate(FolderBase):
    name: Optional[str] = Field(None, min_length=1, max_length=255)

class FolderResponse(FolderBase):
    model_config = ConfigDict(from_attributes=True)
    
    id: UUID
    user_id: UUID
    created_at: datetime
    updated_at: datetime

# ========= Tag Schemas =========
class TagBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)

class TagCreate(TagBase):
    pass

class TagUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)

class TagResponse(TagBase):
    model_config = ConfigDict(from_attributes=True)
    
    id: UUID
    user_id: UUID
    created_at: datetime
    updated_at: datetime

# ========= Feed Schemas =========
class FeedBase(BaseModel):
    url: HttpUrl
    title: Optional[str] = Field(None, max_length=500)
    description: Optional[str] = None
    link: Optional[HttpUrl] = None
    language: Optional[str] = Field(None, max_length=50)
    image_url: Optional[HttpUrl] = None
    is_favorite: bool = False
    ttl: Optional[int] = Field(None, gt=0)
    skip_hours: Optional[List[int]] = Field(None, min_length=0, max_length=24)
    skip_days: Optional[List[str]] = Field(None, min_length=0, max_length=7)

class FeedCreate(FeedBase):
    folder_id: UUID
    tag_ids: Optional[List[UUID]] = None

class FeedUpdate(BaseModel):
    url: Optional[HttpUrl] = None
    title: Optional[str] = Field(None, max_length=500)
    description: Optional[str] = None
    link: Optional[HttpUrl] = None
    language: Optional[str] = Field(None, max_length=50)
    image_url: Optional[HttpUrl] = None
    folder_id: Optional[UUID] = None
    is_favorite: Optional[bool] = None
    ttl: Optional[int] = Field(None, gt=0)
    skip_hours: Optional[List[int]] = Field(None, min_length=0, max_length=24)
    skip_days: Optional[List[str]] = Field(None, min_length=0, max_length=7)

class FeedResponse(FeedBase):
    model_config = ConfigDict(from_attributes=True)
    
    id: UUID
    user_id: UUID
    folder_id: UUID
    last_fetched_at: Optional[datetime] = None
    last_modified_header: Optional[str] = None
    etag_header: Optional[str] = None
    last_article_published_at: Optional[datetime] = None
    fetch_error_count: int
    last_error_message: Optional[str] = None
    created_at: datetime
    updated_at: datetime

# Minimal feed info for nesting in Article
class FeedBasicInfo(BaseModel):
    id: UUID
    title: Optional[str]
    url: HttpUrl
    image_url: Optional[HttpUrl]

    class Config:
        from_attributes = True

# ========= Article Schemas =========
class ArticleContentBase(BaseModel):
    title: Optional[str] = None
    link: HttpUrl
    description: Optional[str] = None
    content: Optional[str] = None
    image_url: Optional[HttpUrl] = None
    author: Optional[str] = Field(None, max_length=500)
    published_at: Optional[datetime] = None
    estimated_read_time_minutes: Optional[int] = Field(None, ge=0)
    custom_metadata: Optional[Dict[str, Any]] = None

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
    is_read: Optional[bool] = None
    is_read_later: Optional[bool] = None
    is_favorite: Optional[bool] = None

class FeedArticleResponse(FeedArticleBase):
    model_config = ConfigDict(from_attributes=True)
    
    id: UUID
    feed_id: UUID
    content_id: UUID
    user_id: UUID
    read_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    
    # Include the content
    content: ArticleContentResponse

# ClippedArticle schemas (manually saved web articles)
class ClippedArticleBase(BaseModel):
    priority: str = Field("medium", pattern="^(low|medium|high)$")
    note: Optional[str] = None
    is_read: bool = False
    is_favorite: bool = False

class ClippedArticleCreate(ClippedArticleBase):
    user_id: UUID
    content_id: UUID

class ClippedArticleUpdate(BaseModel):
    priority: Optional[str] = Field(None, pattern="^(low|medium|high)$")
    note: Optional[str] = None
    is_read: Optional[bool] = None
    is_favorite: Optional[bool] = None

class ClippedArticleResponse(ClippedArticleBase):
    model_config = ConfigDict(from_attributes=True)
    
    id: UUID
    content_id: UUID
    user_id: UUID
    read_at: Optional[datetime] = None
    created_at: datetime
    
    # Include the content
    content: ArticleContentResponse

# Unified Article schemas (for backward compatibility and API responses)
class ArticleBase(BaseModel):
    """Unified article schema that can represent both feed and clipped articles"""
    # Core content (from ArticleContent)
    title: Optional[str] = None
    link: HttpUrl
    description: Optional[str] = None
    content: Optional[str] = None
    image_url: Optional[HttpUrl] = None
    author: Optional[str] = Field(None, max_length=500)
    published_at: Optional[datetime] = None
    estimated_read_time_minutes: Optional[int] = Field(None, ge=0)
    
    # User interaction state
    is_read: bool = False
    is_read_later: bool = False
    is_favorite: bool = False
    read_at: Optional[datetime] = None
    
    # Clipped article specific (only present for clipped articles)
    priority: Optional[str] = None
    note: Optional[str] = None
    
    # Feed specific (only present for feed articles)
    feed_id: Optional[UUID] = None
    guid: Optional[str] = None
    folder_id: Optional[UUID] = None  # From feed's folder for feed articles

class ArticleCreate(BaseModel):
    """For backward compatibility with RSS system"""
    feed_id: UUID
    user_id: UUID
    guid: str
    title: Optional[str] = None
    link: HttpUrl
    description: Optional[str] = None
    content: Optional[str] = None
    author: Optional[str] = None
    image_url: Optional[HttpUrl] = None
    published_at: Optional[datetime] = None
    estimated_read_time_minutes: Optional[int] = None
    custom_metadata: Optional[Dict[str, Any]] = None
    is_read: bool = False
    is_read_later: bool = False
    is_favorite: bool = False

class ArticleUpdate(BaseModel):
    is_read: Optional[bool] = None
    is_read_later: Optional[bool] = None
    is_favorite: Optional[bool] = None

class ArticleResponse(ArticleBase):
    model_config = ConfigDict(from_attributes=True)
    
    id: UUID
    created_at: datetime
    updated_at: datetime
    
    # Additional metadata for API consumers
    article_type: str  # "feed" or "clipped"
    feed: Optional[Dict[str, Any]] = None  # Nested feed info for both RSS and clipped articles

# Legacy schemas (kept for backward compatibility)
Article = FeedArticleResponse

class ArticleBulkUpdateRequest(BaseModel):
    article_ids: List[UUID] = Field(..., min_length=1)
    action: str = Field(..., pattern=r"^(mark_read|mark_unread|toggle_favorite|mark_read_later|remove_read_later)$")

# ========= OPML Schemas =========
class OpmlImportRequest(BaseModel):
    opml_content: str # The raw OPML XML content as a string

class OpmlOutline(BaseModel):
    text: Optional[str] = None
    title: Optional[str] = None
    type: Optional[str] = None
    xmlUrl: Optional[HttpUrl] = None
    htmlUrl: Optional[HttpUrl] = None
    # For nested outlines/folders
    children: Optional[List['OpmlOutline']] = None


class OpmlExport(BaseModel):
    opml_content: str

# For parsing OPML structure
OpmlOutline.model_rebuild()


# Response for feed with its articles (example)
class FeedWithArticlesResponse(FeedResponse):
    articles: List[ArticleResponse] = [] 