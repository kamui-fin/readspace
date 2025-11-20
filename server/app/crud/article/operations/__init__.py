"""Basic CRUD operations for article models using repository pattern."""

from .clipped_articles import CRUDClippedArticle, clipped_articles
from .content import CRUDArticleContent, article_content
from .feed_articles import CRUDFeedArticle, feed_articles
from .user_state import CRUDUserArticleState, user_article_state

__all__ = [
    "CRUDArticleContent",
    "article_content",
    "CRUDFeedArticle",
    "feed_articles",
    "CRUDClippedArticle",
    "clipped_articles",
    "CRUDUserArticleState",
    "user_article_state",
]
