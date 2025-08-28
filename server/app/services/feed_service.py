"""Service for managing global feeds."""

from datetime import datetime, timezone
from uuid import UUID

import structlog
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.redis_cache import RedisCache
from app.crud import crud_feed
from app.models.rss_models import Feed
from app.schemas.rss_schemas import FeedBase
from app.schemas.subscription_schemas import FeedResponse
from app.services.feed_fetcher import FeedFetcher
from app.services.feed_parser import FeedParsingService
from app.utils.guid_generator import generate_stable_guid

logger = structlog.get_logger(__name__)


class FeedService:
    """Service for managing global feeds (feeds_new table)."""

    def __init__(self, db: AsyncSession):
        self.db = db
        self._cache = RedisCache()
        self.feed_fetcher = FeedFetcher(self._cache)
        self.feed_parser = FeedParsingService()

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

    async def refresh_feed(
        self, *, feed_id: UUID, force_refetch: bool = False
    ) -> FeedResponse | None:
        """Refresh a global feed by fetching latest content."""
        logger.info(
            "Refreshing global feed", feed_id=feed_id, force_refetch=force_refetch
        )

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

            if fetch_result["status_code"] == 304:  # Not Modified
                # Update last_fetched_at even if not modified
                await crud_feed.update_feed_metadata(
                    self.db, feed_db=feed_db, last_fetched_at=datetime.now(timezone.utc)
                )
                logger.info("Feed not modified, refresh skipped", feed_id=feed_id)
                return FeedResponse.model_validate(feed_db)

            if fetch_result["status_code"] != 200 or not fetch_result["content"]:
                error_msg = (
                    f"Failed to fetch content: status {fetch_result.get('status_code')}"
                )
                logger.error("Feed fetch failed", feed_id=feed_id, error=error_msg)
                return None

            # Parse the feed content
            parsed_feed = self.feed_parser.parse_feed_data(
                fetch_result["content"], str(feed_db.url)
            )

            # Update feed metadata
            feed_headers = fetch_result.get("headers", {})
            last_article_published_at = None

            if parsed_feed.entries:
                # Find the latest article publication date
                latest_published = None
                for entry in parsed_feed.entries:
                    article_dict = self.feed_parser.extract_article_data(
                        entry, str(feed_db.url)
                    )
                    if article_dict and article_dict.get("published_at"):
                        entry_published = article_dict["published_at"]
                        if not latest_published or entry_published > latest_published:
                            latest_published = entry_published

                last_article_published_at = latest_published

            # Update feed metadata
            updated_feed = await crud_feed.update_feed_metadata(
                self.db,
                feed_db=feed_db,
                title=parsed_feed.feed.title
                if hasattr(parsed_feed.feed, "title")
                else None,
                description=parsed_feed.feed.description
                if hasattr(parsed_feed.feed, "description")
                else None,
                link=parsed_feed.feed.link
                if hasattr(parsed_feed.feed, "link")
                else None,
                language=parsed_feed.feed.language
                if hasattr(parsed_feed.feed, "language")
                else None,
                image_url=getattr(parsed_feed.feed, "image", {}).get("href")
                if hasattr(parsed_feed.feed, "image")
                else None,
                etag=feed_headers.get("etag"),
                last_modified=feed_headers.get("last-modified"),
                last_fetched_at=datetime.now(timezone.utc),
                last_article_published_at=last_article_published_at,
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
            await crud_feed.update_feed_error(
                self.db, feed_db=feed_db, error_message=error_msg
            )
            raise

    async def _create_new_articles(self, feed_db: Feed, entries: list) -> int:
        """Create new articles from feed entries using efficient bulk insert."""
        from datetime import datetime, timezone

        from sqlalchemy import insert

        from app.models.rss_models import ArticleContent, FeedArticle

        if not entries:
            return 0

        # Step 1: Process all entries and generate stable GUIDs
        articles_to_create = []
        content_to_create = []

        for entry in entries:
            try:
                # Extract article data
                article_dict = self.feed_parser.extract_article_data(
                    entry, str(feed_db.url)
                )
                if not article_dict:
                    continue

                # Generate stable GUID for this feed
                guid = generate_stable_guid(
                    original_guid=article_dict.get("guid"),
                    link=article_dict.get("link"),
                    title=article_dict.get("title"),
                    published_at=str(article_dict.get("published_at"))
                    if article_dict.get("published_at")
                    else None,
                    content=article_dict.get("content"),
                )

                # Prepare content data
                content_data = {
                    "title": article_dict.get("title"),
                    "link": article_dict["link"],
                    "description": article_dict.get("description"),
                    "content": article_dict.get("content"),
                    "author": article_dict.get("author"),
                    "published_at": article_dict.get("published_at"),
                    "image_url": article_dict.get("image_url"),
                    "estimated_read_time_minutes": article_dict.get(
                        "estimated_read_time_minutes"
                    ),
                    "created_at": datetime.now(timezone.utc),
                    "updated_at": datetime.now(timezone.utc),
                }

                content_to_create.append(content_data)
                articles_to_create.append(
                    (guid, len(content_to_create) - 1)
                )  # Store index reference

            except Exception as e:
                logger.warning(
                    "Error processing article entry",
                    feed_id=str(feed_db.id),
                    error=str(e),
                )
                continue

        if not content_to_create:
            return 0

        try:
            # Step 2: Bulk create content first
            content_insert_stmt = insert(ArticleContent).values(content_to_create)
            content_result = await self.db.execute(
                content_insert_stmt.returning(ArticleContent.id)
            )
            content_rows = content_result.fetchall()
            await self.db.flush()

            # Step 3: Prepare article data with content IDs
            article_insert_data = []
            for i, content_row in enumerate(content_rows):
                if i < len(articles_to_create):
                    guid, _ = articles_to_create[i]
                    article_insert_data.append(
                        {
                            "feed_id": feed_db.id,
                            "content_id": content_row.id,
                            "guid": guid,
                            "created_at": datetime.now(timezone.utc),
                            "updated_at": datetime.now(timezone.utc),
                        }
                    )

            # Step 4: Bulk insert articles with PostgreSQL-specific ON CONFLICT DO NOTHING
            # This is the key efficiency improvement - single query handles all duplicates
            from sqlalchemy.dialects.postgresql import insert as pg_insert

            article_insert_stmt = pg_insert(FeedArticle).values(article_insert_data)
            article_insert_stmt = article_insert_stmt.on_conflict_do_nothing(
                index_elements=["feed_id", "guid"]
            )

            result = await self.db.execute(article_insert_stmt)
            await self.db.commit()

            created_count = result.rowcount or 0

            if created_count > 0:
                logger.info(
                    f"Bulk created {created_count} new articles from {len(entries)} entries",
                    feed_id=str(feed_db.id),
                )
            else:
                logger.info(
                    "No new articles to create (all were duplicates)",
                    feed_id=str(feed_db.id),
                )

            return created_count

        except Exception as e:
            await self.db.rollback()
            logger.error(
                "Error in bulk article creation", feed_id=str(feed_db.id), error=str(e)
            )
            raise

    async def get_feeds_needing_refresh(self, *, limit: int = 100) -> list[Feed]:
        """Get global feeds that need refreshing."""
        return await crud_feed.get_feeds_needing_refresh(self.db, limit=limit)