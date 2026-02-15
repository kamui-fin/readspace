"""
Meilisearch integration module.
Handles search indexing for feeds using batch operations.

Follows REFACTOR.md principles:
- Pure functions with explicit dependencies
- Batch operations preferred over individual updates
- No business logic, just data transformation and indexing
"""

from collections.abc import Sequence
from typing import Any

import structlog
from meilisearch_python_sdk import AsyncClient

from app.core.config import Settings
from app.models.feed import Feed
from app.typing.feeds import MeilisearchFeedDocument

logger = structlog.get_logger(__name__)


def get_client(settings: Settings) -> AsyncClient:
    """Create a new Meilisearch async client.

    Note: Creates a new client each time to avoid event loop issues in tests.
    In production, the overhead is minimal as clients are lightweight.

    Args:
        settings: Application settings

    Returns:
        AsyncClient instance
    """
    return AsyncClient(
        url=settings.MEILISEARCH_URL,
        api_key=settings.MEILISEARCH_MASTER_KEY.get_secret_value(),
    )


def feed_to_document(feed: Feed | dict[str, Any]) -> dict[str, Any]:
    """Convert Feed ORM object or dict to Meilisearch document format.

    Pure function - no side effects, just data transformation.
    Uses Pydantic's from_attributes to handle ORM conversion.

    Args:
        feed: Feed ORM object or dict with feed data

    Returns:
        Dictionary in Meilisearch document format (via Pydantic model dump)
    """
    if isinstance(feed, Feed):
        # Pydantic can handle ORM objects directly with from_attributes=True
        # But we need to convert UUID to string and handle None tags
        doc = MeilisearchFeedDocument.model_validate(
            {
                "id": str(feed.id),
                "url": feed.url,
                "title": feed.title,
                "description": feed.description,
                "link": feed.link,
                "language": feed.language,
                "image_url": feed.image_url,
                "tags": feed.tags if feed.tags is not None else [],
                "tags_native": feed.tags_native if feed.tags_native is not None else [],
                "author": feed.author,
                "content_type": feed.content_type,
                "top_level_category": feed.top_level_category,
                "popularity_score": feed.popularity_score,
            }
        )
    else:
        # Handle dict input
        feed_dict = dict(feed)
        if "id" in feed_dict and not isinstance(feed_dict["id"], str):
            feed_dict["id"] = str(feed_dict["id"])
        if feed_dict.get("tags") is None:
            feed_dict["tags"] = []
        if feed_dict.get("tags_native") is None:
            feed_dict["tags_native"] = []
        doc = MeilisearchFeedDocument.model_validate(feed_dict)

    return doc.model_dump(mode="json")


async def sync_feed(settings: Settings, feed: Feed) -> None:
    """Sync a single feed to Meilisearch (fire-and-forget style).

    Uses update_documents which performs upsert operation.

    Args:
        settings: Application settings
        feed: Feed ORM object to sync
    """
    client = None
    try:
        client = get_client(settings)
        index = await client.get_index(settings.MEILISEARCH_INDEX_NAME)

        doc = feed_to_document(feed)
        await index.update_documents([doc])

        logger.debug("Synced feed to Meilisearch", feed_id=str(feed.id))
    except Exception as e:
        logger.warning("Meilisearch sync failed", feed_id=str(feed.id), error=str(e))
    finally:
        if client:
            await client.aclose()


async def sync_feeds_batch(
    settings: Settings,
    feeds: Sequence[Feed | dict[str, Any]],
) -> None:
    """Sync multiple feeds to Meilisearch using batch update operation.

    Uses update_documents which performs upsert (add or update) operation.

    Args:
        settings: Application settings
        feeds: List of Feed ORM objects or dicts with feed data
    """
    if not feeds:
        return

    client = None
    try:
        client = get_client(settings)
        index = await client.get_index(settings.MEILISEARCH_INDEX_NAME)

        # Convert feeds to documents (pure function)
        documents = [feed_to_document(feed) for feed in feeds]

        # Batch upsert using update_documents
        await index.update_documents(documents)

        logger.info("Synced feeds batch to Meilisearch", count=len(documents))
    except Exception as e:
        logger.error(
            "Meilisearch batch sync failed",
            count=len(feeds),
            error=str(e),
            exc_info=True,
        )
    finally:
        if client:
            await client.aclose()


async def delete_feed(settings: Settings, feed_id: str) -> None:
    """Delete a feed from Meilisearch index.

    Args:
        settings: Application settings
        feed_id: Feed ID as string
    """
    client = None
    try:
        client = get_client(settings)
        index = await client.get_index(settings.MEILISEARCH_INDEX_NAME)

        await index.delete_document(feed_id)

        logger.debug("Deleted feed from Meilisearch", feed_id=feed_id)
    except Exception as e:
        logger.warning("Meilisearch delete failed", feed_id=feed_id, error=str(e))
    finally:
        if client:
            await client.aclose()
