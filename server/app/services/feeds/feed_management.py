"""Service for user-specific feed subscription management.

This service handles all user-scoped feed operations including subscriptions,
user preferences, and user-specific feed data (like unread counts).

IMPORTANT: Use this service for:
- User feed subscription management (add, list, update, delete)
- User-specific feed data (unread counts, favorites)
- User-initiated feed refreshes
- API endpoint operations that require user context

For global feed operations (background workers), use FeedService instead.
For initial feed creation, use FeedCreationService.
"""

from datetime import datetime, timezone
from typing import Any
from uuid import UUID

import structlog
from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.redis_cache import get_redis_cache
from app.crud import crud_feed, crud_subscription
from app.crud.crud_article import create_articles_batch
from app.models import FeedArticle, UserArticleState
from app.schemas import ArticleCreate, FeedResponse, FeedUpdate
from app.schemas.subscriptions import SubscriptionResponse, SubscriptionUpdate
from app.services.feeds.feed_creation import FeedCreationService
from app.services.feed_fetcher import FeedFetcher
from app.services.feed_parser import FeedParsingService
from app.utils.url_normalizer import normalize_url_for_display

logger = structlog.get_logger(__name__)


class FeedManagementService:
    """Service for managing user feed subscriptions and preferences.

    This service operates with user context and manages the relationship between
    users and feeds (subscriptions), along with user-specific feed data.

    Responsibilities:
    - Managing user feed subscriptions (add, list, update, delete)
    - Providing user-specific feed data (custom titles, folders, favorites)
    - Calculating unread counts per feed
    - User-initiated feed refreshes (including preview mode)
    - Normalizing URLs for API responses

    Usage:
        # For API endpoints with user context
        feed_service = FeedManagementService(db, user_id=current_user.id)
        feeds = await feed_service.list_feeds(folder_id=folder_id)

    See Also:
        FeedService: For global feed operations (background workers)
        FeedCreationService: For creating new feeds
        SubscriptionService: For additional subscription logic
    """

    def __init__(
        self,
        db: AsyncSession,
        user_id: UUID,
        feed_creation_service: FeedCreationService | None = None,
        feed_fetcher: FeedFetcher | None = None,
        feed_parser: FeedParsingService | None = None,
    ):
        self.db = db
        self.user_id = user_id
        self._cache = get_redis_cache()
        # Allow dependency injection while maintaining backward compatibility
        self.feed_creation_service = feed_creation_service or FeedCreationService(db, user_id)
        self.feed_fetcher = feed_fetcher or FeedFetcher(self._cache)
        self.feed_parser = feed_parser or FeedParsingService()

    async def add_new_feed(
        self,
        url: str,
        folder_id: UUID,
        tag_names: list[str] | None = None,
        update_existing: bool = False,
    ) -> SubscriptionResponse:
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
        """Get a specific feed by ID. Returns feed data regardless of subscription status."""
        # Fetch the feed
        feed_db = await crud_feed.get_feed_by_id(db=self.db, feed_id=feed_id)
        if not feed_db:
            return None

        # Check if user is subscribed to this feed
        subscription_db = await crud_subscription.get_subscription_by_feed_id(
            db=self.db, feed_id=feed_id, user_id=self.user_id
        )

        # Base feed data (always present)
        feed_data = {
            "id": feed_db.id,
            "url": normalize_url_for_display(str(feed_db.url) if feed_db.url else None),
            "title": feed_db.title,
            "description": feed_db.description,
            "link": normalize_url_for_display(str(feed_db.link) if feed_db.link else None),
            "language": feed_db.language,
            "image_url": normalize_url_for_display(str(feed_db.image_url) if feed_db.image_url else None),
            "tags": feed_db.tags,
            "top_level_category": feed_db.top_level_category,
            "popularity_score": feed_db.popularity_score,
            "ttl": feed_db.ttl,
            "skip_hours": feed_db.skip_hours,
            "skip_days": feed_db.skip_days,
            "last_fetched_at": feed_db.last_fetched_at,
            "last_modified_header": feed_db.last_modified_header,
            "etag_header": feed_db.etag_header,
            "last_article_published_at": feed_db.last_article_published_at,
            "created_at": feed_db.created_at,
            "updated_at": feed_db.updated_at,
            "is_subscribed": subscription_db is not None,
        }

        # Add subscription-specific data if user is subscribed
        if subscription_db:
            # Override title with custom title if set, and add subscription data
            feed_data.update(
                {
                    "title": subscription_db.custom_title or feed_db.title,
                    "user_id": subscription_db.user_id,
                    "folder_id": subscription_db.folder_id,
                    "is_favorite": subscription_db.is_favorite,
                }
            )

        return FeedResponse(**feed_data)

    async def list_feeds(
        self,
        folder_id: UUID | None = None,
        tag_names: list[str] | None = None,
        is_favorite: bool | None = None,
        search_query: str | None = None,
        skip: int = 0,
        limit: int = 100,
        include_unread_counts: bool = False,
    ) -> list[FeedResponse]:
        """
        List user's feed subscriptions with optional filtering and unread counts.

        Args:
            include_unread_counts: If True, includes unread counts in a single optimized query.
                                 If False, only fetches feed metadata (faster).
        """
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

        if not feeds_db:
            return []

        # Get unread counts in a single query if requested
        unread_counts_by_feed = {}
        if include_unread_counts:
            feed_ids = [feed.id for feed, _ in feeds_db]
            unread_counts_by_feed = await self._get_unread_counts_for_feeds(feed_ids)

        feed_responses = []
        for feed, subscription in feeds_db:
            feed_data = {
                "id": feed.id,
                "url": normalize_url_for_display(str(feed.url) if feed.url else None),
                "title": subscription.custom_title or feed.title,
                "description": feed.description,
                "link": normalize_url_for_display(str(feed.link) if feed.link else None),
                "language": feed.language,
                "image_url": normalize_url_for_display(str(feed.image_url) if feed.image_url else None),
                "tags": feed.tags,
                "top_level_category": feed.top_level_category,
                "popularity_score": feed.popularity_score,
                "ttl": feed.ttl,
                "skip_hours": feed.skip_hours,
                "skip_days": feed.skip_days,
                "last_fetched_at": feed.last_fetched_at,
                "last_modified_header": feed.last_modified_header,
                "etag_header": feed.etag_header,
                "last_article_published_at": feed.last_article_published_at,
                "created_at": feed.created_at,
                "updated_at": feed.updated_at,
                "is_subscribed": True,
                "user_id": subscription.user_id,
                "folder_id": subscription.folder_id,
                "is_favorite": subscription.is_favorite,
            }

            # Add unread count if requested
            if include_unread_counts:
                feed_data["unread_count"] = unread_counts_by_feed.get(feed.id, 0)

            feed_responses.append(FeedResponse(**feed_data))

        return feed_responses

    async def update_feed_user_settings(self, feed_id: UUID, feed_in: FeedUpdate) -> FeedResponse | None:
        """Update user-configurable feed settings."""
        logger.info("Updating feed settings", feed_id=feed_id, user_id=self.user_id)

        # Get the existing subscription
        subscription_db = await crud_subscription.get_subscription_by_feed_id(
            db=self.db, feed_id=feed_id, user_id=self.user_id
        )
        if not subscription_db:
            return None

        # The FeedUpdate schema is for subscriptions, so we need to convert it to SubscriptionUpdate
        subscription_in_data = feed_in.model_dump(exclude_unset=True)
        if "title" in subscription_in_data:
            subscription_in_data["custom_title"] = subscription_in_data.pop("title")
        subscription_in = SubscriptionUpdate(**subscription_in_data)

        # Update the subscription
        updated_subscription = await crud_subscription.update_subscription(
            db=self.db, subscription_db=subscription_db, subscription_in=subscription_in
        )

        if updated_subscription:
            logger.info("Feed settings updated successfully", feed_id=feed_id)
            feed_db = updated_subscription.feed

            feed_data = {
                "id": feed_db.id,
                "url": normalize_url_for_display(str(feed_db.url) if feed_db.url else None),
                "title": updated_subscription.custom_title or feed_db.title,
                "description": feed_db.description,
                "link": normalize_url_for_display(str(feed_db.link) if feed_db.link else None),
                "language": feed_db.language,
                "image_url": normalize_url_for_display(str(feed_db.image_url) if feed_db.image_url else None),
                "tags": feed_db.tags,
                "top_level_category": feed_db.top_level_category,
                "popularity_score": feed_db.popularity_score,
                "ttl": feed_db.ttl,
                "skip_hours": feed_db.skip_hours,
                "skip_days": feed_db.skip_days,
                "last_fetched_at": feed_db.last_fetched_at,
                "last_modified_header": feed_db.last_modified_header,
                "etag_header": feed_db.etag_header,
                "last_article_published_at": feed_db.last_article_published_at,
                "created_at": feed_db.created_at,
                "updated_at": feed_db.updated_at,
                "is_subscribed": True,
                "user_id": updated_subscription.user_id,
                "folder_id": updated_subscription.folder_id,
                "is_favorite": updated_subscription.is_favorite,
            }
            return FeedResponse(**feed_data)
        return None

    async def delete_feed(self, feed_id: UUID) -> bool:
        """Delete a feed and all its articles."""
        logger.info("Deleting feed", feed_id=feed_id, user_id=self.user_id)

        # Get the subscription to delete
        subscription_db = await crud_subscription.get_subscription_by_feed_id(
            db=self.db, feed_id=feed_id, user_id=self.user_id
        )
        if not subscription_db:
            logger.warning(
                "Subscription not found for deletion",
                feed_id=feed_id,
                user_id=self.user_id,
            )
            return False

        result = await crud_subscription.delete_subscription(
            db=self.db, subscription_id=subscription_db.id, user_id=self.user_id
        )

        if result:
            logger.info(
                "Subscription deleted successfully",
                feed_id=feed_id,
                user_id=self.user_id,
            )
            # Clear any cached data for this feed (optional, as feed might still exist for other users)
            # await self._cache.delete(f"feed:{feed_id}")
        else:
            logger.warning(
                "Subscription could not be deleted",
                feed_id=feed_id,
                user_id=self.user_id,
            )

        return subscription_db is not None

    async def refresh_feed(
        self, feed_id: UUID, force_refetch: bool = False, preview_mode: bool = False
    ) -> FeedResponse | None:
        """Refresh a specific feed by fetching latest content."""
        logger.info(
            "Refreshing feed",
            feed_id=feed_id,
            user_id=self.user_id,
            force_refetch=force_refetch,
            preview_mode=preview_mode,
        )

        # Get the feed
        feed_db = await crud_feed.get_feed_by_id(db=self.db, feed_id=feed_id)
        if not feed_db:
            logger.warning("Feed not found for refresh", feed_id=feed_id)
            return None

        # For preview mode, we don't require a subscription
        subscription_db = None
        if not preview_mode:
            subscription_db = await crud_subscription.get_subscription_by_feed_id(
                db=self.db, feed_id=feed_id, user_id=self.user_id
            )
            if not subscription_db:
                logger.warning(
                    "Subscription not found for refresh",
                    feed_id=feed_id,
                    user_id=self.user_id,
                )
                return None

        try:
            # Fetch and parse the feed content
            etag = feed_db.etag_header if not force_refetch else None
            last_modified = feed_db.last_modified_header if not force_refetch else None

            fetch_result = await self.feed_fetcher.fetch_content(
                str(feed_db.url), etag=etag, last_modified=last_modified
            )

            if fetch_result["status_code"] == 304:  # Not Modified
                # Update last_fetched_at even if not modified
                await crud_feed.update_feed_metadata(
                    self.db, feed_db=feed_db, last_fetched_at=datetime.now(timezone.utc)
                )
                logger.info("Feed not modified, refresh skipped", feed_id=feed_id)
                # Construct FeedResponse with current data
                if preview_mode:
                    return self._construct_feed_response_preview(feed_db)
                else:
                    unread_count = await self._get_unread_count(feed_id)
                    return self._construct_feed_response(feed_db, subscription_db, unread_count)

            if fetch_result["status_code"] != 200 or not fetch_result["content"]:
                logger.error(
                    "Failed to fetch content for feed refresh",
                    feed_id=feed_id,
                    status=fetch_result.get("status_code"),
                )
                # Return current state with correct user-specific data
                if preview_mode:
                    return self._construct_feed_response_preview(feed_db)
                else:
                    unread_count = await self._get_unread_count(feed_id)
                    return self._construct_feed_response(feed_db, subscription_db, unread_count)

            # Parse the feed content
            parsed_feed = self.feed_parser.parse_feed_data(fetch_result["content"], str(feed_db.url))

            # Update feed metadata and create new articles
            await self._update_feed_and_articles(feed_db, fetch_result, parsed_feed)

            # Return the updated feed
            refreshed_feed = await crud_feed.get_feed_by_id(db=self.db, feed_id=feed_id)

            logger.info("Feed refreshed successfully", feed_id=feed_id)
            if refreshed_feed:
                if preview_mode:
                    return self._construct_feed_response_preview(refreshed_feed)
                else:
                    unread_count = await self._get_unread_count(feed_id)
                    return self._construct_feed_response(refreshed_feed, subscription_db, unread_count)
            return None

        except Exception as e:
            logger.error("Error refreshing feed", feed_id=feed_id, error=str(e))
            raise

    async def _get_unread_count(self, feed_id: UUID) -> int:
        unread_counts_stmt = (
            select(func.count(FeedArticle.id))
            .outerjoin(
                UserArticleState,
                and_(
                    UserArticleState.article_id == FeedArticle.id,
                    UserArticleState.user_id == self.user_id,
                ),
            )
            .where(
                and_(
                    FeedArticle.feed_id == feed_id,
                    # Count as unread if no state record OR explicitly marked unread
                    or_(
                        UserArticleState.is_read.is_(None),
                        ~UserArticleState.is_read,
                    ),
                )
            )
        )
        unread_count_result = await self.db.execute(unread_counts_stmt)
        return unread_count_result.scalar_one_or_none() or 0

    async def _get_unread_counts_for_feeds(self, feed_ids: list[UUID]) -> dict[UUID, int]:
        """Get unread counts for multiple feeds in a single optimized query."""
        if not feed_ids:
            return {}

        # Single query to get unread counts for all feeds
        unread_counts_stmt = (
            select(FeedArticle.feed_id, func.count(FeedArticle.id).label("unread_count"))
            .outerjoin(
                UserArticleState,
                and_(
                    UserArticleState.article_id == FeedArticle.id,
                    UserArticleState.user_id == self.user_id,
                ),
            )
            .where(
                and_(
                    FeedArticle.feed_id.in_(feed_ids),
                    # Count as unread if no state record OR explicitly marked unread
                    or_(
                        UserArticleState.is_read.is_(None),
                        ~UserArticleState.is_read,
                    ),
                )
            )
            .group_by(FeedArticle.feed_id)
        )

        result = await self.db.execute(unread_counts_stmt)
        rows = result.fetchall()

        # Convert to dict, ensuring all feed_ids have a count (default 0)
        unread_counts = dict.fromkeys(feed_ids, 0)
        for row in rows:
            unread_counts[row.feed_id] = row.unread_count

        return unread_counts

    def _construct_feed_response(self, feed_db: Any, subscription_db: Any, unread_count: int) -> FeedResponse:
        feed_data = {
            "id": feed_db.id,
            "url": normalize_url_for_display(str(feed_db.url) if feed_db.url else None),
            "title": subscription_db.custom_title or feed_db.title,
            "description": feed_db.description,
            "link": normalize_url_for_display(str(feed_db.link) if feed_db.link else None),
            "language": feed_db.language,
            "image_url": normalize_url_for_display(str(feed_db.image_url) if feed_db.image_url else None),
            "tags": feed_db.tags,
            "top_level_category": feed_db.top_level_category,
            "popularity_score": feed_db.popularity_score,
            "ttl": feed_db.ttl,
            "skip_hours": feed_db.skip_hours,
            "skip_days": feed_db.skip_days,
            "last_fetched_at": feed_db.last_fetched_at,
            "last_modified_header": feed_db.last_modified_header,
            "etag_header": feed_db.etag_header,
            "last_article_published_at": feed_db.last_article_published_at,
            "created_at": feed_db.created_at,
            "updated_at": feed_db.updated_at,
            "is_subscribed": True,
            "user_id": subscription_db.user_id,
            "folder_id": subscription_db.folder_id,
            "unread_count": unread_count,
        }
        return FeedResponse(**feed_data)

    def _construct_feed_response_preview(self, feed_db: Any) -> FeedResponse:
        """Construct a FeedResponse for preview mode (no subscription data)."""
        feed_data = {
            "id": feed_db.id,
            "url": normalize_url_for_display(str(feed_db.url) if feed_db.url else None),
            "title": feed_db.title,
            "description": feed_db.description,
            "link": normalize_url_for_display(str(feed_db.link) if feed_db.link else None),
            "language": feed_db.language,
            "image_url": normalize_url_for_display(str(feed_db.image_url) if feed_db.image_url else None),
            "tags": feed_db.tags,
            "top_level_category": feed_db.top_level_category,
            "popularity_score": feed_db.popularity_score,
            "ttl": feed_db.ttl,
            "skip_hours": feed_db.skip_hours,
            "skip_days": feed_db.skip_days,
            "last_fetched_at": feed_db.last_fetched_at,
            "last_modified_header": feed_db.last_modified_header,
            "etag_header": feed_db.etag_header,
            "last_article_published_at": feed_db.last_article_published_at,
            "created_at": feed_db.created_at,
            "updated_at": feed_db.updated_at,
            "is_subscribed": False,
            "user_id": None,
            "folder_id": None,
            "unread_count": None,
        }
        return FeedResponse(**feed_data)

    async def _update_feed_and_articles(self, feed_db: Any, fetch_result: dict[str, Any], parsed_feed: Any) -> None:
        """Update feed metadata and create new articles."""
        # This is a simplified version - could be expanded or moved to feed_creation_service
        # Extract and create new articles first to get latest published_at
        latest_published_at = None
        if parsed_feed.entries:
            articles_data = []
            for entry in parsed_feed.entries:
                # Use FeedParsingService for proper article data extraction
                try:
                    article_dict = self.feed_parser.extract_article_data(entry, str(feed_db.url))
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
                            estimated_read_time_minutes=article_dict.get("estimated_read_time_minutes"),
                        )
                        articles_data.append(article_data)

                        # Track the latest published_at timestamp
                        if article_data.published_at:
                            if latest_published_at is None or article_data.published_at > latest_published_at:
                                latest_published_at = article_data.published_at
                except Exception as e:
                    logger.warning("Error parsing article", feed_id=feed_db.id, error=str(e))
                    continue

            if articles_data:
                created_count = await create_articles_batch(
                    db=self.db, articles_data=articles_data, user_id=self.user_id
                )
                logger.info(f"Created {created_count} new articles", feed_id=feed_db.id)

        # Update feed metadata with latest published_at timestamp
        feed_headers = fetch_result.get("headers", {})

        # If we found a newer published_at, use it; otherwise keep the existing value
        update_last_article_published_at = latest_published_at
        if latest_published_at and feed_db.last_article_published_at:
            # Only update if the new timestamp is more recent
            if latest_published_at > feed_db.last_article_published_at:
                update_last_article_published_at = latest_published_at
            else:
                update_last_article_published_at = None  # Don't update, keep existing
        elif latest_published_at:
            # First time we have a published_at timestamp
            update_last_article_published_at = latest_published_at
        else:
            # No new articles or no published_at timestamps
            update_last_article_published_at = None

        await crud_feed.update_feed_metadata(
            self.db,
            feed_db=feed_db,
            etag=feed_headers.get("etag"),
            last_modified=feed_headers.get("last-modified"),
            last_fetched_at=datetime.now(timezone.utc),
            last_article_published_at=update_last_article_published_at,
        )
