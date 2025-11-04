# ruff: noqa: S608
"""Feed Similarity Service for finding similar RSS feeds using vector embeddings."""

from uuid import UUID

import structlog
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import SIMILARITY_SEARCH_CACHE_TTL
from app.core.redis_cache import get_redis_cache
from app.models import Feed, FeedSubscription
from app.schemas import FeedDiscoveryResult

logger = structlog.get_logger(__name__)


class FeedSimilarityService:
    """Service for finding similar RSS feeds using vector similarity."""

    def __init__(self, db: AsyncSession, user_id: UUID):
        self.db = db
        self.user_id = user_id

    def _normalize_url(self, url_str: str | None) -> str | None:
        """Normalize URL for API responses, preserving original schemes like rsshub://"""
        from app.utils.url_normalizer import normalize_url_for_display

        return normalize_url_for_display(url_str)

    async def get_similar_feeds(
        self, feed_id: UUID, limit: int = 10, min_similarity: float = 0.1
    ) -> list[FeedDiscoveryResult]:
        """
        Find similar feeds based on vector embeddings with Redis caching.

        This method caches similarity search results for 1 hour to improve performance.
        Vector similarity searches are expensive (cosine distance calculations).

        Args:
            feed_id: The UUID of the source feed
            limit: Maximum number of similar feeds to return (default: 10)
            min_similarity: Minimum similarity score threshold (default: 0.1)

        Returns:
            List of similar feeds with similarity scores
        """
        # Generate cache key
        cache_key = f"similarity:feed:{feed_id}:user:{self.user_id}:limit:{limit}:min:{min_similarity}"

        # Check cache first
        cache = get_redis_cache()
        try:
            cached_results = await cache.get(cache_key)
            if cached_results is not None:
                logger.info(
                    "Similarity search cache hit",
                    feed_id=feed_id,
                    user_id=self.user_id,
                    results_count=len(cached_results),
                )
                # Convert cached dicts back to FeedDiscoveryResult objects
                return [FeedDiscoveryResult(**result) for result in cached_results]
        except Exception as e:
            logger.warning("Failed to get cached similarity results", feed_id=feed_id, error=str(e))

        try:
            logger.info(
                "Finding similar feeds (cache miss)",
                feed_id=feed_id,
                user_id=self.user_id,
                limit=limit,
                min_similarity=min_similarity,
            )

            # First, get the source feed
            source_feed = await self._get_user_feed(feed_id)
            if not source_feed:
                logger.warning(
                    "Source feed not found",
                    feed_id=feed_id,
                    user_id=self.user_id,
                )
                return []

            # Check if source feed has an embedding
            if source_feed.embedding is None:
                logger.warning("Source feed has no embedding", feed_id=feed_id)
                return []

            # OPTIMIZATION: Use CTE to get subscribed feeds in the same query
            # This eliminates the separate query for subscribed_feed_ids
            params = {
                "source_feed_id": feed_id,
                "limit": limit,
                "min_similarity": min_similarity,
            }

            sql_query = """
                WITH source_feed AS (
                    SELECT embedding
                    FROM feeds
                    WHERE id = :source_feed_id
                    AND embedding IS NOT NULL
                )
                SELECT
                    f.id,
                    f.title,
                    f.description,
                    f.url,
                    f.link,
                    f.image_url,
                    f.tags,
                    f.language,
                    f.top_level_category,
                    f.popularity_score,
                    -- Calculate similarity score (1 - cosine distance)
                    (1 - (f.embedding <=> (SELECT embedding FROM source_feed))) AS similarity_score
                FROM feeds f
                CROSS JOIN source_feed sf
                WHERE f.id != :source_feed_id  -- Exclude the source feed itself
                  AND f.embedding IS NOT NULL  -- Only consider feeds with embeddings
                  AND (1 - (f.embedding <=> sf.embedding)) >= :min_similarity  -- Similarity threshold
                ORDER BY f.embedding <=> sf.embedding  -- Order by cosine distance (ascending = most similar first)
                LIMIT :limit
            """

            logger.debug("Executing similarity search query with CTE", params=list(params.keys()))

            # Execute the raw SQL query and fetch results as tuples to avoid ORM mapping issues
            result = await self.db.execute(text(sql_query), params)
            rows = result.fetchall()

            logger.debug("Similarity search completed", row_count=len(rows))

            # Convert results to FeedDiscoveryResult format
            similar_feeds = []
            for row in rows:
                # Access row data by index to avoid potential ORM lazy loading issues
                feed_data = FeedDiscoveryResult(
                    id=str(row[0]),  # f.id
                    title=row[1],  # f.title
                    description=row[2],  # f.description
                    url=str(row[3]),  # f.url
                    link=self._normalize_url(row[4]),  # f.link
                    image_url=self._normalize_url(row[5]),  # f.image_url
                    tags=row[6] or [],  # f.tags
                    language=row[7],  # f.language
                    category=row[8] if row[8] else None,  # f.top_level_category
                    popularity_score=row[9] or 0.0,  # f.popularity_score
                    relevance=round(float(row[10]), 3),  # similarity_score
                    search_metadata={
                        "search_type": "similarity",
                        "similarity_score": float(row[10]),  # similarity_score
                        "source_feed_id": str(feed_id),
                    },
                )
                similar_feeds.append(feed_data)

            logger.info(
                "Similar feeds found",
                source_feed_id=feed_id,
                user_id=self.user_id,
                results_count=len(similar_feeds),
                avg_similarity=sum(f.relevance for f in similar_feeds) / len(similar_feeds) if similar_feeds else 0,
            )

            # Cache the results
            try:
                # Convert FeedDiscoveryResult objects to dicts for caching
                cache_data = [feed.model_dump(mode="json") for feed in similar_feeds]
                await cache.set(cache_key, cache_data, ttl_seconds=SIMILARITY_SEARCH_CACHE_TTL)
                logger.debug(
                    "Similarity results cached",
                    feed_id=feed_id,
                    results_count=len(similar_feeds),
                    ttl=SIMILARITY_SEARCH_CACHE_TTL,
                )
            except Exception as e:
                logger.warning("Failed to cache similarity results", feed_id=feed_id, error=str(e))

            return similar_feeds

        except Exception as e:
            logger.error(
                "Error finding similar feeds",
                feed_id=feed_id,
                user_id=self.user_id,
                error=str(e),
                exc_info=True,
            )
            return []

    async def _get_user_feed(self, feed_id: UUID) -> Feed | None:
        """Get a feed by ID (doesn't require user subscription)."""
        try:
            # Explicitly load the deferred embedding field using undefer
            from sqlalchemy.orm import undefer

            stmt = select(Feed).options(undefer(Feed.embedding)).where(Feed.id == feed_id)
            result = await self.db.execute(stmt)
            return result.scalar_one_or_none()
        except Exception as e:
            logger.error(
                "Error getting feed",
                feed_id=feed_id,
                user_id=self.user_id,
                error=str(e),
            )
            return None

    async def _get_user_subscribed_feed_ids(self) -> list[UUID]:
        """Get list of feed IDs that the user is already subscribed to."""
        try:
            stmt = select(FeedSubscription.feed_id).where(FeedSubscription.user_id == self.user_id)
            result = await self.db.execute(stmt)
            return [row[0] for row in result.fetchall()]
        except Exception as e:
            logger.error(
                "Error getting user subscribed feeds",
                user_id=self.user_id,
                error=str(e),
            )
            return []

    async def _is_user_subscribed_to_feed(self, feed_id: UUID) -> bool:
        """Check if the user is subscribed to a specific feed."""
        try:
            stmt = select(FeedSubscription).where(
                FeedSubscription.user_id == self.user_id, FeedSubscription.feed_id == feed_id
            )
            result = await self.db.execute(stmt)
            return result.scalar_one_or_none() is not None
        except Exception as e:
            logger.error(
                "Error checking feed subscription",
                feed_id=feed_id,
                user_id=self.user_id,
                error=str(e),
            )
            return False
