"""RSS Feed Search Service for discovery functionality."""

from typing import Any

import structlog
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.models.rss_models import Feed, FeedCategory
from app.services.ai_service import get_ai_service

logger = structlog.get_logger(__name__)


class RssSearchService:
    """Service for searching and discovering RSS feeds using hybrid search."""

    def __init__(self, db: AsyncSession):
        self.db = db
        self.settings = get_settings()
        self.ai_service = get_ai_service()

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

    async def search_feeds(
        self,
        query: str | None = None,
        category: str | None = None,
        language: str = "en",
        limit: int = 20
    ) -> list[dict[str, Any]]:
        """
        Search for RSS feeds using hybrid search or category browsing.
        
        Args:
            query: Search query text (optional)
            category: Feed category to filter by (optional)
            language: Language code for filtering (defaults to 'en')
            limit: Maximum number of results (max 20)
        
        Returns:
            List of feed results with relevance scores
        """
        # Ensure limit doesn't exceed 20
        limit = min(limit, 20)

        if query:
            return await self._hybrid_search(query, language, limit, category)
        elif category:
            return await self._category_search(category, language, limit)
        else:
            # Return popular feeds across all categories
            return await self._popular_feeds(language, limit)

    async def _hybrid_search(
        self,
        query: str,
        language: str,
        limit: int,
        category: str | None = None
    ) -> list[dict[str, Any]]:
        """
        Perform hybrid search combining BM25 text search and vector similarity.
        Based on the working search_engine_demo.py implementation.
        """
        try:
            logger.debug("Starting hybrid search", query=query, language=language, limit=limit, category=category)

            # Generate embedding for the query using AI service
            embedding = await self.ai_service.generate_embedding(query)
            if embedding is None:
                logger.warning("Failed to generate embedding, falling back to text-only search")
                return await self._simple_search(query, language, limit, category)

            # Convert embedding to string format for PostgreSQL vector type
            embedding_str = f"[{','.join(map(str, embedding))}]"

            # Build parameters dictionary and category filter string
            params = {
                "query": query,
                "language": language,
                "embedding": embedding_str,
                "limit": limit
            }
            category_filter = ""

            if category:
                try:
                    category_enum = FeedCategory(category)
                    # Add the category parameter and update the filter string
                    params["category"] = category_enum.value
                    category_filter = "AND f.top_level_category = :category"
                except ValueError:
                    logger.warning(f"Invalid category provided: {category}")

            # SQL query using named parameters and the standard CAST() function
            sql_query = f"""
                WITH q AS (
                    SELECT websearch_to_tsquery('english', :query) AS query,
                           LOWER(:query) AS query_lower
                ),
                -- Full-text search results with ranks
                fts_results AS (
                    SELECT 
                        f.id,
                        ts_rank_cd(f.tsv_title_link, (SELECT query FROM q)) AS title_score,
                        ts_rank_cd(f.tsv_desc_tags, (SELECT query FROM q)) AS desc_score,
                        ROW_NUMBER() OVER (ORDER BY 
                            (0.7 * ts_rank_cd(f.tsv_title_link, (SELECT query FROM q)) + 
                             0.3 * ts_rank_cd(f.tsv_desc_tags, (SELECT query FROM q))) DESC
                        ) AS fts_rank
                    FROM feeds f
                    WHERE (f.tsv_title_link @@ (SELECT query FROM q) 
                           OR f.tsv_desc_tags @@ (SELECT query FROM q))
                      AND (f.language = :language OR f.language IS NULL)
                      {category_filter}
                    ORDER BY 
                        (0.7 * ts_rank_cd(f.tsv_title_link, (SELECT query FROM q)) + 
                         0.3 * ts_rank_cd(f.tsv_desc_tags, (SELECT query FROM q))) DESC
                    LIMIT 200
                ),
                -- Vector search results with ranks
                vector_results AS (
                    SELECT 
                        f.id,
                        CASE 
                            WHEN f.embedding IS NOT NULL THEN 1 - (f.embedding <=> CAST(:embedding AS vector))
                            ELSE 0.0
                        END AS vector_score,
                        ROW_NUMBER() OVER (ORDER BY 
                            CASE 
                                WHEN f.embedding IS NOT NULL THEN f.embedding <=> CAST(:embedding AS vector)
                                ELSE 1.0
                            END
                        ) AS vector_rank
                    FROM feeds f
                    WHERE (f.language = :language OR f.language IS NULL)
                      {category_filter}
                    ORDER BY 
                        CASE 
                            WHEN f.embedding IS NOT NULL THEN f.embedding <=> CAST(:embedding AS vector)
                            ELSE 1.0
                        END
                    LIMIT 200
                ),
                -- Combined results with enhanced title/domain priority scoring
                combined_scores AS (
                    SELECT 
                        COALESCE(fts.id, vec.id) AS id,
                        COALESCE(fts.title_score, 0.0) AS title_score,
                        COALESCE(fts.desc_score, 0.0) AS desc_score,
                        COALESCE(vec.vector_score, 0.0) AS vector_score,
                        COALESCE(fts.fts_rank, 999999) AS fts_rank,
                        COALESCE(vec.vector_rank, 999999) AS vector_rank,
                        CASE 
                            WHEN fts.id IS NOT NULL AND vec.id IS NOT NULL THEN 'both'
                            WHEN fts.id IS NOT NULL THEN 'fts'
                            ELSE 'vector'
                        END AS sources
                    FROM fts_results fts
                    FULL OUTER JOIN vector_results vec ON fts.id = vec.id
                )
                SELECT 
                    f.id, f.title, f.description, f.url, f.link, f.image_url,
                    f.tags, f.language, f.top_level_category, f.popularity_score,
                    cs.title_score AS bm25_title_score,
                    cs.desc_score AS bm25_desc_score,
                    cs.vector_score AS vector_similarity,
                    cs.fts_rank,
                    cs.vector_rank,
                    cs.sources,
                    -- Enhanced scoring: heavily weight title matches
                    (
                        -- Title/description match detection and massive boost
                        CASE 
                            WHEN LOWER(f.title || ' ' || COALESCE(f.description, '')) LIKE '%' || (SELECT query_lower FROM q) || '%'
                            THEN 4.0 * (cs.title_score + cs.desc_score)
                            ELSE 1.0 * (cs.title_score + cs.desc_score)
                        END +
                        -- Standard vector similarity weight
                        1.0 * cs.vector_score +
                        -- Quality and popularity factors
                        0.1 * (COALESCE(f.popularity_score, 0.0) / 100.0)
                    ) AS enhanced_score
                FROM combined_scores cs
                JOIN feeds f ON f.id = cs.id
                ORDER BY enhanced_score DESC
                LIMIT :limit
            """
            logger.debug("Executing hybrid search query", params=list(params.keys()))

            # Use text() with proper parameter binding for asyncpg
            result = await self.db.execute(text(sql_query), params)
            rows = result.fetchall()
            logger.debug("Hybrid search query completed", row_count=len(rows))

            # Convert to dictionaries with relevance scores
            feeds = []
            max_score = max((row.enhanced_score for row in rows), default=1.0)

            for row in rows:
                # Normalize relevance score to 0-1 range
                relevance = min(row.enhanced_score / max_score, 1.0) if max_score > 0 else 0.0

                feed_data = {
                    "id": str(row.id),
                    "title": row.title,
                    "description": row.description,
                    "url": str(row.url),
                    "link": self._normalize_url(row.link),
                    "image_url": self._normalize_url(row.image_url),
                    "tags": row.tags or [],
                    "language": row.language,
                    "category": row.top_level_category if row.top_level_category else None,
                    "popularity_score": row.popularity_score or 0.0,
                    "relevance": round(relevance, 3),
                    "search_metadata": {
                        "bm25_title_score": float(row.bm25_title_score or 0),
                        "bm25_desc_score": float(row.bm25_desc_score or 0),
                        "vector_similarity": float(row.vector_similarity or 0),
                        "sources": row.sources,
                        "enhanced_score": float(row.enhanced_score)
                    }
                }
                feeds.append(feed_data)

            logger.info("Hybrid search completed", query=query, results_count=len(feeds))
            return feeds

        except Exception as e:
            logger.error("Error in hybrid search", query=query, error=str(e), exc_info=True)
            # Fallback to simple text search
            return await self._simple_search(query, language, limit, category)

    async def _simple_search(
        self,
        query: str,
        language: str,
        limit: int,
        category: str | None = None
    ) -> list[dict[str, Any]]:
        """Fallback simple text search when hybrid search fails."""
        try:
            # Build base query
            stmt = select(Feed).where(
                (Feed.language == language) | (Feed.language.is_(None))
            )

            # Add text search
            if query:
                search_term = f"%{query.lower()}%"
                stmt = stmt.where(
                    (func.lower(Feed.title).contains(search_term)) |
                    (func.lower(Feed.description).contains(search_term))
                )

            # Add category filter
            if category:
                try:
                    category_enum = FeedCategory(category)
                    stmt = stmt.where(Feed.top_level_category == category_enum)
                except ValueError:
                    pass  # Ignore invalid category

            # Order by popularity and limit
            stmt = stmt.order_by(Feed.popularity_score.desc().nulls_last()).limit(limit)

            result = await self.db.execute(stmt)
            feeds_db = result.scalars().all()

            # Convert to response format
            feeds = []
            for feed in feeds_db:
                feed_data = {
                    "id": str(feed.id),
                    "title": feed.title,
                    "description": feed.description,
                    "url": str(feed.url),
                    "link": self._normalize_url(feed.link),
                    "image_url": self._normalize_url(feed.image_url),
                    "tags": feed.tags or [],
                    "language": feed.language,
                    "category": feed.top_level_category.value if feed.top_level_category else None,
                    "popularity_score": feed.popularity_score or 0.0,
                    "relevance": 0.5,  # Default relevance for simple search
                    "search_metadata": {
                        "search_type": "simple_fallback"
                    }
                }
                feeds.append(feed_data)

            return feeds

        except Exception as e:
            logger.error("Error in simple search", query=query, error=str(e))
            return []

    async def _category_search(
        self,
        category: str,
        language: str,
        limit: int
    ) -> list[dict[str, Any]]:
        """Get top feeds for a specific category."""
        try:
            # Validate category
            try:
                category_enum = FeedCategory(category)
            except ValueError:
                logger.warning(f"Invalid category: {category}")
                return []

            # Build query for category
            stmt = select(Feed).where(
                (Feed.top_level_category == category_enum) &
                ((Feed.language == language) | (Feed.language.is_(None)))
            ).order_by(
                Feed.popularity_score.desc().nulls_last()
            ).limit(limit)

            result = await self.db.execute(stmt)
            feeds_db = result.scalars().all()

            # Convert to response format
            feeds = []
            for i, feed in enumerate(feeds_db):
                # Assign relevance based on popularity rank
                relevance = max(0.1, 1.0 - (i / limit)) if limit > 0 else 0.5

                feed_data = {
                    "id": str(feed.id),
                    "title": feed.title,
                    "description": feed.description,
                    "url": str(feed.url),
                    "link": self._normalize_url(feed.link),
                    "image_url": self._normalize_url(feed.image_url),
                    "tags": feed.tags or [],
                    "language": feed.language,
                    "category": feed.top_level_category.value,
                    "popularity_score": feed.popularity_score or 0.0,
                    "relevance": round(relevance, 3),
                    "search_metadata": {
                        "search_type": "category",
                        "rank": i + 1
                    }
                }
                feeds.append(feed_data)

            return feeds

        except Exception as e:
            logger.error("Error in category search", category=category, error=str(e))
            return []

    async def _popular_feeds(self, language: str, limit: int) -> list[dict[str, Any]]:
        """Get popular feeds across all categories."""
        try:
            stmt = select(Feed).where(
                (Feed.language == language) | (Feed.language.is_(None))
            ).order_by(
                Feed.popularity_score.desc().nulls_last()
            ).limit(limit)

            result = await self.db.execute(stmt)
            feeds_db = result.scalars().all()

            feeds = []
            for i, feed in enumerate(feeds_db):
                relevance = max(0.1, 1.0 - (i / limit)) if limit > 0 else 0.5

                feed_data = {
                    "id": str(feed.id),
                    "title": feed.title,
                    "description": feed.description,
                    "url": str(feed.url),
                    "link": self._normalize_url(feed.link),
                    "image_url": self._normalize_url(feed.image_url),
                    "tags": feed.tags or [],
                    "language": feed.language,
                    "category": feed.top_level_category.value if feed.top_level_category else None,
                    "popularity_score": feed.popularity_score or 0.0,
                    "relevance": round(relevance, 3),
                    "search_metadata": {
                        "search_type": "popular",
                        "rank": i + 1
                    }
                }
                feeds.append(feed_data)

            return feeds

        except Exception as e:
            logger.error("Error getting popular feeds", error=str(e))
            return []

    async def get_categories_with_counts(self, language: str = "en") -> list[dict[str, Any]]:
        """Get all categories with feed counts for the category grid."""
        try:
            # Query categories with counts
            stmt = text("""
                SELECT 
                    top_level_category,
                    COUNT(*) as feed_count,
                    AVG(popularity_score) as avg_popularity
                FROM feeds 
                WHERE top_level_category IS NOT NULL 
                  AND (language = :language OR language IS NULL)
                GROUP BY top_level_category
                ORDER BY 
                    CASE top_level_category
                        WHEN 'Technology & Programming' THEN 1
                        WHEN 'Artificial Intelligence' THEN 2
                        WHEN 'Design & Creativity' THEN 3
                        WHEN 'Business & Finance' THEN 4
                        WHEN 'News & Politics' THEN 5
                        WHEN 'Gaming & Entertainment' THEN 6
                        WHEN 'Science & Research' THEN 7
                        WHEN 'Lifestyle & Personal' THEN 8
                        WHEN 'Culture & Arts' THEN 9
                        WHEN 'Security & Privacy' THEN 10
                        WHEN 'Education & Learning' THEN 11
                        WHEN 'Miscellaneous' THEN 12
                        ELSE 99
                    END,
                    COUNT(*) DESC
            """)

            result = await self.db.execute(stmt, {"language": language})
            rows = result.fetchall()

            # Create a map of existing categories with their data
            existing_categories = {}
            for row in rows:
                existing_categories[row.top_level_category] = {
                    "name": row.top_level_category,
                    "display_name": row.top_level_category,
                    "feed_count": row.feed_count,
                    "avg_popularity": float(row.avg_popularity or 0.0)
                }

            # Ensure all categories are included, even with 0 feeds
            ordered_categories = [
                FeedCategory.TECHNOLOGY_PROGRAMMING,
                FeedCategory.ARTIFICIAL_INTELLIGENCE,
                FeedCategory.DESIGN_CREATIVITY,
                FeedCategory.BUSINESS_FINANCE,
                FeedCategory.NEWS_POLITICS,
                FeedCategory.GAMING_ENTERTAINMENT,
                FeedCategory.SCIENCE_RESEARCH,
                FeedCategory.LIFESTYLE_PERSONAL,
                FeedCategory.CULTURE_ARTS,
                FeedCategory.SECURITY_PRIVACY,
                FeedCategory.EDUCATION_LEARNING,
                FeedCategory.MISCELLANEOUS,
            ]

            categories = []
            for cat in ordered_categories:
                if cat.value in existing_categories:
                    categories.append(existing_categories[cat.value])
                else:
                    categories.append({
                        "name": cat.value,
                        "display_name": cat.value,
                        "feed_count": 0,
                        "avg_popularity": 0.0
                    })

            return categories

        except Exception as e:
            logger.error("Error getting categories", error=str(e))
            # Return default categories if query fails in a logical order
            ordered_categories = [
                FeedCategory.TECHNOLOGY_PROGRAMMING,
                FeedCategory.ARTIFICIAL_INTELLIGENCE,
                FeedCategory.DESIGN_CREATIVITY,
                FeedCategory.BUSINESS_FINANCE,
                FeedCategory.NEWS_POLITICS,
                FeedCategory.GAMING_ENTERTAINMENT,
                FeedCategory.SCIENCE_RESEARCH,
                FeedCategory.LIFESTYLE_PERSONAL,
                FeedCategory.CULTURE_ARTS,
                FeedCategory.SECURITY_PRIVACY,
                FeedCategory.EDUCATION_LEARNING,
                FeedCategory.MISCELLANEOUS,
            ]
            return [
                {"name": cat.value, "display_name": cat.value, "feed_count": 0, "avg_popularity": 0.0}
                for cat in ordered_categories
            ]
