"""Service for managing user feed subscriptions."""

from uuid import UUID

import structlog
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud import crud_subscription
from app.schemas.subscription_schemas import (
    LegacyFeedResponse,
    SubscriptionCreate,
    SubscriptionResponse,
    SubscriptionUpdate,
)
from app.services.feed_service import FeedService

logger = structlog.get_logger(__name__)


class SubscriptionService:
    """Service for managing user feed subscriptions."""

    def __init__(self, db: AsyncSession, user_id: UUID):
        self.db = db
        self.user_id = user_id
        self.feed_service = FeedService(db)

    async def create_subscription(
        self,
        *,
        url: str,
        folder_id: UUID | str,
        # tag_ids removed - using ARRAY field on feeds
        custom_title: str | None = None,
        feed_data: dict | None = None,
    ) -> SubscriptionResponse:
        """Create a new feed subscription for the user."""

        # Handle 'default' folder_id by getting the actual default folder
        actual_folder_id = folder_id
        if folder_id == "default":
            from app.services.folder_service import FolderService

            folder_service = FolderService(self.db, self.user_id)
            default_folder = await folder_service.get_default_folder()
            if default_folder:
                actual_folder_id = default_folder.id
            else:
                raise ValueError("Could not find or create default folder")

        logger.info(
            "Creating subscription",
            url=url,
            folder_id=actual_folder_id,
            user_id=self.user_id,
        )

        try:
            subscription_in = SubscriptionCreate(
                url=url,
                folder_id=actual_folder_id,
                # tag_ids removed - using ARRAY field on feeds
                custom_title=custom_title,
            )

            subscription_db = await crud_subscription.create_subscription(
                self.db,
                subscription_in=subscription_in,
                user_id=self.user_id,
                feed_data=feed_data,
            )

            logger.info(
                "Subscription created successfully",
                subscription_id=subscription_db.id,
                url=url,
            )
            return SubscriptionResponse.model_validate(subscription_db)

        except IntegrityError as e:
            logger.warning("Subscription already exists", url=url, user_id=self.user_id)
            raise ValueError(f"Subscription to feed '{url}' already exists") from e

    async def get_subscription_by_id(self, *, subscription_id: UUID) -> SubscriptionResponse | None:
        """Get a subscription by ID."""
        subscription_db = await crud_subscription.get_subscription_by_id(
            self.db, subscription_id=subscription_id, user_id=self.user_id
        )
        return SubscriptionResponse.model_validate(subscription_db) if subscription_db else None

    async def get_subscription_by_feed_url(self, *, url: str) -> SubscriptionResponse | None:
        """Get user's subscription to a feed by URL."""
        subscription_db = await crud_subscription.get_subscription_by_feed_url(self.db, url=url, user_id=self.user_id)
        return SubscriptionResponse.model_validate(subscription_db) if subscription_db else None

    async def list_subscriptions(
        self,
        *,
        folder_id: UUID | None = None,
        tag_names: list[str] | None = None,
        is_favorite: bool | None = None,
        search_query: str | None = None,
        skip: int = 0,
        limit: int = 100,
    ) -> list[SubscriptionResponse]:
        """List user's subscriptions with filtering options."""
        subscriptions_db = await crud_subscription.get_subscriptions_by_user(
            self.db,
            user_id=self.user_id,
            folder_id=folder_id,
            tag_names=tag_names,
            is_favorite=is_favorite,
            search_query=search_query,
            skip=skip,
            limit=limit,
        )
        return [SubscriptionResponse.model_validate(sub) for sub in subscriptions_db]

    async def update_subscription(
        self, *, subscription_id: UUID, subscription_in: SubscriptionUpdate
    ) -> SubscriptionResponse | None:
        """Update a subscription."""
        logger.info(
            "Updating subscription",
            subscription_id=subscription_id,
            user_id=self.user_id,
        )

        subscription_db = await crud_subscription.get_subscription_by_id(
            self.db, subscription_id=subscription_id, user_id=self.user_id
        )
        if not subscription_db:
            return None

        updated_subscription = await crud_subscription.update_subscription(
            self.db, subscription_db=subscription_db, subscription_in=subscription_in
        )

        logger.info("Subscription updated successfully", subscription_id=subscription_id)
        return SubscriptionResponse.model_validate(updated_subscription)

    async def delete_subscription(self, *, subscription_id: UUID) -> bool:
        """Delete a subscription and decrement feed subscriber count."""
        logger.info(
            "Deleting subscription",
            subscription_id=subscription_id,
            user_id=self.user_id,
        )

        result = await crud_subscription.delete_subscription(
            self.db, subscription_id=subscription_id, user_id=self.user_id
        )

        if result:
            logger.info("Subscription deleted successfully", subscription_id=subscription_id)
        else:
            logger.warning(
                "Subscription not found or couldn't be deleted",
                subscription_id=subscription_id,
            )

        return bool(result)

    async def get_all_subscriptions_for_user(self) -> list[SubscriptionResponse]:
        """Get all subscriptions for the user (for OPML export, etc.)."""
        subscriptions_db = await crud_subscription.get_all_subscriptions_for_user(self.db, user_id=self.user_id)
        return [SubscriptionResponse.model_validate(sub) for sub in subscriptions_db]

    # Backward compatibility methods
    async def get_legacy_feed_response(self, *, subscription_id: UUID) -> LegacyFeedResponse | None:
        """Get a subscription formatted as a legacy feed response for backward compatibility."""
        subscription_db = await crud_subscription.get_subscription_by_id(
            self.db, subscription_id=subscription_id, user_id=self.user_id
        )

        if not subscription_db:
            return None

        # Map subscription + global feed data to legacy format
        feed = subscription_db.feed
        return LegacyFeedResponse(
            id=subscription_db.id,  # Use subscription ID as "feed" ID for compatibility
            user_id=subscription_db.user_id,
            folder_id=subscription_db.folder_id,
            url=feed.url,
            title=subscription_db.custom_title or feed.title,
            description=feed.description,
            link=feed.link,
            language=feed.language,
            image_url=feed.image_url,
            is_favorite=subscription_db.is_favorite,
            ttl=feed.ttl,
            skip_hours=feed.skip_hours,
            skip_days=feed.skip_days,
            last_fetched_at=feed.last_fetched_at,
            last_modified_header=feed.last_modified_header,
            etag_header=feed.etag_header,
            last_article_published_at=feed.last_article_published_at,
            # Note: error tracking columns removed from model
            created_at=subscription_db.created_at,
            updated_at=subscription_db.updated_at,
        )

    async def list_legacy_feeds(
        self,
        *,
        folder_id: UUID | None = None,
        tag_names: list[str] | None = None,
        is_favorite: bool | None = None,
        search_query: str | None = None,
        skip: int = 0,
        limit: int = 100,
    ) -> list[LegacyFeedResponse]:
        """List subscriptions formatted as legacy feeds for backward compatibility."""
        subscriptions_db = await crud_subscription.get_subscriptions_by_user(
            self.db,
            user_id=self.user_id,
            folder_id=folder_id,
            tag_names=tag_names,
            is_favorite=is_favorite,
            search_query=search_query,
            skip=skip,
            limit=limit,
        )

        legacy_feeds = []
        for sub in subscriptions_db:
            feed = sub.feed
            legacy_feed = LegacyFeedResponse(
                id=sub.id,  # Use subscription ID as "feed" ID
                user_id=sub.user_id,
                folder_id=sub.folder_id,
                url=feed.url,
                title=sub.custom_title or feed.title,
                description=feed.description,
                link=feed.link,
                language=feed.language,
                image_url=feed.image_url,
                is_favorite=sub.is_favorite,
                ttl=feed.ttl,
                skip_hours=feed.skip_hours,
                skip_days=feed.skip_days,
                last_fetched_at=feed.last_fetched_at,
                last_modified_header=feed.last_modified_header,
                etag_header=feed.etag_header,
                last_article_published_at=feed.last_article_published_at,
                # Note: error tracking columns removed from model
                created_at=sub.created_at,
                updated_at=sub.updated_at,
            )
            legacy_feeds.append(legacy_feed)

        return legacy_feeds

    async def create_subscription_by_feed_id(
        self,
        *,
        feed_id: UUID,
        folder_id: UUID | str,
        custom_title: str | None = None,
    ) -> SubscriptionResponse:
        """Create a subscription directly by feed ID, bypassing URL parsing."""

        # Handle 'default' folder_id by getting the actual default folder
        actual_folder_id = folder_id
        if folder_id == "default":
            from app.services.folder_service import FolderService

            folder_service = FolderService(self.db, self.user_id)
            default_folder = await folder_service.get_default_folder()
            if default_folder:
                actual_folder_id = default_folder.id
            else:
                raise ValueError("Could not find or create default folder")

        logger.info(
            "Creating subscription by feed ID",
            feed_id=feed_id,
            folder_id=actual_folder_id,
            user_id=self.user_id,
        )

        # Check if the feed exists in the global feeds table
        from app.crud import crud_feed

        feed = await crud_feed.get_feed_by_id(self.db, feed_id=feed_id)
        if not feed:
            raise ValueError("Feed not found")

        # Check if user is already subscribed to this feed
        existing_subscription = await crud_subscription.get_subscription_by_feed_id(
            self.db, feed_id=feed_id, user_id=self.user_id
        )
        if existing_subscription:
            raise ValueError("Already subscribed to this feed")

        try:
            # Create subscription using the feed's URL
            subscription_in = SubscriptionCreate(
                url=str(feed.url),
                folder_id=actual_folder_id,
                custom_title=custom_title,
            )

            subscription_db = await crud_subscription.create_subscription(
                self.db,
                subscription_in=subscription_in,
                user_id=self.user_id,
                feed_data=None,  # Feed already exists
            )

            logger.info(
                "Subscription created successfully by feed ID",
                subscription_id=subscription_db.id,
                feed_id=feed_id,
            )
            return SubscriptionResponse.model_validate(subscription_db)

        except IntegrityError as e:
            logger.warning("Subscription already exists", feed_id=feed_id, user_id=self.user_id)
            raise ValueError("Subscription to feed already exists") from e
