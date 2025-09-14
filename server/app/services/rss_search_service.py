"""RSS Feed Search Service for discovery functionality."""

import re
from typing import Any

import structlog
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.models.rss_models import Feed, FeedCategory
from app.services.ai_service import get_ai_service
from app.utils.rsshub_url_transformer import transform_rsshub_url

logger = structlog.get_logger(__name__)


class RssSearchService:
    """Service for searching and discovering RSS feeds using hybrid search."""

    def __init__(self, db: AsyncSession):
        self.db = db
        self.settings = get_settings()
        self.ai_service = get_ai_service() if self.settings.ENABLE_AI else None

    def _normalize_url(self, url_str: str | None) -> str | None:
        """Normalize URL for API responses, preserving original schemes like rsshub://"""
        if not url_str:
            return None
        url_str = str(url_str).strip()

        # Keep rsshub:// URLs as-is for display purposes
        if url_str.startswith('rsshub://'):
            return url_str

        # If it's already a valid web URL, validate it
        if url_str.startswith(('http://', 'https://')):
            try:
                from urllib.parse import urlparse
                parsed = urlparse(url_str)
                # Basic validation - must have a valid netloc (domain)
                if not parsed.netloc or ' ' in parsed.netloc:
                    return None
                return url_str
            except Exception:
                return None

        # If it contains any other scheme (like data:, ftp:, etc.), it's invalid.
        if ':' in url_str:
            return None

        # Otherwise, assume it's a web URL missing the protocol and add it.
        return f"https://{url_str}"

    def _is_valid_url(self, query: str) -> bool:
        """Check if query looks like a valid URL."""
        if not query or not isinstance(query, str):
            return False

        query = query.strip()

        # Check for RSS feed URLs (http/https)
        url_pattern = re.compile(
            r'^https?://'  # http:// or https://
            r'(?:(?:[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?\.)+[A-Z]{2,6}\.?|'  # domain...
            r'localhost|'  # localhost...
            r'\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})'  # ...or ip
            r'(?::\d+)?'  # optional port
            r'(?:/?|[/?]\S+)$', re.IGNORECASE)

        return bool(url_pattern.match(query))

    def _is_website_url(self, query: str) -> bool:
        """Check if query looks like a website URL (not necessarily RSS feed)."""
        if not query or not isinstance(query, str):
            return False

        query = query.strip()

        # Broader pattern that includes websites without http://
        website_pattern = re.compile(
            r'^(?:https?://)?'  # Optional http:// or https://
            r'(?:(?:[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?\.)+[A-Z]{2,6}\.?|'  # domain...
            r'localhost|'  # localhost...
            r'\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})'  # ...or ip
            r'(?::\d+)?'  # optional port
            r'(?:/?|[/?]\S+)?$', re.IGNORECASE)

        return bool(website_pattern.match(query))

    def _is_rsshub_url(self, query: str) -> bool:
        """Check if query is an rsshub:// URL."""
        if not query or not isinstance(query, str):
            return False
        return query.strip().lower().startswith('rsshub://')

    def _detect_subreddit(self, query: str) -> str | None:
        """Detect if query is a subreddit pattern and return the RSS URL."""
        if not query or not isinstance(query, str):
            return None

        query = query.strip()

        # Patterns: r/cats, /r/cats, r/cats/
        subreddit_patterns = [
            r'^r/([a-zA-Z0-9_]+)/?$',      # r/cats
            r'^/r/([a-zA-Z0-9_]+)/?$',     # /r/cats
        ]

        for pattern in subreddit_patterns:
            match = re.match(pattern, query)
            if match:
                subreddit_name = match.group(1)
                reddit_rss_url = f"https://www.reddit.com/r/{subreddit_name}/.rss"
                logger.debug("Subreddit detected",
                           query=query,
                           subreddit=subreddit_name,
                           rss_url=reddit_rss_url)
                return reddit_rss_url

        return None

    def _generate_url_variations(self, url: str) -> list[str]:
        """Generate URL variations for comprehensive matching."""
        if not url or not isinstance(url, str):
            return []

        url = url.strip()
        variations = [url]  # Always include original

        # Handle rsshub:// URLs - keep as-is
        if url.startswith('rsshub://'):
            return variations

        # For HTTP(S) URLs, generate variations
        if url.startswith(('http://', 'https://')):
            # Add version without protocol
            no_protocol = url.replace('https://', '').replace('http://', '')
            variations.append(no_protocol)

            # Add with/without trailing slash
            if url.endswith('/'):
                variations.append(url.rstrip('/'))
            else:
                variations.append(url + '/')

            # Add www variations if not present
            if '://www.' not in url:
                if url.startswith('https://'):
                    variations.append(url.replace('https://', 'https://www.'))
                elif url.startswith('http://'):
                    variations.append(url.replace('http://', 'http://www.'))
        else:
            # For URLs without protocol
            variations.extend([
                f'https://{url}',
                f'http://{url}',
                f'https://www.{url}',
                f'http://www.{url}'
            ])

            # Add with/without trailing slash
            if url.endswith('/'):
                no_slash = url.rstrip('/')
                variations.extend([
                    no_slash,
                    f'https://{no_slash}',
                    f'http://{no_slash}',
                    f'https://www.{no_slash}',
                    f'http://www.{no_slash}'
                ])
            else:
                with_slash = url + '/'
                variations.extend([
                    with_slash,
                    f'https://{with_slash}',
                    f'http://{with_slash}',
                    f'https://www.{with_slash}',
                    f'http://www.{with_slash}'
                ])

        # Remove duplicates while preserving order
        unique_variations = []
        seen = set()
        for variation in variations:
            if variation not in seen:
                unique_variations.append(variation)
                seen.add(variation)

        return unique_variations

    async def _search_exact_url_matches(
        self,
        query_url: str,
        language: str,
        limit: int,
        category: str | None = None
    ) -> list[dict[str, Any]]:
        """Search for feeds with exact URL matches in both url and link fields."""
        try:
            logger.debug("Starting exact URL search", url=query_url, language=language, limit=limit)

            # Generate URL variations for comprehensive matching
            url_variations = self._generate_url_variations(query_url)

            if not url_variations:
                return []

            # Build base query
            stmt = select(Feed).where(
                (Feed.language == language) | (Feed.language.is_(None))
            )

            # Add category filter if specified
            if category:
                try:
                    category_enum = FeedCategory(category)
                    stmt = stmt.where(Feed.top_level_category == category_enum)
                except ValueError:
                    pass  # Ignore invalid category

            # Search for exact matches in both url and link fields
            url_conditions = []
            for variation in url_variations:
                url_conditions.extend([
                    Feed.url == variation,
                    Feed.link == variation
                ])

            if url_conditions:
                from sqlalchemy import or_
                stmt = stmt.where(or_(*url_conditions))

            # Order by popularity and limit
            stmt = stmt.order_by(Feed.popularity_score.desc().nulls_last()).limit(limit)

            result = await self.db.execute(stmt)
            feeds_db = result.scalars().all()

            # Convert to response format with maximum relevance
            feeds = []
            for i, feed in enumerate(feeds_db):
                # Use RSS URL as fallback if link is malformed
                normalized_link = self._normalize_url(feed.link)
                feed_data = {
                    "id": str(feed.id),
                    "title": feed.title,
                    "description": feed.description,
                    "url": str(feed.url),
                    "link": normalized_link if normalized_link else str(feed.url),
                    "image_url": self._normalize_url(feed.image_url),
                    "tags": feed.tags or [],
                    "language": feed.language,
                    "category": feed.top_level_category.value if feed.top_level_category else None,
                    "popularity_score": feed.popularity_score or 0.0,
                    "relevance": 1.0,  # Maximum relevance for exact matches
                    "search_metadata": {
                        "search_type": "exact_url_match",
                        "matched_url": query_url,
                        "matched_field": "url" if str(feed.url) in url_variations else "link",
                        "rank": i + 1
                    }
                }
                feeds.append(feed_data)

            logger.info("Exact URL search completed",
                       url=query_url,
                       variations_count=len(url_variations),
                       results_count=len(feeds))
            return feeds

        except Exception as e:
            logger.error("Error in exact URL search", url=query_url, error=str(e))
            return []

    async def _search_by_website_url(
        self,
        url: str,
        language: str,
        limit: int,
        category: str | None = None
    ) -> list[dict[str, Any]]:
        """Search for feeds matching a website URL in both url and link fields."""
        try:
            # Normalize the URL for searching
            search_url = url if url.startswith(('http://', 'https://')) else f"https://{url}"

            # Build base query to search both URL and link fields
            stmt = select(Feed).where(
                (Feed.language == language) | (Feed.language.is_(None))
            )

            # Add category filter if specified
            if category:
                try:
                    category_enum = FeedCategory(category)
                    stmt = stmt.where(Feed.top_level_category == category_enum)
                except ValueError:
                    pass  # Ignore invalid category

            # Search for feeds where the URL or link contains the domain
            from urllib.parse import urlparse
            try:
                parsed_url = urlparse(search_url)
                domain = parsed_url.netloc.lower()
                if domain.startswith('www.'):
                    domain = domain[4:]

                # Search for feeds where the URL or link field contains this domain
                stmt = stmt.where(
                    (func.lower(Feed.url).contains(domain)) |
                    (func.lower(Feed.link).contains(domain))
                )

            except Exception:
                # Fallback to simple URL matching if parsing fails
                stmt = stmt.where(
                    (func.lower(Feed.url).contains(search_url.lower())) |
                    (func.lower(Feed.link).contains(search_url.lower()))
                )

            # Order by popularity and limit
            stmt = stmt.order_by(Feed.popularity_score.desc().nulls_last()).limit(limit)

            result = await self.db.execute(stmt)
            feeds_db = result.scalars().all()

            # Convert to response format
            feeds = []
            for i, feed in enumerate(feeds_db):
                # Use RSS URL as fallback if link is malformed
                normalized_link = self._normalize_url(feed.link)
                feed_data = {
                    "id": str(feed.id),
                    "title": feed.title,
                    "description": feed.description,
                    "url": str(feed.url),  # Keep original URL
                    "link": normalized_link if normalized_link else str(feed.url),
                    "image_url": self._normalize_url(feed.image_url),
                    "tags": feed.tags or [],
                    "language": feed.language,
                    "category": feed.top_level_category.value if feed.top_level_category else None,
                    "popularity_score": feed.popularity_score or 0.0,
                    "relevance": max(0.1, 1.0 - (i / limit)) if limit > 0 else 0.5,
                    "search_metadata": {
                        "search_type": "website_url",
                        "matched_url": search_url,
                        "rank": i + 1
                    }
                }
                feeds.append(feed_data)

            logger.info("Website URL search completed",
                       url=search_url,
                       results_count=len(feeds))
            return feeds

        except Exception as e:
            logger.error("Error in website URL search", url=url, error=str(e))
            return []

    async def search_feeds(
        self,
        query: str | None = None,
        category: str | None = None,
        language: str = "en",
        limit: int = 40
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
        # Ensure limit doesn't exceed 100
        limit = min(limit, 100)

        # Check for subreddit patterns first
        if query:
            subreddit_url = self._detect_subreddit(query)
            if subreddit_url:
                preview_result = await self._preview_url_as_feed(subreddit_url)
                if preview_result:
                    # Return subreddit RSS preview
                    return [preview_result]

            # Check for rsshub:// URLs and preview them directly
            if self._is_rsshub_url(query):
                preview_result = await self._preview_url_as_feed(query)
                if preview_result:
                    logger.info("Successfully previewed rsshub URL", url=query)
                    return [preview_result]
                else:
                    logger.warning("Failed to preview rsshub URL", url=query)
                    return []

        # Enhanced URL handling: Check for exact matches first, then preview if needed
        if query and (self._is_valid_url(query) or self._is_website_url(query)):
            results = []

            # Step 1: Try exact URL matches first (fast database query)
            exact_matches = await self._search_exact_url_matches(query, language, limit, category)
            if exact_matches:
                logger.info("Found exact URL matches", count=len(exact_matches))
                results.extend(exact_matches)

                # If we have exact matches, fill remaining slots with regular search
                remaining_limit = limit - len(exact_matches)
                if remaining_limit > 0:
                    # Get IDs of exact matches to exclude from regular search
                    exact_match_ids = {result["id"] for result in exact_matches}

                    # Get additional results using regular search methods
                    if self.settings.ENABLE_AI and self.ai_service:
                        additional_results = await self._hybrid_search(query, language, remaining_limit, category)
                    else:
                        additional_results = await self._simple_search(query, language, remaining_limit, category)

                    # Filter out duplicates and add to results
                    for result in additional_results:
                        if result["id"] not in exact_match_ids:
                            results.append(result)
                            if len(results) >= limit:
                                break

                return results[:limit]

            # Step 2: No exact matches found, try preview (original behavior)
            if self._is_valid_url(query):
                preview_result = await self._preview_url_as_feed(query)
                if preview_result:
                    # Return preview result first, then regular search results if there's space
                    results = [preview_result]
                    remaining_limit = limit - 1

                    if remaining_limit > 0:
                        # Get regular search results too (but not for the same URL)
                        if self.settings.ENABLE_AI and self.ai_service:
                            regular_results = await self._hybrid_search(query, language, remaining_limit, category)
                        else:
                            regular_results = await self._simple_search(query, language, remaining_limit, category)
                        results.extend(regular_results)

                    return results[:limit]

            # Step 3: Fall back to website domain search (for website URLs)
            if self._is_website_url(query):
                website_results = await self._search_by_website_url(query, language, limit, category)
                if website_results:
                    return website_results

        # Regular text search (non-URL queries)
        if query:
            # Use hybrid search if AI is enabled, otherwise use simple search
            if self.settings.ENABLE_AI and self.ai_service:
                return await self._hybrid_search(query, language, limit, category)
            else:
                logger.info("AI disabled, using FTS-only search", query=query)
                return await self._simple_search(query, language, limit, category)
        elif category:
            return await self._category_search(category, language, limit)
        else:
            # Return popular feeds across all categories
            return await self._popular_feeds(language, limit)

    async def _preview_url_as_feed(self, url: str) -> dict[str, Any] | None:
        """
        Try to fetch and preview a URL as an RSS feed.

        Args:
            url: URL to preview as feed (can be rsshub:// URL)

        Returns:
            Feed preview data if successful, None if not a valid feed
        """
        try:
            logger.debug("Attempting to preview URL as feed", url=url)

            # Transform rsshub:// URLs to actual HTTP URLs for fetching
            fetch_url = transform_rsshub_url(url)
            if fetch_url != url:
                logger.debug("Transformed rsshub URL", original=url, transformed=fetch_url)

            # Import here to avoid circular imports
            from uuid import uuid4

            from app.services.feed_creation_service import FeedCreationService

            # Create a temporary service instance for preview with a dummy user_id
            temp_service = FeedCreationService(self.db, user_id=uuid4())

            # Try to fetch and parse the URL using the transformed URL
            fetch_result = await temp_service._fetch_feed_content(fetch_url)
            if fetch_result["status"] != 200 or not fetch_result["content"]:
                logger.debug("Failed to fetch URL or empty content", url=fetch_url, status=fetch_result.get("status"))
                return None

            # Parse the content using the transformed URL
            parsed_feed = temp_service._parse_feed_data(fetch_result["content"], fetch_url)

            # Extract feed metadata using the transformed URL
            metadata = temp_service._extract_feed_metadata(parsed_feed, fetch_url)

            # Determine image URL - use Reddit favicon for Reddit RSS feeds
            image_url = metadata.image_url
            if "reddit.com" in fetch_url:
                image_url = "https://www.redditstatic.com/shreddit/assets/favicon/76x76.png"

            # Create preview result - use original URL for display purposes
            # but show the transformed URL internally for verification
            normalized_link = self._normalize_url(str(metadata.link) if metadata.link else None)
            preview_data = {
                "id": f"preview_{hash(url)}",  # Temporary ID for preview using original URL
                "title": metadata.title,
                "description": metadata.description,
                "url": url,  # Keep original rsshub:// URL for display
                "link": normalized_link if normalized_link else url,  # Use original for link too
                "image_url": self._normalize_url(str(image_url) if image_url else None),
                "tags": [],  # No tags for preview
                "language": metadata.language,
                "category": None,  # No category for preview
                "popularity_score": 0.0,  # No popularity score for preview
                "relevance": 1.0,  # Max relevance for preview
                "search_metadata": {
                    "search_type": "rsshub_preview" if url != fetch_url else "url_preview",
                    "fetched_at": fetch_result.get("headers", {}).get("date"),
                    "content_type": fetch_result.get("headers", {}).get("content-type"),
                    "transformed_url": fetch_url if url != fetch_url else None
                },
                "is_preview": True,
                "preview_url": url  # Original URL for preview
            }

            logger.info("Successfully created feed preview", url=url, title=metadata.title)
            return preview_data

        except Exception as e:
            logger.debug("Failed to preview URL as feed", url=url, error=str(e))
            return None

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

            # Ensure AI is enabled for hybrid search
            if not self.settings.ENABLE_AI or not self.ai_service:
                logger.warning("AI disabled but hybrid search called, falling back to simple search")
                return await self._simple_search(query, language, limit, category)

            # Generate embedding for the query using Gemini
            embedding = await self.ai_service.generate_embedding_with_gemini(query)
            if embedding is None:
                logger.warning("Failed to generate embedding with Gemini, falling back to text-only search")
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

                # Use RSS URL as fallback if link is malformed
                normalized_link = self._normalize_url(row.link)
                normalized_url = self._normalize_url(str(row.url))
                feed_data = {
                    "id": str(row.id),
                    "title": row.title,
                    "description": row.description,
                    "url": normalized_url if normalized_url else str(row.url),
                    "link": normalized_link if normalized_link else str(row.url),
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
                # Use RSS URL as fallback if link is malformed
                normalized_link = self._normalize_url(feed.link)
                normalized_url = self._normalize_url(str(feed.url))
                feed_data = {
                    "id": str(feed.id),
                    "title": feed.title,
                    "description": feed.description,
                    "url": normalized_url if normalized_url else str(feed.url),
                    "link": normalized_link if normalized_link else str(feed.url),
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

                # Use RSS URL as fallback if link is malformed
                normalized_link = self._normalize_url(feed.link)
                normalized_url = self._normalize_url(str(feed.url))
                feed_data = {
                    "id": str(feed.id),
                    "title": feed.title,
                    "description": feed.description,
                    "url": normalized_url if normalized_url else str(feed.url),
                    "link": normalized_link if normalized_link else str(feed.url),
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

                # Use RSS URL as fallback if link is malformed
                normalized_link = self._normalize_url(feed.link)
                normalized_url = self._normalize_url(str(feed.url))
                feed_data = {
                    "id": str(feed.id),
                    "title": feed.title,
                    "description": feed.description,
                    "url": normalized_url if normalized_url else str(feed.url),
                    "link": normalized_link if normalized_link else str(feed.url),
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
