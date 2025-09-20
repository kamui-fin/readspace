# This file ensures that all models are registered with SQLAlchemy's Base metadata

# Import the Base from the central location
from app.db.base_class import Base  # noqa: F401

from .rss_models import (
    ArticleContent,  # noqa: F401
    ClippedArticle,  # noqa: F401
    Feed,  # noqa: F401
    FeedArticle,  # noqa: F401
    FeedSubscription,  # noqa: F401
    Folder,  # noqa: F401
    UserArticleState,  # noqa: F401
)
from .user_models import AuthUser, Profile  # noqa: F401
