"""Model module initialization with centralized exports."""

from app.db.base_class import Base  # noqa: F401
from app.models.article import ArticleContent, ClippedArticle, FeedArticle, UserArticleState
from app.models.enums import ArticlePriority, FeedCategory, UserRole
from app.models.feed import Feed, FeedSubscription
from app.models.folder import Folder
from app.models.user import AuthUser, Profile

__all__ = [
    "Base",
    # Enums
    "FeedCategory",
    "UserRole",
    "ArticlePriority",
    # Feed models
    "Feed",
    "FeedSubscription",
    # Article models
    "ArticleContent",
    "FeedArticle",
    "UserArticleState",
    "ClippedArticle",
    # Folder models
    "Folder",
    # User models
    "AuthUser",
    "Profile",
]
