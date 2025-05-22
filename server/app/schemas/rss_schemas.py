from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import UUID

from pydantic import BaseModel, Field, HttpUrl


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

class FolderInDBBase(FolderBase):
    id: UUID
    user_id: UUID
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True # Replaces orm_mode = True

class FolderResponse(FolderInDBBase):
    pass

# ========= Tag Schemas =========
class TagBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)

class TagCreate(TagBase):
    pass

class TagUpdate(TagBase):
    name: Optional[str] = Field(None, min_length=1, max_length=100)

class TagInDBBase(TagBase):
    id: UUID
    user_id: UUID
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class TagResponse(TagInDBBase):
    pass

# ========= Feed Schemas =========
class FeedBase(BaseModel):
    url: HttpUrl
    title: Optional[str] = Field(None, max_length=500)
    description: Optional[str] = None
    link: Optional[HttpUrl] = None
    language: Optional[str] = Field(None, max_length=50)
    image_url: Optional[HttpUrl] = None
    is_favorite: bool = False
    last_article_published_at: Optional[datetime] = None

class FeedCreate(BaseModel):
    url: HttpUrl
    folder_id: UUID
    tag_ids: Optional[List[UUID]] = []

class FeedUpdate(BaseModel):
    folder_id: Optional[UUID] = None
    tag_ids: Optional[List[UUID]] = None # To set/replace tags
    is_favorite: Optional[bool] = None
    title: Optional[str] = Field(None, max_length=500) # Allow user to override title

class FeedInDBBase(FeedBase):
    id: UUID
    user_id: UUID
    folder_id: UUID
    
    ttl: Optional[int] = None
    skip_hours: Optional[List[int]] = None
    skip_days: Optional[List[str]] = None
    
    last_fetched_at: Optional[datetime] = None
    last_modified_header: Optional[str] = Field(None, max_length=255)
    etag_header: Optional[str] = Field(None, max_length=255)
    last_article_published_at: Optional[datetime] = None
    
    fetch_error_count: int = 0
    last_error_message: Optional[str] = None

    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class FeedResponse(FeedInDBBase):
    folder: FolderResponse
    tags: List[TagResponse] = []

# Minimal feed info for nesting in Article
class FeedBasicInfo(BaseModel):
    id: UUID
    title: Optional[str]
    url: HttpUrl
    image_url: Optional[HttpUrl]

    class Config:
        from_attributes = True

# ========= Article Schemas =========
class ArticleBase(BaseModel):
    guid: str = Field(..., max_length=1024)
    title: Optional[str] = None
    link: HttpUrl
    description: Optional[str] = None # Summary
    content: Optional[str] = None     # Full content
    image_url: Optional[HttpUrl] = None
    published_at: Optional[datetime] = None
    estimated_read_time_minutes: Optional[int] = None
    
    is_read: bool = False
    is_read_later: bool = False
    is_favorite: bool = False # Article-level favorite

# This schema is mostly for internal use when creating articles from feed parsing
class ArticleCreate(ArticleBase):
    feed_id: UUID
    user_id: UUID # Denormalized from Feed for easier querying/ownership

class ArticleUpdate(BaseModel): # User can only update these fields
    is_read: Optional[bool] = None
    read_at: Optional[datetime] = None # Set when is_read becomes true
    is_read_later: Optional[bool] = None
    is_favorite: Optional[bool] = None

class ArticleInDBBase(ArticleBase):
    id: UUID
    feed_id: UUID
    user_id: UUID # Denormalized
    
    read_at: Optional[datetime] = None
    custom_metadata: Optional[Dict[str, Any]] = None
    
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class ArticleResponse(ArticleInDBBase):
    feed: Optional[FeedBasicInfo] = None # Include basic feed info

# Schema for bulk updating articles
class ArticleBulkUpdateRequest(BaseModel):
    article_ids: List[UUID]
    action: str # e.g., "mark_as_read", "mark_as_unread", "toggle_read_later", "toggle_favorite"
    # No status field needed if action is descriptive enough like "mark_as_read" vs "mark_as_unread"

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