"""Meilisearch service for feed search and indexing."""

import structlog
from meilisearch import Client
from meilisearch.errors import MeilisearchApiError
from meilisearch.index import Index

from app.core.config import Settings
from app.models.feed import Feed

logger = structlog.get_logger(__name__)


class MeilisearchService:
    """Service for managing Meilisearch feed index operations."""

    def __init__(self, settings: Settings):
        """
        Initialize the Meilisearch service.

        Args:
            settings: Application settings containing Meilisearch configuration
        """
        self.settings = settings
        self.client = Client(
            url=settings.MEILISEARCH_URL,
            api_key=settings.MEILISEARCH_MASTER_KEY.get_secret_value(),
        )
        self.index_name = settings.MEILISEARCH_INDEX_NAME
        self._index: Index | None = None

    async def initialize_index(self) -> None:
        """
        Initialize and configure the Meilisearch index.

        Creates the index if it doesn't exist and applies the required settings
        for feed search including searchable attributes, filters, and ranking.
        """
        try:
            # Create or get existing index
            try:
                self._index = self.client.get_index(self.index_name)
                logger.info("meilisearch_index_found", index=self.index_name)
            except MeilisearchApiError as e:
                if "index_not_found" in str(e):
                    task = self.client.create_index(
                        self.index_name, {"primaryKey": "id"}
                    )
                    self.client.wait_for_task(task.task_uid)
                    self._index = self.client.get_index(self.index_name)
                    logger.info("meilisearch_index_created", index=self.index_name)
                else:
                    raise

            # Configure index settings
            settings_config = {
                # Fields that can be searched with full-text search
                "searchableAttributes": [
                    "title",
                    "description",
                    "tags",
                    "url",
                    "link",
                ],
                # Fields that can be used in filter expressions
                "filterableAttributes": [
                    "language",
                    "top_level_category",
                ],
                # Fields that can be used for sorting
                "sortableAttributes": [
                    "popularity_score",
                ],
                # Fields to return in search results
                "displayedAttributes": [
                    "id",
                    "url",
                    "title",
                    "description",
                    "link",
                    "language",
                    "image_url",
                    "tags",
                    "top_level_category",
                    "popularity_score",
                    "subscriber_count",
                ],
                # Ranking rules - order matters!
                # Custom rule: popularity_score:desc is added for feed ranking
                "rankingRules": [
                    "words",  # Number of matched query terms
                    "typo",  # Fewer typos = better rank
                    "proximity",  # Proximity of query terms
                    "attribute",  # Match in important attributes (title > desc)
                    "sort",  # Custom sort criterion
                    "exactness",  # Exact matches ranked higher
                    "popularity_score:desc",  # Custom: Popular feeds ranked higher
                ],
                # Enable typo tolerance for better search UX
                "typoTolerance": {
                    "enabled": True,
                    "minWordSizeForTypos": {
                        "oneTypo": 4,
                        "twoTypos": 8,
                    },
                },
                # Pagination settings
                "pagination": {
                    "maxTotalHits": 500,  # Limit total retrievable results
                },
                # Configure embedders for AI-powered search
                # Use Gemini REST API for automatic embedding generation with batch support
                "embedders": {
                    "default": {
                        "source": "rest",
                        "url": "https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:batchEmbedContents",
                        "dimensions": 768,
                        "documentTemplate": "{{doc.title}} {{doc.description}}",
                        "request": {
                            "requests": [
                                {
                                    "model": "models/gemini-embedding-001",
                                    "content": {"parts": [{"text": "{{text}}"}]},
                                    "outputDimensionality": 768,
                                },
                                "{{..}}",
                            ],
                        },
                        "response": {
                            "embeddings": [{"values": "{{embedding}}"}, "{{..}}"]
                        },
                        "headers": {"x-goog-api-key": self.settings.GEMINI_API_KEY},
                    }
                },
            }

            # Apply settings
            task = self._index.update_settings(settings_config)
            self.client.wait_for_task(task.task_uid)

            logger.info(
                "meilisearch_index_configured",
                index=self.index_name,
                settings=settings_config,
            )

        except Exception as e:
            logger.error("meilisearch_init_failed", error=str(e), exc_info=True)
            raise

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
            "top_level_category": (
                feed.top_level_category.value if feed.top_level_category else None
            ),
            "popularity_score": feed.popularity_score or 0.0,
        }

        return doc

    async def index_feed(self, feed: Feed) -> None:
        """
        Index a single feed in Meilisearch.

        Args:
            feed: Feed instance to index
        """
        if self._index is None:
            await self.initialize_index()

        try:
            document = self._feed_to_document(feed)
            task = self._index.add_documents([document])
            # Fire-and-forget: don't wait for indexing to complete
            logger.debug(
                "meilisearch_feed_indexed", feed_id=str(feed.id), task_uid=task.task_uid
            )
        except Exception as e:
            logger.error(
                "meilisearch_index_feed_failed", feed_id=str(feed.id), error=str(e)
            )
            # Don't raise - indexing failures shouldn't break the main flow

    async def index_feeds_batch(self, feeds: list[Feed]) -> None:
        """
        Index multiple feeds in a single batch operation.

        Args:
            feeds: List of Feed instances to index
        """
        if self._index is None:
            await self.initialize_index()

        if not feeds:
            return

        try:
            documents = [self._feed_to_document(feed) for feed in feeds]
            task = self._index.add_documents(documents)
            logger.info(
                "meilisearch_batch_indexed",
                count=len(documents),
                task_uid=task.task_uid,
            )
        except Exception as e:
            logger.error(
                "meilisearch_batch_index_failed", count=len(feeds), error=str(e)
            )

    async def update_feed(self, feed: Feed) -> None:
        """
        Update an existing feed document in Meilisearch.

        Args:
            feed: Feed instance with updated data
        """
        # In Meilisearch, add_documents also updates existing documents with same ID
        await self.index_feed(feed)

    async def delete_feed(self, feed_id: str) -> None:
        """
        Delete a feed document from Meilisearch.

        Args:
            feed_id: UUID of the feed to delete
        """
        if self._index is None:
            await self.initialize_index()

        try:
            task = self._index.delete_document(feed_id)
            logger.debug(
                "meilisearch_feed_deleted", feed_id=feed_id, task_uid=task.task_uid
            )
        except Exception as e:
            logger.error(
                "meilisearch_delete_feed_failed", feed_id=feed_id, error=str(e)
            )

    async def delete_all_feeds(self) -> None:
        """Delete all documents from the index (used for re-indexing)."""
        if self._index is None:
            await self.initialize_index()

        try:
            task = self._index.delete_all_documents()
            self.client.wait_for_task(task.task_uid)
            logger.info("meilisearch_all_feeds_deleted", index=self.index_name)
        except Exception as e:
            logger.error("meilisearch_delete_all_failed", error=str(e))
            raise

    async def get_index_stats(self) -> dict:
        """
        Get statistics about the Meilisearch index.

        Returns:
            Dictionary with index statistics (number of documents, indexing status, etc.)
        """
        if self._index is None:
            await self.initialize_index()

        try:
            stats = self._index.get_stats()
            return {
                "number_of_documents": stats.number_of_documents,
                "is_indexing": stats.is_indexing,
                "field_distribution": stats.field_distribution,
            }
        except Exception as e:
            logger.error("meilisearch_stats_failed", error=str(e))
            return {}

    async def health_check(self) -> bool:
        """
        Check if Meilisearch is healthy and accessible.

        Returns:
            True if healthy, False otherwise
        """
        try:
            health = self.client.health()
            # In newer versions, health() returns a dict
            if isinstance(health, dict):
                return health.get("status") == "available"
            # In older versions, it returns an object with .status attribute
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
