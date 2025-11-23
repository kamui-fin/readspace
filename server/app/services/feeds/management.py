"""Service for user-specific feed subscription management.

This service handles all user-scoped feed operations including subscriptions,
user preferences, and user-specific feed data (like unread counts).
"""

from typing import Any, Callable
from uuid import UUID

import structlog
from sqlalchemy import and_, func, or_, select

from app.core.redis_cache import get_redis_cache
from app.crud import crud_feed, crud_subscription
from app.models import ArticleContent, FeedArticle, FeedSubscription, UserArticleState
from app.schemas import FeedUpdate
from app.schemas.subscriptions import (
    FeedResponse,
    SubscriptionResponse,
    SubscriptionUpdate,
)
from app.services.feeds.creation import FeedCreationService
from app.services.feeds.feed import FeedService
from app.utils.url.url_normalizer import normalize_url_for_display

logger = structlog.get_logger(__name__)

# Type alias for session factory
SessionFactory = Callable[[], Any]  # Returns async context manager


class FeedManagementService:
    """Service for managing user feed subscriptions and preferences.

    This service operates with user context and manages the relationship between
    users and feeds (subscriptions), along with user-specific feed data.
    """

    def __init__(
        self,
        user_id: UUID,
        feed_creation_service: FeedCreationService | None = None,
        feed_service: FeedService | None = None,
    ):
        self.user_id = user_id
        self._cache = get_redis_cache()
        # Allow dependency injection for testing
        self.feed_creation_service = feed_creation_service or FeedCreationService(
            user_id
        )
        self.feed_service = feed_service or FeedService()

    async def add_new_feed(
        self,
        session_factory: SessionFactory,
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
            session_factory,
            url=url,
            folder_id=folder_id,
            tag_names=tag_names,
            update_existing=update_existing,
        )

    async def get_feed(
        self, session_factory: SessionFactory, feed_id: UUID
    ) -> FeedResponse | None:
        """Get a specific feed by ID for any authenticated user.

        Returns feed data with subscription status. Any authenticated user can view
        any feed, but subscription-specific data is only included for subscribed users.
        """
        async with session_factory() as db:
            # Check if user is subscribed to this feed
            subscription_db = await crud_subscription.get_subscription_by_feed_id(
                db=db, feed_id=feed_id, user_id=self.user_id
            )

            # Fetch the feed - either from subscription or directly
            if subscription_db:
                feed_db = subscription_db.feed
            else:
                feed_db = await crud_feed.get_feed_by_id(db=db, feed_id=feed_id)
                if not feed_db:
                    return None

            # Base feed data (always present)
            feed_data = {
                "id": feed_db.id,
                "url": normalize_url_for_display(
                    str(feed_db.url) if feed_db.url else None
                ),
                "title": feed_db.title,
                "description": feed_db.description,
                "link": normalize_url_for_display(
                    str(feed_db.link) if feed_db.link else None
                ),
                "language": feed_db.language,
                "image_url": normalize_url_for_display(
                    str(feed_db.image_url) if feed_db.image_url else None
                ),
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
        session_factory: SessionFactory,
        folder_id: UUID | None = None,
        tag_names: list[str] | None = None,
        is_favorite: bool | None = None,
        skip: int = 0,
        limit: int | None = None,
    ) -> list[FeedResponse]:
        """List user's feed subscriptions with optional filtering.

        Note: Unread counts are NO LONGER included in this response.
        Use the dedicated /feeds/unread-counts endpoint for per-feed counts.
        """
        import time
        service_start = time.perf_counter()
        logger.info("FeedService.list_feeds: Starting", user_id=str(self.user_id))

        session_start = time.perf_counter()
        async with session_factory() as db:
            session_duration = (time.perf_counter() - session_start) * 1000
            logger.info("FeedService.list_feeds: Session acquired", duration_ms=round(session_duration, 2))

            query_start = time.perf_counter()
            feeds_db = await crud_feed.get_feeds_by_user(
                db=db,
                user_id=self.user_id,
                folder_id=folder_id,
                tag_names=tag_names,
                is_favorite=is_favorite,
                skip=skip,
                limit=limit,
            )
            query_duration = (time.perf_counter() - query_start) * 1000
            logger.info("FeedService.list_feeds: Feeds fetched",
                       duration_ms=round(query_duration, 2),
                       count=len(feeds_db))

            if not feeds_db:
                return []

            feed_responses = []
            for feed, subscription in feeds_db:
                feed_data = {
                    "id": feed.id,
                    "url": normalize_url_for_display(
                        str(feed.url) if feed.url else None
                    ),
                    "title": subscription.custom_title or feed.title,
                    "description": feed.description,
                    "link": normalize_url_for_display(
                        str(feed.link) if feed.link else None
                    ),
                    "language": feed.language,
                    "image_url": normalize_url_for_display(
                        str(feed.image_url) if feed.image_url else None
                    ),
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
                    "unread_count": None,  # No longer calculated here
                }

                feed_responses.append(FeedResponse(**feed_data))

            return feed_responses

    async def update_feed_user_settings(
        self, session_factory: SessionFactory, feed_id: UUID, feed_in: FeedUpdate
    ) -> SubscriptionResponse | None:
        """Update user-configurable feed settings."""
        logger.info("Updating feed settings", feed_id=feed_id, user_id=self.user_id)

        async with session_factory() as db:
            # Get the existing subscription
            subscription_db = await crud_subscription.get_subscription_by_feed_id(
                db=db, feed_id=feed_id, user_id=self.user_id
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
                db=db,
                subscription_db=subscription_db,
                subscription_in=subscription_in,
            )

            if updated_subscription:
                logger.info("Feed settings updated successfully", feed_id=feed_id)
                return SubscriptionResponse.model_validate(updated_subscription)
            return None

    async def delete_feed(
        self, session_factory: SessionFactory, feed_id: UUID
    ) -> bool:
        """Delete a feed and all its articles."""
        logger.info("Deleting feed", feed_id=feed_id, user_id=self.user_id)

        async with session_factory() as db:
            # Get the subscription to delete
            subscription_db = await crud_subscription.get_subscription_by_feed_id(
                db=db, feed_id=feed_id, user_id=self.user_id
            )
            if not subscription_db:
                logger.warning(
                    "Subscription not found for deletion",
                    feed_id=feed_id,
                    user_id=self.user_id,
                )
                return False

            result = await crud_subscription.delete_subscription(
                db=db, subscription_id=subscription_db.id, user_id=self.user_id
            )

            if result:
                logger.info(
                    "Subscription deleted successfully",
                    feed_id=feed_id,
                    user_id=self.user_id,
                )
            else:
                logger.warning(
                    "Subscription could not be deleted",
                    feed_id=feed_id,
                    user_id=self.user_id,
                )

            return subscription_db is not None

    async def refresh_feed(
        self,
        session_factory: SessionFactory,
        feed_id: UUID,
        force_refetch: bool = False,
        preview_mode: bool = False,
    ) -> FeedResponse | None:
        """Refresh a specific feed by fetching latest content.

        Any authenticated user can refresh any feed in the system.
        This method delegates to FeedService for the core refresh logic,
        then adds user-specific data (subscription info, unread counts).
        """
        logger.info(
            "Refreshing feed (user-triggered)",
            feed_id=feed_id,
            user_id=self.user_id,
            force_refetch=force_refetch,
            preview_mode=preview_mode,
        )

        # Get subscription if user has one (for response construction)
        async with session_factory() as db:
            subscription_db = await crud_subscription.get_subscription_by_feed_id(
                db=db, feed_id=feed_id, user_id=self.user_id
            )

        # Delegate to FeedService for core refresh logic
        try:
            base_response = await self.feed_service.refresh_feed(
                session_factory, feed_id=feed_id, force_refetch=force_refetch
            )

            if not base_response:
                # Refresh failed - check if user is subscribed or in preview mode
                if not preview_mode and not subscription_db:
                    logger.warning("Feed not found for refresh", feed_id=feed_id)
                    return None

                # User is subscribed or in preview mode - return existing feed data
                async with session_factory() as db:
                    feed_db = await crud_feed.get_feed_by_id(db, feed_id=feed_id)
                    if not feed_db:
                        logger.warning("Feed not found for refresh", feed_id=feed_id)
                        return None

                    base_response = FeedResponse.model_validate(feed_db)

            # Convert base FeedResponse to user-specific FeedResponse
            if preview_mode or not subscription_db:
                # Preview mode: return feed without subscription data
                return self._construct_feed_response_from_base(
                    base_response, None, None
                )
            else:
                # Subscribed user: add subscription data and unread count
                async with session_factory() as db:
                    unread_count = await self._get_unread_count(db, feed_id)
                return self._construct_feed_response_from_base(
                    base_response, subscription_db, unread_count
                )

        except Exception as e:
            logger.error(
                "Error refreshing feed (user-triggered)",
                feed_id=feed_id,
                user_id=self.user_id,
                error=str(e),
            )
            raise

    async def _get_unread_count(self, db, feed_id: UUID) -> int:
        """Get unread count for a single feed."""
        unread_counts_stmt = (
            select(func.count(FeedArticle.id))
            .join(ArticleContent, ArticleContent.id == FeedArticle.content_id)
            .join(
                FeedSubscription,
                and_(
                    FeedSubscription.feed_id == FeedArticle.feed_id,
                    FeedSubscription.user_id == self.user_id,
                ),
            )
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
                    or_(
                        FeedSubscription.last_read_cutoff.is_(None),
                        ArticleContent.published_at
                        > FeedSubscription.last_read_cutoff,
                    ),
                    or_(
                        UserArticleState.is_read.is_(None),
                        ~UserArticleState.is_read,
                    ),
                )
            )
        )
        unread_count_result = await db.execute(unread_counts_stmt)
        return unread_count_result.scalar_one_or_none() or 0

    async def _get_unread_counts_for_feeds(
        self, db, feed_ids: list[UUID]
    ) -> dict[UUID, int]:
        """Get unread counts for multiple feeds in a single optimized query.

        Uses COALESCE optimization for better index usage (SARGable queries).
        """
        if not feed_ids:
            return {}

        unread_counts_stmt = (
            select(
                FeedArticle.feed_id, func.count(FeedArticle.id).label("unread_count")
            )
            .join(ArticleContent, ArticleContent.id == FeedArticle.content_id)
            .join(
                FeedSubscription,
                and_(
                    FeedSubscription.feed_id == FeedArticle.feed_id,
                    FeedSubscription.user_id == self.user_id,
                ),
            )
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
                    # Optimized unread logic using COALESCE for SARGable queries
                    ArticleContent.published_at > func.coalesce(FeedSubscription.last_read_cutoff, '1970-01-01'),
                    func.coalesce(UserArticleState.is_read, False) == False,
                )
            )
            .group_by(FeedArticle.feed_id)
        )

        result = await db.execute(unread_counts_stmt)
        rows = result.fetchall()

        # Convert to dict, ensuring all feed_ids have a count (default 0)
        unread_counts = dict.fromkeys(feed_ids, 0)
        for row in rows:
            unread_counts[row.feed_id] = row.unread_count

        return unread_counts

    def _construct_feed_response_from_base(
        self,
        base_response: FeedResponse,
        subscription_db: Any | None,
        unread_count: int | None,
    ) -> FeedResponse:
        """Construct a user-specific FeedResponse from a base FeedResponse."""
        # Start with base response data
        feed_data = base_response.model_dump()

        # Add subscription-specific data if user is subscribed
        if subscription_db:
            feed_data.update(
                {
                    "title": subscription_db.custom_title or base_response.title,
                    "is_subscribed": True,
                    "user_id": subscription_db.user_id,
                    "folder_id": subscription_db.folder_id,
                    "is_favorite": subscription_db.is_favorite,
                    "unread_count": unread_count,
                }
            )
        else:
            # Preview mode: no subscription data
            feed_data.update(
                {
                    "is_subscribed": False,
                    "user_id": None,
                    "folder_id": None,
                    "unread_count": None,
                }
            )

        return FeedResponse(**feed_data)

    async def get_all_feed_unread_counts(
        self, session_factory: SessionFactory
    ) -> dict[str, int]:
        """Get unread counts for all user's feeds.

        Returns:
            Dictionary mapping feed_id (as string) to unread count
        """
        async with session_factory() as db:
            # Get all user's feed IDs
            feeds_db = await crud_feed.get_feeds_by_user(
                db=db,
                user_id=self.user_id,
            )

            if not feeds_db:
                return {}

            feed_ids = [feed.id for feed, _ in feeds_db]

            # Get unread counts for all feeds
            unread_counts = await self._get_unread_counts_for_feeds(db, feed_ids)

            # Convert UUID keys to strings for JSON serialization
            return {str(feed_id): count for feed_id, count in unread_counts.items()}
