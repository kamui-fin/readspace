"""Service for managing global feeds.

This service handles global feed operations without user context.
It is primarily used by background workers for feed refreshing and article creation.

IMPORTANT: Use this service for:
- Background worker tasks (Celery)
- Global feed refresh operations
- Feed operations that don't require user context

For user-specific operations (subscriptions, user preferences), use FeedManagementService instead.
"""

import random
from datetime import datetime, timezone
from uuid import UUID

import structlog
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.redis_cache import get_redis_cache
from app.crud import crud_feed
from app.crud.article.article_crud_operations import ArticleCrudOperations
from app.models import Feed
from app.schemas import ArticleCreate, FeedBase
from app.schemas.subscriptions import FeedResponse
from app.services.feeds.adaptive_feed_scheduler import calculate_optimal_interval
from app.services.feeds.feed_fetcher import FeedFetcher
from app.services.feeds.feed_parser import FeedParsingService
from app.utils.content_hash import calculate_feed_content_hash

logger = structlog.get_logger(__name__)


class FeedService:
    """Service for managing global feeds (feeds_new table).

    This service operates on the global feeds table and does NOT have user context.
    It's designed for background workers and scheduled tasks.

    Responsibilities:
    - Creating and updating global feed records
    - Fetching and parsing feed content
    - Creating articles from feed entries
    - Managing feed refresh scheduling
    - Content deduplication via hashing

    Usage:
        # For background workers
        feed_service = FeedService(db)
        await feed_service.refresh_feed(feed_id=feed_id)

    See Also:
        FeedManagementService: For user-specific feed operations (subscriptions)
        FeedCreationService: For creating new feeds with initial setup
    """

    def __init__(
        self,
        db: AsyncSession,
        feed_fetcher: FeedFetcher | None = None,
        feed_parser: FeedParsingService | None = None,
    ):
        self.db = db
        self._cache = get_redis_cache()
        # Allow dependency injection for testing
        self.feed_fetcher = feed_fetcher or FeedFetcher(self._cache)
        self.feed_parser = feed_parser or FeedParsingService()

    async def get_or_create_feed(self, *, feed_data: FeedBase) -> Feed:
        """Get existing global feed or create a new one."""
        logger.info("Getting or creating global feed", url=str(feed_data.url))

        return await crud_feed.create_feed(self.db, feed_data=feed_data)

    async def get_feed_by_id(self, *, feed_id: UUID) -> Feed | None:
        """Get a global feed by ID."""
        return await crud_feed.get_feed_by_id(self.db, feed_id=feed_id)

    async def get_feed_by_url(self, *, url: str) -> Feed | None:
        """Get a global feed by URL."""
        return await crud_feed.get_feed_by_url(self.db, url=url)

    async def refresh_feed(self, *, feed_id: UUID, force_refetch: bool = False) -> FeedResponse | None:
        """Refresh a global feed by fetching latest content."""
        logger.info("Refreshing global feed", feed_id=feed_id, force_refetch=force_refetch)

        feed_db = await crud_feed.get_feed_by_id(self.db, feed_id=feed_id)
        if not feed_db:
            logger.warning("Feed not found for refresh", feed_id=feed_id)
            return None

        try:
            # Determine cache headers
            etag = feed_db.etag_header if not force_refetch else None
            last_modified = feed_db.last_modified_header if not force_refetch else None

            # Fetch feed content
            fetch_result = await self.feed_fetcher.fetch_content(
                str(feed_db.url), etag=etag, last_modified=last_modified
            )

            if fetch_result.status_code == 304:  # Not Modified
                # Skip database write entirely for 304 responses to reduce DB load
                # The feed will be checked again based on its refresh interval
                logger.debug(
                    "Feed not modified (304), skipping refresh without DB update",
                    feed_id=feed_id,
                )
                return FeedResponse.model_validate(feed_db)

            if fetch_result.status_code != 200 or not fetch_result.content:
                error_msg = f"Failed to fetch content: status {fetch_result.status_code}"
                logger.error("Feed fetch failed", feed_id=feed_id, error=error_msg)
                return None

            # Parse the feed content
            parsed_feed = self.feed_parser.parse_feed_data(fetch_result.content, str(feed_db.url))

            # Check content hash to skip processing if unchanged
            new_hash = calculate_feed_content_hash(parsed_feed.entries)

            if not force_refetch and feed_db.content_hash == new_hash and new_hash:
                # Content unchanged - skip expensive article processing
                await crud_feed.update_feed_metadata(
                    self.db, feed_db=feed_db, last_fetched_at=datetime.now(timezone.utc)
                )
                logger.info(
                    "Feed content unchanged, skipped article processing",
                    feed_id=feed_id,
                    content_hash=new_hash[:8],  # Log first 8 chars for debugging
                )
                return FeedResponse.model_validate(feed_db)

            # Update feed metadata
            feed_headers = fetch_result.headers
            last_article_published_at = None

            if parsed_feed.entries:
                # Find the latest article publication date
                latest_published = None
                for entry in parsed_feed.entries:
                    article_dict = self.feed_parser.extract_article_data(entry, str(feed_db.url))
                    if article_dict and article_dict.get("published_at"):
                        entry_published = article_dict["published_at"]
                        if not latest_published or entry_published > latest_published:
                            latest_published = entry_published

                last_article_published_at = latest_published

            # Periodically recalculate optimal interval BEFORE creating articles
            # This avoids transaction conflicts from multiple commits
            should_recalculate = feed_db.adaptive_fetch_interval_minutes is None or random.random() < 0.1  # noqa: S311
            adaptive_interval_to_set = None

            if should_recalculate:
                # Calculate before any commits to avoid db session conflicts
                adaptive_interval_to_set = await calculate_optimal_interval(self.db, feed_db)
                logger.info(
                    "Calculated adaptive interval",
                    feed_id=feed_id,
                    new_interval=adaptive_interval_to_set,
                )

            # Update feed metadata including new content hash and adaptive interval (if calculated)
            # This ensures only ONE commit for all feed metadata
            updated_feed = await crud_feed.update_feed_metadata(
                self.db,
                feed_db=feed_db,
                title=parsed_feed.feed.title if hasattr(parsed_feed.feed, "title") else None,
                description=parsed_feed.feed.description if hasattr(parsed_feed.feed, "description") else None,
                link=parsed_feed.feed.link if hasattr(parsed_feed.feed, "link") else None,
                language=parsed_feed.feed.language if hasattr(parsed_feed.feed, "language") else None,
                image_url=getattr(parsed_feed.feed, "image", {}).get("href")
                if hasattr(parsed_feed.feed, "image")
                else None,
                etag=feed_headers.get("etag"),
                last_modified=feed_headers.get("last-modified"),
                last_fetched_at=datetime.now(timezone.utc),
                last_article_published_at=last_article_published_at,
                content_hash=new_hash,  # Store new hash
                adaptive_fetch_interval_minutes=adaptive_interval_to_set,  # Set if calculated
            )

            # Create new articles (this will be handled by article service)
            if parsed_feed.entries:
                await self._create_new_articles(feed_db, parsed_feed.entries)

            logger.info("Feed refreshed successfully", feed_id=feed_id)
            return FeedResponse.model_validate(updated_feed)

        except Exception as e:
            error_msg = f"Error refreshing feed: {str(e)}"
            logger.error("Error refreshing feed", feed_id=feed_id, error=error_msg)

            # Update error count
            await crud_feed.update_feed_error(self.db, feed_db=feed_db, error_message=error_msg)
            raise

    async def _create_new_articles(self, feed_db: Feed, entries: list) -> int:
        """Create new articles from feed entries using centralized bulk insert logic.

        This method now delegates to ArticleCrudOperations.create_articles_batch for:
        - True bulk INSERT operations (single query for all articles)
        - Efficient handling of duplicate links via ON CONFLICT DO UPDATE
        - Consistent article creation logic across refresh and initial creation flows

        The unique constraint on article_contents.link ensures dedupe at DB level.
        """
        if not entries:
            return 0

        # Step 1: Convert feed entries to ArticleCreate schemas
        articles_to_create: list[ArticleCreate] = []

        for entry in entries:
            try:
                # Extract article data using feed parser
                article_dict = self.feed_parser.extract_article_data(entry, str(feed_db.url))
                if not article_dict:
                    continue

                # Create ArticleCreate schema (includes GUID generation logic)
                article_schema = ArticleCreate(
                    feed_id=feed_db.id,
                    guid=article_dict["guid"],
                    title=article_dict.get("title"),
                    link=article_dict["link"],
                    content=article_dict.get("content"),
                    author=article_dict.get("author"),
                    published_at=article_dict.get("published_at"),
                    image_url=article_dict.get("image_url"),
                    estimated_read_time_minutes=article_dict.get("estimated_read_time_minutes"),
                )
                articles_to_create.append(article_schema)

            except Exception as e:
                logger.warning(
                    "Error processing article entry",
                    feed_id=str(feed_db.id),
                    error=str(e),
                )
                continue

        if not articles_to_create:
            return 0

        # Step 2: Use centralized bulk insert logic
        try:
            created_articles = await ArticleCrudOperations.create_articles_batch(
                self.db, articles_data=articles_to_create
            )

            created_count = len(created_articles)

            if created_count > 0:
                logger.info(
                    "Bulk created new articles",
                    created_count=created_count,
                    total_entries=len(entries),
                    feed_id=str(feed_db.id),
                )
            else:
                logger.debug(
                    "No new articles to create (all were duplicates)",
                    feed_id=str(feed_db.id),
                )

            return created_count

        except Exception as e:
            # Transaction auto-rolls back on exception
            logger.error("Error in bulk article creation", feed_id=str(feed_db.id), error=str(e), exc_info=True)
            raise

    async def get_feeds_needing_refresh(self, *, limit: int = 100) -> list[Feed]:
        """Get global feeds that need refreshing."""
        return await crud_feed.get_feeds_needing_refresh(self.db, limit=limit)
