"""Meilisearch service for feed CRUD operations."""

import structlog
from meilisearch import Client
from meilisearch.errors import MeilisearchApiError
from meilisearch.index import Index

from app.core.config import Settings
from app.models.feed import Feed

logger = structlog.get_logger(__name__)


class MeilisearchService:
    """Service for managing Meilisearch feed document operations (CRUD only)."""

    def __init__(self, settings: Settings):
        """
        Initialize the Meilisearch service.

        Args:
            settings: Application settings containing Meilisearch configuration

        Note:
            Index configuration (embedders, ranking rules, etc.) should be done
            via the migration script, not during runtime operations.
        """
        self.settings = settings
        self.client = Client(
            url=settings.MEILISEARCH_URL,
            api_key=settings.MEILISEARCH_MASTER_KEY.get_secret_value(),
        )
        self.index_name = settings.MEILISEARCH_INDEX_NAME
        self._index: Index | None = None

    def _get_index(self) -> Index:
        """
        Get or initialize the index reference.

        Returns:
            Index instance

        Raises:
            MeilisearchApiError: If index doesn't exist
        """
        if self._index is None:
            self._index = self.client.get_index(self.index_name)
        return self._index

    def _feed_to_document(self, feed: Feed) -> dict:
        """
        Convert a Feed model instance to a Meilisearch document.

        Args:
            feed: Feed model instance

        Returns:
            Dictionary representation suitable for Meilisearch indexing
        """
        # Ensure tags is a list of strings
        tags = feed.tags or []
        if tags and hasattr(tags, "tolist"):
            # Handle numpy array
            tags = tags.tolist()

        doc = {
            "id": str(feed.id),
            "url": feed.url,
            "title": feed.title,
            "description": feed.description,
            "link": feed.link,
            "language": feed.language,
            "image_url": feed.image_url,
            "tags": tags,  # Keep as array - Meilisearch supports arrays natively
            # Convert FeedCategory enum to string value
            "top_level_category": (feed.top_level_category.value if feed.top_level_category else None),
            "popularity_score": feed.popularity_score or 0.0,
        }

        return doc

    def add_feed(self, feed: Feed) -> None:
        """
        Add a single feed document to Meilisearch.

        Args:
            feed: Feed instance to add

        Note:
            This is fire-and-forget. Meilisearch handles indexing asynchronously.
        """
        try:
            index = self._get_index()
            document = self._feed_to_document(feed)
            task = index.add_documents([document])
            logger.debug("meilisearch_feed_added", feed_id=str(feed.id), task_uid=task.task_uid)
        except MeilisearchApiError as e:
            logger.error("meilisearch_add_feed_failed", feed_id=str(feed.id), error=str(e))
        except Exception as e:
            logger.error("meilisearch_add_feed_failed", feed_id=str(feed.id), error=str(e))

    def add_feeds_batch(self, feeds: list[Feed]) -> None:
        """
        Add multiple feeds in a single batch operation.

        Args:
            feeds: List of Feed instances to add

        Note:
            Meilisearch automatically handles batch indexing asynchronously.
        """
        if not feeds:
            return

        try:
            index = self._get_index()
            documents = [self._feed_to_document(feed) for feed in feeds]
            task = index.add_documents(documents)
            logger.info("meilisearch_batch_added", count=len(documents), task_uid=task.task_uid)
        except MeilisearchApiError as e:
            logger.error("meilisearch_batch_add_failed", count=len(feeds), error=str(e))
        except Exception as e:
            logger.error("meilisearch_batch_add_failed", count=len(feeds), error=str(e))

    def update_feed(self, feed: Feed) -> None:
        """
        Update an existing feed document in Meilisearch.

        Args:
            feed: Feed instance with updated data

        Note:
            In Meilisearch, add_documents with existing ID performs an update.
        """
        self.add_feed(feed)

    def delete_feed(self, feed_id: str) -> None:
        """
        Delete a feed document from Meilisearch.

        Args:
            feed_id: UUID of the feed to delete
        """
        try:
            index = self._get_index()
            task = index.delete_document(feed_id)
            logger.debug("meilisearch_feed_deleted", feed_id=feed_id, task_uid=task.task_uid)
        except MeilisearchApiError as e:
            logger.error("meilisearch_delete_feed_failed", feed_id=feed_id, error=str(e))
        except Exception as e:
            logger.error("meilisearch_delete_feed_failed", feed_id=feed_id, error=str(e))

    def health_check(self) -> bool:
        """
        Check if Meilisearch is healthy and accessible.

        Returns:
            True if healthy, False otherwise
        """
        try:
            health = self.client.health()
            if isinstance(health, dict):
                return health.get("status") == "available"
            return health.status == "available"
        except Exception as e:
            logger.error("meilisearch_health_check_failed", error=str(e))
            return False


# Singleton instance
_meilisearch_service: MeilisearchService | None = None


def get_meilisearch_service(settings: Settings) -> MeilisearchService:
    """
    Get the singleton Meilisearch service instance.

    Args:
        settings: Application settings

    Returns:
        MeilisearchService instance
    """
    global _meilisearch_service
    if _meilisearch_service is None:
        _meilisearch_service = MeilisearchService(settings)
    return _meilisearch_service
