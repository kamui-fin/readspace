"""Base service class for RSS feed operations."""

from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.redis_cache import RedisCache
from app.services.article_extractor import ArticleExtractor
from app.services.article_service import ArticleBusinessLogic
from app.services.feed_fetcher import FeedFetcher
from app.services.feed_parser import FeedParsingService
from app.services.feed_validator import FeedValidator


class BaseFeedService:
    """Base service class providing common dependencies for feed operations."""

    def __init__(self, db: AsyncSession, user_id: UUID):
        self.db = db
        self.user_id = user_id

        # Initialize service dependencies
        redis_cache = RedisCache()
        self.feed_fetcher = FeedFetcher(redis_cache)
        self.feed_validator = FeedValidator()
        self.article_extractor = ArticleExtractor()
        self.feed_parser = FeedParsingService()
        self.article_logic = ArticleBusinessLogic()
