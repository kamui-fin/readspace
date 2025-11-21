# Import crud modules from subdirectories
# Import feed as a namespace module
from app.crud import feed

from . import folder as crud_folder
from . import subscription as crud_subscription
from .article.operations.clipped_articles import clipped_articles as crud_clipped_article
from .article.operations.content import article_content as crud_article_content
from .article.operations.feed_articles import feed_articles as crud_feed_article
from .profile import create_profile, create_profile_if_not_exists, get_profile_by_id

# Re-export subscription functions for convenience
from .subscription import *  # noqa: F403

__all__ = [
    "crud_article_content",
    "crud_feed_article",
    "crud_clipped_article",
    "feed",
    "crud_folder",
    "get_profile_by_id",
    "create_profile",
    "create_profile_if_not_exists",
    "crud_subscription",
]
