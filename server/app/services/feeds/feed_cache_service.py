"""Service layer for feed operations with caching and search syncing.

This service handles business logic that was previously mixed into CRUD:
- Redis caching for feed URL lookups
- Meilisearch syncing
- URL normalization and variation handling
"""

from uuid import UUID

import structlog
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings
from app.core.redis_cache import get_redis_cache
from app.crud.feed.core import create_feed, get_feed_by_id, get_feed_by_url, update_feed
from app.crud.feed.url_handling import normalize_feed_url
from app.models.feed import Feed
from app.schemas.feeds import FeedBase
from app.services.feeds.search.meilisearch import get_meilisearch_service
from app.utils.url.url_normalizer import get_protocol_variation

logger = structlog.get_logger(__name__)

# Cache TTL for feed URL lookups (1 hour)
FEED_URL_CACHE_TTL = 3600


class FeedCacheService:
    """Service for feed operations with caching and search integration."""

    def __init__(self, db: AsyncSession, settings: Settings | None = None):
        self.db = db
        self.settings = settings or Settings()
        self.redis_cache = get_redis_cache()

    async def get_feed_by_url(self, url: str) -> Feed | None:
        """Get a feed by URL with Redis caching and protocol variation handling.
        
        Handles:
        - URL normalization
        - Redis caching
        - Protocol variations (http vs https)
        """
        normalized_url = normalize_feed_url(url)
        cache_key = f"feed_url:{normalized_url}"

        # Try cache first
        cached_feed_id = await self.redis_cache.get(cache_key)
        if cached_feed_id:
            logger.debug("Feed URL lookup cache hit", normalized_url=normalized_url, feed_id=cached_feed_id)
            return await get_feed_by_id(self.db, feed_id=UUID(cached_feed_id))

        # Cache miss - query database
        logger.debug("Feed URL lookup cache miss", normalized_url=normalized_url)
        feed = await get_feed_by_url(self.db, normalized_url=normalized_url)

        # Try protocol variation if not found
        if not feed:
            alt_url = get_protocol_variation(normalized_url)
            if alt_url:
                feed = await get_feed_by_url(self.db, normalized_url=alt_url)
                if feed:
                    # Cache using the requested URL for future lookups
                    await self.redis_cache.set(cache_key, str(feed.id), FEED_URL_CACHE_TTL)
                    logger.debug("Found feed via protocol variation", 
                                requested_url=normalized_url, 
                                found_url=alt_url,
                                feed_id=feed.id)

        # Cache the result
        if feed:
            await self.redis_cache.set(cache_key, str(feed.id), FEED_URL_CACHE_TTL)
            logger.debug("Cached feed URL mapping", normalized_url=normalized_url, feed_id=feed.id)

        return feed

    async def get_or_create_feed(self, url: str, feed_data: FeedBase | None = None) -> Feed:
        """Get existing feed or create new one with caching and search syncing.
        
        Handles:
        - URL normalization
        - Existence checks
        - Meilisearch syncing
        - Cache invalidation
        """
        normalized_url = normalize_feed_url(url)
        
        # Check if feed exists
        existing_feed = await self.get_feed_by_url(normalized_url)
        if existing_feed:
            return existing_feed

        # Create new feed
        if not feed_data:
            raise ValueError("Feed data required to create new feed")

        # Ensure URL is normalized in feed data
        feed_dict = feed_data.model_dump(exclude_unset=True)
        feed_dict["url"] = normalized_url
        feed_base = FeedBase(**feed_dict)

        new_feed = await create_feed(self.db, feed_data=feed_base)

        # Sync to Meilisearch (fire-and-forget)
        await self._sync_to_meilisearch(new_feed, operation="add")

        return new_feed

    async def update_feed_url(self, feed: Feed, new_url: str) -> Feed:
        """Update feed URL with cache invalidation and search syncing.
        
        Used for handling feed migrations (redirects).
        """
        old_url = feed.url
        normalized_new_url = normalize_feed_url(new_url)
        
        feed.url = normalized_new_url
        updated_feed = await update_feed(self.db, feed=feed)

        # Invalidate old cache and set new cache
        old_cache_key = f"feed_url:{normalize_feed_url(old_url)}"
        new_cache_key = f"feed_url:{normalized_new_url}"
        await self.redis_cache.delete(old_cache_key)
        await self.redis_cache.set(new_cache_key, str(updated_feed.id), FEED_URL_CACHE_TTL)

        # Sync to Meilisearch
        await self._sync_to_meilisearch(updated_feed, operation="update")

        logger.info("Feed URL updated", 
                   feed_id=updated_feed.id,
                   old_url=old_url, 
                   new_url=normalized_new_url)

        return updated_feed

    async def invalidate_cache(self, url: str) -> None:
        """Invalidate cache for a feed URL."""
        normalized_url = normalize_feed_url(url)
        cache_key = f"feed_url:{normalized_url}"
        await self.redis_cache.delete(cache_key)
        logger.debug("Invalidated feed URL cache", normalized_url=normalized_url)

    async def _sync_to_meilisearch(self, feed: Feed, operation: str = "add") -> None:
        """Sync feed to Meilisearch (fire-and-forget).
        
        Args:
            feed: Feed to sync
            operation: "add" or "update"
        """
        try:
            meili_service = get_meilisearch_service(self.settings)
            if operation == "add":
                await meili_service.add_feed(feed)
            else:
                await meili_service.update_feed(feed)
        except Exception as e:
            logger.warning(f"meilisearch_sync_failed_{operation}", 
                          feed_id=feed.id, 
                          error=str(e))
            # Don't raise - Meilisearch sync failures shouldn't break the main flow
