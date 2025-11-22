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
from typing import Any, Callable
from uuid import UUID

import structlog

from app.core.redis_cache import get_redis_cache
from app.crud import crud_feed
from app.crud.article import create_articles_batch
from app.models import Feed
from app.schemas import ArticleCreate, FeedBase
from app.schemas.subscriptions import FeedResponse
from app.services.feeds.fetcher import FeedFetcher
from app.services.feeds.parser import FeedParsingService
from app.services.feeds.scheduler import calculate_optimal_interval
from app.utils.content_hash import calculate_feed_content_hash

logger = structlog.get_logger(__name__)

# Type alias for session factory
SessionFactory = Callable[[], Any]  # Returns async context manager


class FeedService:
    """Service for managing global feeds (feeds_new table).

    This service operates on the global feeds table and does NOT have user context.
    All methods accept a session_factory parameter for consistent database access.

    Usage:
        # API mode
        from app.db.session import get_db_factory
        
        @router.post("/feeds/{feed_id}/refresh")
        async def refresh_feed(
            feed_id: UUID,
            db_factory = Depends(get_db_factory),
        ):
            service = FeedService()
            return await service.refresh_feed(db_factory, feed_id)
        
        # Worker mode
        from app.workers.common import worker_db_factory
        
        async def refresh_feed_task(feed_id: UUID):
            service = FeedService()
            return await service.refresh_feed(worker_db_factory, feed_id)
    """

    def __init__(
        self,
        feed_fetcher: FeedFetcher | None = None,
        feed_parser: FeedParsingService | None = None,
    ):
        self._cache = get_redis_cache()
        self.feed_fetcher = feed_fetcher or FeedFetcher(self._cache)
        self.feed_parser = feed_parser or FeedParsingService()

    async def get_or_create_feed(
        self, session_factory: SessionFactory, *, feed_data: FeedBase
    ) -> Feed:
        """Get existing global feed or create a new one."""
        logger.info("Getting or creating global feed", url=str(feed_data.url))

        async with session_factory() as db:
            return await crud_feed.create_feed(db, feed_data=feed_data)

    async def get_feed_by_id(
        self, session_factory: SessionFactory, *, feed_id: UUID
    ) -> Feed | None:
        """Get a global feed by ID."""
        async with session_factory() as db:
            return await crud_feed.get_feed_by_id(db, feed_id=feed_id)

    async def get_feed_by_url(
        self, session_factory: SessionFactory, *, url: str
    ) -> Feed | None:
        """Get a global feed by URL."""
        async with session_factory() as db:
            return await crud_feed.get_feed_by_url(db, url=url)

    async def refresh_feed(
        self,
        session_factory: SessionFactory,
        *,
        feed_id: UUID,
        force_refetch: bool = False,
    ) -> FeedResponse | None:
        """Refresh a global feed by fetching latest content.

        Uses three-phase pattern with session factory:
        Phase 1: Quick metadata fetch (DB connection held <10ms)
        Phase 2: Network I/O without holding DB connection (0-30s)
        Phase 3: Database write operations (connection held ~500ms)

        Args:
            session_factory: Factory function that creates database sessions
            feed_id: Feed UUID to refresh
            force_refetch: If True, ignore etag/last-modified headers
        """
        logger.info(
            "Refreshing global feed",
            feed_id=feed_id,
            force_refetch=force_refetch,
        )

        # ================================================================
        # PHASE 1: Quick metadata fetch (DB connection held <10ms)
        # ================================================================
        async with session_factory() as db:
            feed_db = await crud_feed.get_feed_by_id(db, feed_id=feed_id)
            if not feed_db:
                logger.warning("Feed not found for refresh", feed_id=feed_id)
                return None

            # Extract all data we need while we have the ORM object
            etag = feed_db.etag_header if not force_refetch else None
            last_modified = feed_db.last_modified_header if not force_refetch else None
            feed_url = str(feed_db.url)
            current_content_hash = feed_db.content_hash
        # Connection released - available for other tasks!

        # ================================================================
        # PHASE 2: Network I/O without holding DB connection (0-30s)
        # ================================================================
        try:
            fetch_result = await self.feed_fetcher.fetch_content(
                feed_url, etag=etag, last_modified=last_modified
            )
        except Exception as e:
            error_msg = f"Error fetching feed: {str(e)}"
            logger.error(
                "Error fetching feed", feed_id=feed_id, error=error_msg, exc_info=True
            )

            # Update error count
            async with session_factory() as db:
                feed_db = await crud_feed.get_feed_by_id(db, feed_id=feed_id)
                if feed_db:
                    await crud_feed.update_feed_error(
                        db, feed_db=feed_db, error_message=error_msg
                    )
            raise

        # Handle 304 Not Modified
        if fetch_result.status_code == 304:
            logger.debug(
                "Feed not modified (304), skipping refresh without DB update",
                feed_id=feed_id,
            )
            async with session_factory() as db:
                feed_db = await crud_feed.get_feed_by_id(db, feed_id=feed_id)
                return FeedResponse.model_validate(feed_db)

        # Handle fetch errors
        if fetch_result.status_code != 200 or not fetch_result.content:
            error_msg = f"Failed to fetch content: status {fetch_result.status_code}"
            logger.error("Feed fetch failed", feed_id=feed_id, error=error_msg)

            async with session_factory() as db:
                feed_db = await crud_feed.get_feed_by_id(db, feed_id=feed_id)
                await crud_feed.update_feed_error(
                    db, feed_db=feed_db, error_message=error_msg
                )
            return None

        # Parse the feed content (CPU-bound, no I/O)
        parsed_feed = self.feed_parser.parse_feed_data(fetch_result.content, feed_url)

        # Check content hash to detect if content actually changed
        new_hash = calculate_feed_content_hash(parsed_feed.entries)

        if not force_refetch and current_content_hash == new_hash and new_hash:
            # Content unchanged - skip expensive article processing
            async with session_factory() as db:
                feed_db = await crud_feed.get_feed_by_id(db, feed_id=feed_id)
                await crud_feed.update_feed_metadata(
                    db,
                    feed_db=feed_db,
                    last_fetched_at=datetime.now(timezone.utc),
                )
                logger.info(
                    "Feed content unchanged, skipped article processing",
                    feed_id=feed_id,
                    content_hash=new_hash[:8] if new_hash else None,
                )
                return FeedResponse.model_validate(feed_db)

        # Extract feed headers and metadata (no DB)
        feed_headers = fetch_result.headers
        feed_metadata = self._extract_feed_metadata(parsed_feed)
        last_article_published_at = self._find_latest_article_date(
            parsed_feed, feed_url
        )

        # ================================================================
        # PHASE 3: Database write operations (connection held ~500ms)
        # ================================================================
        async with session_factory() as db:
            return await self._update_feed_and_articles(
                db,
                feed_id,
                feed_metadata,
                feed_headers,
                last_article_published_at,
                new_hash,
                parsed_feed,
            )

    def _extract_feed_metadata(self, parsed_feed) -> dict:
        """Extract feed metadata from parsed content (no DB)."""
        return {
            "title": (
                parsed_feed.feed.title if hasattr(parsed_feed.feed, "title") else None
            ),
            "description": (
                parsed_feed.feed.description
                if hasattr(parsed_feed.feed, "description")
                else None
            ),
            "link": (
                parsed_feed.feed.link if hasattr(parsed_feed.feed, "link") else None
            ),
            "language": (
                parsed_feed.feed.language
                if hasattr(parsed_feed.feed, "language")
                else None
            ),
            "image_url": (
                getattr(parsed_feed.feed, "image", {}).get("href")
                if hasattr(parsed_feed.feed, "image")
                else None
            ),
        }

    def _find_latest_article_date(
        self, parsed_feed, feed_url: str
    ) -> datetime | None:
        """Find the latest article publication date (no DB)."""
        if not parsed_feed.entries:
            return None

        latest_published = None
        for entry in parsed_feed.entries:
            article_dict = self.feed_parser.extract_article_data(entry, feed_url)
            if article_dict and article_dict.get("published_at"):
                entry_published = article_dict["published_at"]
                if not latest_published or entry_published > latest_published:
                    latest_published = entry_published
        return latest_published

    async def _update_feed_and_articles(
        self,
        db,
        feed_id: UUID,
        feed_metadata: dict,
        feed_headers: dict,
        last_article_published_at: datetime | None,
        new_hash: str | None,
        parsed_feed,
    ) -> FeedResponse:
        """Update feed metadata and create articles (pure DB operation)."""
        # Re-fetch feed object for database operations
        feed_db = await crud_feed.get_feed_by_id(db, feed_id=feed_id)

        # Periodically recalculate optimal interval (1 in 10 refreshes)
        should_recalculate = (
            feed_db.adaptive_fetch_interval_minutes is None
            or random.random() < 0.1  # noqa: S311
        )
        adaptive_interval_to_set = None

        if should_recalculate:
            adaptive_interval_to_set = await calculate_optimal_interval(db, feed_db)
            logger.debug(
                "Calculated adaptive interval",
                feed_id=feed_id,
                new_interval=adaptive_interval_to_set,
            )

        # Update feed metadata
        updated_feed = await crud_feed.update_feed_metadata(
            db,
            feed_db=feed_db,
            title=feed_metadata["title"],
            description=feed_metadata["description"],
            link=feed_metadata["link"],
            language=feed_metadata["language"],
            image_url=feed_metadata["image_url"],
            etag=feed_headers.get("etag"),
            last_modified=feed_headers.get("last-modified"),
            last_fetched_at=datetime.now(timezone.utc),
            last_article_published_at=last_article_published_at,
            content_hash=new_hash,
            adaptive_fetch_interval_minutes=adaptive_interval_to_set,
        )

        # Create new articles using bulk insert
        if parsed_feed.entries:
            await self._create_new_articles_db(db, updated_feed, parsed_feed.entries)

        logger.info(
            "Feed refreshed successfully",
            feed_id=feed_id,
            new_articles=len(parsed_feed.entries) if parsed_feed.entries else 0,
        )
        return FeedResponse.model_validate(updated_feed)

    async def _create_new_articles_db(self, db, feed_db: Feed, entries: list) -> int:
        """Create new articles from feed entries using centralized bulk insert logic."""
        if not entries:
            return 0

        articles_to_create: list[ArticleCreate] = []

        for entry in entries:
            try:
                article_dict = self.feed_parser.extract_article_data(
                    entry, str(feed_db.url)
                )
                if not article_dict:
                    continue

                article_schema = ArticleCreate(
                    feed_id=feed_db.id,
                    guid=article_dict["guid"],
                    title=article_dict.get("title"),
                    link=article_dict["link"],
                    content=article_dict.get("content"),
                    author=article_dict.get("author"),
                    published_at=article_dict.get("published_at"),
                    image_url=article_dict.get("image_url"),
                    estimated_read_time_minutes=article_dict.get(
                        "estimated_read_time_minutes"
                    ),
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

        try:
            created_articles = await create_articles_batch(
                db, articles_data=articles_to_create
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
            logger.error(
                "Error in bulk article creation",
                feed_id=str(feed_db.id),
                error=str(e),
                exc_info=True,
            )
            raise

    async def get_feeds_needing_refresh(
        self, session_factory: SessionFactory, *, limit: int = 100
    ) -> list[Feed]:
        """Get global feeds that need refreshing."""
        async with session_factory() as db:
            return await crud_feed.get_feeds_needing_refresh(db, limit=limit)
