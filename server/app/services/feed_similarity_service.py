"""Feed Similarity Service for finding similar RSS feeds using vector embeddings."""

from uuid import UUID

import structlog
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.rss_models import Feed, FeedSubscription
from app.schemas.rss_schemas import FeedDiscoveryResult
from app.utils.rsshub_url_transformer import transform_rsshub_url

logger = structlog.get_logger(__name__)


class FeedSimilarityService:
    """Service for finding similar RSS feeds using vector similarity."""

    def __init__(self, db: AsyncSession, user_id: UUID):
        self.db = db
        self.user_id = user_id

    def _normalize_url(self, url_str: str | None) -> str | None:
        """Normalize URL to ensure it's a valid HTTP/HTTPS URL for Pydantic."""
        if not url_str:
            return None
        url_str = str(url_str).strip()

        # If it's already a valid web URL, return it
        if url_str.startswith(('http://', 'https://')):
            return url_str

        # If it contains any other scheme (like data:, ftp:, etc.), it's invalid.
        if ':' in url_str:
            return None

        # Otherwise, assume it's a web URL missing the protocol and add it.
        return f"https://{url_str}"

    async def get_similar_feeds(
        self,
        feed_id: UUID,
        limit: int = 10,
        min_similarity: float = 0.1
    ) -> list[FeedDiscoveryResult]:
        """
        Find similar feeds based on vector embeddings.
        
        Args:
            feed_id: The UUID of the source feed
            limit: Maximum number of similar feeds to return (default: 10)
            min_similarity: Minimum similarity score threshold (default: 0.1)
            
        Returns:
            List of similar feeds with similarity scores
        """
        try:
            logger.info(
                "Finding similar feeds",
                feed_id=feed_id,
                user_id=self.user_id,
                limit=limit,
                min_similarity=min_similarity
            )

            # First, get the source feed and verify user has access
            source_feed = await self._get_user_feed(feed_id)
            if not source_feed:
                logger.warning("Source feed not found or user has no access", feed_id=feed_id, user_id=self.user_id)
                return []

            # Check if source feed has an embedding
            if source_feed.embedding is None:
                logger.warning("Source feed has no embedding", feed_id=feed_id)
                return []

            # Get user's subscribed feed IDs to exclude them from results
            subscribed_feed_ids = await self._get_user_subscribed_feed_ids()

            # Build the similarity search query
            params = {
                "source_feed_id": feed_id,
                "limit": limit,
                "min_similarity": min_similarity
            }

            # Build exclusion filter for subscribed feeds
            exclusion_filter = ""
            if subscribed_feed_ids:
                # Create placeholders for subscribed feed IDs
                placeholders = [f":subscribed_feed_{i}" for i in range(len(subscribed_feed_ids))]
                exclusion_filter = f"AND f.id NOT IN ({', '.join(placeholders)})"

                # Add subscribed feed IDs to params
                for i, feed_id_to_exclude in enumerate(subscribed_feed_ids):
                    params[f"subscribed_feed_{i}"] = feed_id_to_exclude

            sql_query = f"""
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
                FROM feeds f, source_feed sf
                WHERE f.id != :source_feed_id  -- Exclude the source feed itself
                  AND f.embedding IS NOT NULL  -- Only consider feeds with embeddings
                  AND (1 - (f.embedding <=> sf.embedding)) >= :min_similarity  -- Similarity threshold
                  {exclusion_filter}  -- Exclude user's subscribed feeds
                ORDER BY f.embedding <=> sf.embedding  -- Order by cosine distance (ascending = most similar first)
                LIMIT :limit
            """

            logger.debug("Executing similarity search query", params=list(params.keys()))

            result = await self.db.execute(text(sql_query), params)
            rows = result.fetchall()

            logger.debug("Similarity search completed", row_count=len(rows))

            # Convert results to FeedDiscoveryResult format
            similar_feeds = []
            for row in rows:
                feed_data = FeedDiscoveryResult(
                    id=str(row.id),
                    title=row.title,
                    description=row.description,
                    url=transform_rsshub_url(str(row.url)),
                    link=self._normalize_url(row.link),
                    image_url=self._normalize_url(row.image_url),
                    tags=row.tags or [],
                    language=row.language,
                    category=row.top_level_category if row.top_level_category else None,
                    popularity_score=row.popularity_score or 0.0,
                    relevance=round(float(row.similarity_score), 3),  # Use similarity as relevance
                    search_metadata={
                        "search_type": "similarity",
                        "similarity_score": float(row.similarity_score),
                        "source_feed_id": str(feed_id)
                    }
                )
                similar_feeds.append(feed_data)

            logger.info(
                "Similar feeds found",
                source_feed_id=feed_id,
                user_id=self.user_id,
                results_count=len(similar_feeds),
                avg_similarity=sum(f.relevance for f in similar_feeds) / len(similar_feeds) if similar_feeds else 0
            )

            return similar_feeds

        except Exception as e:
            logger.error(
                "Error finding similar feeds",
                feed_id=feed_id,
                user_id=self.user_id,
                error=str(e),
                exc_info=True
            )
            return []

    async def _get_user_feed(self, feed_id: UUID) -> Feed | None:
        """Get a feed by ID (doesn't require user subscription)."""
        try:
            stmt = select(Feed).where(Feed.id == feed_id)
            result = await self.db.execute(stmt)
            return result.scalar_one_or_none()
        except Exception as e:
            logger.error("Error getting feed", feed_id=feed_id, user_id=self.user_id, error=str(e))
            return None

    async def _get_user_subscribed_feed_ids(self) -> list[UUID]:
        """Get list of feed IDs that the user is already subscribed to."""
        try:
            stmt = select(FeedSubscription.feed_id).where(FeedSubscription.user_id == self.user_id)
            result = await self.db.execute(stmt)
            return [row[0] for row in result.fetchall()]
        except Exception as e:
            logger.error("Error getting user subscribed feeds", user_id=self.user_id, error=str(e))
            return []

