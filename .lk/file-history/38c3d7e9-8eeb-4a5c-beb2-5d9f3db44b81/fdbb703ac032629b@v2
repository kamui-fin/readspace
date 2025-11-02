"""Schema module initialization with centralized exports."""

from app.schemas.articles import (
    ArticleBase,
    ArticleContentBase,
    ArticleContentCreate,
    ArticleContentResponse,
    ArticleCreate,
    ArticleResponse,
    ArticleUpdate,
    ClippedArticleBase,
    ClippedArticleCreate,
    ClippedArticleResponse,
    ClippedArticleUpdate,
    FeedArticleBase,
    FeedArticleCreate,
    FeedArticleResponse,
    FeedArticleUpdate,
    SaveArticleRequest,
)
from app.schemas.auth import LoginRequest, LoginResponse, SignupRequest
from app.schemas.common import PaginatedResponse
from app.schemas.discovery import (
    CategoryInfo,
    DiscoverCategoriesResponse,
    DiscoverSearchRequest,
    DiscoverSearchResponse,
    FeedDiscoveryResult,
    RecommendationsRequest,
)
from app.schemas.feeds import (
    FeedBase,
    FeedBasicInfo,
    FeedCreate,
    FeedEnrichmentResponse,
    FeedResponse,
    FeedUpdate,
    FeedWithArticlesResponse,
)
from app.schemas.folders import FolderBase, FolderCreate, FolderResponse, FolderUpdate
from app.schemas.opml import (
    OpmlExport,
    OpmlExportResponse,
    OpmlImportCancelResponse,
    OpmlImportProgress,
    OpmlImportRequest,
    OpmlImportResponse,
    OpmlImportResult,
    OpmlImportStatusResponse,
    OpmlOutline,
    OpmlTaskMetadata,
)
from app.schemas.subscription_schemas import (
    SubscriptionBulkActionRequest,
    SubscriptionCreate,
    SubscriptionResponse,
    SubscriptionUpdate,
    UnreadCountResponse,
    UnreadCountsResponse,
)
from app.schemas.user_schemas import ProfileResponse, UserArticleStateUpdate

__all__ = [
    # Common
    "PaginatedResponse",
    # Auth
    "LoginRequest",
    "LoginResponse",
    "SignupRequest",
    # Folders
    "FolderBase",
    "FolderCreate",
    "FolderUpdate",
    "FolderResponse",
    # Feeds
    "FeedBase",
    "FeedCreate",
    "FeedUpdate",
    "FeedResponse",
    "FeedBasicInfo",
    "FeedWithArticlesResponse",
    "FeedEnrichmentResponse",
    # Articles
    "ArticleContentBase",
    "ArticleContentCreate",
    "ArticleContentResponse",
    "FeedArticleBase",
    "FeedArticleCreate",
    "FeedArticleUpdate",
    "FeedArticleResponse",
    "ClippedArticleBase",
    "ClippedArticleCreate",
    "ClippedArticleUpdate",
    "ClippedArticleResponse",
    "ArticleBase",
    "ArticleCreate",
    "ArticleUpdate",
    "ArticleResponse",
    "SaveArticleRequest",
    # OPML
    "OpmlImportRequest",
    "OpmlOutline",
    "OpmlExport",
    "OpmlImportResponse",
    "OpmlTaskMetadata",
    "OpmlImportProgress",
    "OpmlImportResult",
    "OpmlImportStatusResponse",
    "OpmlImportCancelResponse",
    "OpmlExportResponse",
    # Discovery
    "DiscoverSearchRequest",
    "RecommendationsRequest",
    "FeedDiscoveryResult",
    "DiscoverSearchResponse",
    "CategoryInfo",
    "DiscoverCategoriesResponse",
    # Subscriptions
    "SubscriptionCreate",
    "SubscriptionUpdate",
    "SubscriptionResponse",
    "SubscriptionBulkActionRequest",
    "UnreadCountResponse",
    "UnreadCountsResponse",
    # Users
    "ProfileResponse",
    "UserArticleStateUpdate",
]
