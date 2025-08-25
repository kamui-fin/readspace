"""Service for RSS feed management operations."""

from uuid import UUID

import structlog
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.redis_cache import RedisCache
from app.crud import crud_feed
from app.schemas.rss_schemas import FeedResponse, FeedUpdate
from app.services.feed_creation_service import FeedCreationService
from app.services.feed_fetcher import FeedFetcher
from app.services.feed_parser import FeedParsingService

logger = structlog.get_logger(__name__)


class FeedManagementService:
    """Service for managing RSS feeds (CRUD operations)."""

    def __init__(self, db: AsyncSession, user_id: UUID):
        self.db = db
        self.user_id = user_id
        self.feed_creation_service = FeedCreationService(db, user_id)
        self._cache = RedisCache()
        self.feed_fetcher = FeedFetcher(self._cache)
        self.feed_parser = FeedParsingService()

    async def add_new_feed(
        self,
        url: str,
        folder_id: UUID,
        tag_names: list[str] | None = None,
        update_existing: bool = False,
    ) -> FeedResponse:
        """Add a new RSS feed."""
        logger.info(
            "Adding new feed",
            url=url,
            folder_id=folder_id,
            user_id=self.user_id,
        )

        # Use the dedicated feed creation service for the complex logic
        return await self.feed_creation_service.add_new_feed(
            url=url,
            folder_id=folder_id,
            tag_names=tag_names,
            update_existing=update_existing,
        )

    async def get_feed(self, feed_id: UUID) -> FeedResponse | None:
        """Get a specific feed by ID."""
        feed_db = await crud_feed.get_feed(
            db=self.db, feed_id=feed_id, user_id=self.user_id
        )
        return FeedResponse.model_validate(feed_db) if feed_db else None

    async def list_feeds(
        self,
        folder_id: UUID | None = None,
        tag_names: list[str] | None = None,
        is_favorite: bool | None = None,
        search_query: str | None = None,
        skip: int = 0,
        limit: int = 100,
    ) -> list[FeedResponse]:
        """List feeds with optional filtering."""
        feeds_db = await crud_feed.get_feeds_by_user(
            db=self.db,
            user_id=self.user_id,
            folder_id=folder_id,
            tag_names=tag_names,
            is_favorite=is_favorite,
            search_query=search_query,
            skip=skip,
            limit=limit,
        )
        return [FeedResponse.model_validate(feed) for feed in feeds_db]

    async def update_feed_user_settings(
        self, feed_id: UUID, feed_in: FeedUpdate
    ) -> FeedResponse | None:
        """Update user-configurable feed settings."""
        logger.info("Updating feed settings", feed_id=feed_id, user_id=self.user_id)

        # Get the existing feed
        feed_db = await crud_feed.get_feed(
            db=self.db, feed_id=feed_id, user_id=self.user_id
        )
        if not feed_db:
            return None

        # Update the feed
        updated_feed = await crud_feed.update_feed(
            db=self.db, feed_db=feed_db, feed_in=feed_in
        )

        if updated_feed:
            logger.info("Feed settings updated successfully", feed_id=feed_id)
            return FeedResponse.model_validate(updated_feed)
        return None

    async def delete_feed(self, feed_id: UUID) -> bool:
        """Delete a feed and all its articles."""
        logger.info("Deleting feed", feed_id=feed_id, user_id=self.user_id)

        result = await crud_feed.delete_feed(
            db=self.db, feed_id=feed_id, user_id=self.user_id
        )

        if result:
            logger.info("Feed deleted successfully", feed_id=feed_id)
            # Clear any cached data for this feed
            await self._cache.delete(f"feed:{feed_id}")
        else:
            logger.warning("Feed not found or couldn't be deleted", feed_id=feed_id)

        return result

    async def refresh_feed(
        self, feed_id: UUID, force_refetch: bool = False
    ) -> FeedResponse | None:
        """Refresh a specific feed by fetching latest content."""
        logger.info(
            "Refreshing feed",
            feed_id=feed_id,
            user_id=self.user_id,
            force_refetch=force_refetch,
        )

        # Get the feed
        feed_db = await crud_feed.get_feed(
            db=self.db, feed_id=feed_id, user_id=self.user_id
        )
        if not feed_db:
            logger.warning("Feed not found for refresh", feed_id=feed_id)
            return None

        try:
            # Fetch and parse the feed content
            etag = feed_db.etag_header if not force_refetch else None
            last_modified = feed_db.last_modified_header if not force_refetch else None

            fetch_result = await self.feed_fetcher.fetch_content(
                str(feed_db.url), etag=etag, last_modified=last_modified
            )

            if fetch_result["status"] == 304:  # Not Modified
                # Update last_fetched_at even if not modified
                from datetime import datetime, timezone

                await crud_feed.update_feed_fetch_metadata(
                    self.db, feed_db=feed_db, last_fetched_at=datetime.now(timezone.utc)
                )
                logger.info("Feed not modified, refresh skipped", feed_id=feed_id)
                return FeedResponse.model_validate(feed_db)

            if fetch_result["status"] != 200 or not fetch_result["content"]:
                logger.error(
                    "Failed to fetch content for feed refresh",
                    feed_id=feed_id,
                    status=fetch_result.get("status"),
                )
                return FeedResponse.model_validate(feed_db)  # Return current state

            # Parse the feed content
            parsed_feed = self.feed_parser.parse_feed_content(
                fetch_result["content"], str(feed_db.url)
            )

            # Update feed metadata and create new articles
            await self._update_feed_and_articles(feed_db, fetch_result, parsed_feed)

            # Return the updated feed
            refreshed_feed = await crud_feed.get_feed(
                db=self.db, feed_id=feed_id, user_id=self.user_id
            )

            logger.info("Feed refreshed successfully", feed_id=feed_id)
            return (
                FeedResponse.model_validate(refreshed_feed) if refreshed_feed else None
            )

        except Exception as e:
            logger.error("Error refreshing feed", feed_id=feed_id, error=str(e))
            raise

    async def _update_feed_and_articles(self, feed_db, fetch_result, parsed_feed):
        """Update feed metadata and create new articles."""
        # This is a simplified version - could be expanded or moved to feed_creation_service
        from datetime import datetime, timezone

        from app.crud.crud_article import create_articles_batch
        from app.schemas.rss_schemas import ArticleCreate

        # Update feed metadata
        feed_headers = fetch_result.get("headers", {})
        await crud_feed.update_feed_fetch_metadata(
            self.db,
            feed_db=feed_db,
            etag_header=feed_headers.get("etag"),
            last_modified_header=feed_headers.get("last-modified"),
            last_fetched_at=datetime.now(timezone.utc),
        )

        # Extract and create new articles
        if parsed_feed.entries:
            articles_data = []
            for entry in parsed_feed.entries:
                # Use FeedParsingService for proper article data extraction
                try:
                    article_dict = self.feed_parser.extract_article_data(
                        entry, str(feed_db.url)
                    )
                    if article_dict:
                        article_data = ArticleCreate(
                            title=article_dict["title"],
                            link=article_dict["link"],
                            content=article_dict["content"],
                            author=article_dict.get("author"),
                            published_at=article_dict.get("published_at"),
                            guid=article_dict["guid"],
                            feed_id=feed_db.id,
                            user_id=self.user_id,
                            image_url=article_dict.get("image_url"),
                            estimated_read_time_minutes=article_dict.get(
                                "estimated_read_time_minutes"
                            ),
                        )
                        articles_data.append(article_data)
                except Exception as e:
                    logger.warning(
                        "Error parsing article", feed_id=feed_db.id, error=str(e)
                    )
                    continue

            if articles_data:
                await create_articles_batch(
                    db=self.db, articles_data=articles_data, user_id=self.user_id
                )
                logger.info(
                    f"Created {len(articles_data)} new articles", feed_id=feed_db.id
                )
