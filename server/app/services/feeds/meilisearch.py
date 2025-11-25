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

logger = structlog.get_logger(__name__)

_client: AsyncClient | None = None


def get_client(settings: Settings) -> AsyncClient:
    """Get or create Meilisearch async client (singleton pattern).

    Args:
        settings: Application settings

    Returns:
        AsyncClient instance
    """
    global _client
    if _client is None:
        _client = AsyncClient(
            url=settings.MEILISEARCH_URL,
            api_key=settings.MEILISEARCH_MASTER_KEY.get_secret_value(),
        )
    return _client


def feed_to_document(feed: Feed | dict[str, Any]) -> dict[str, Any]:
    """Convert Feed ORM object or dict to Meilisearch document format.

    Pure function - no side effects, just data transformation.

    Args:
        feed: Feed ORM object or dict with feed data

    Returns:
        Dictionary in Meilisearch document format
    """
    if isinstance(feed, Feed):
        tags = feed.tags or []
        # SQLAlchemy SQLEnum returns the enum value (string) when accessed
        # So feed.top_level_category is already a string, not an enum object
        top_level_category = feed.top_level_category

        return {
            "id": str(feed.id),
            "url": feed.url,
            "title": feed.title,
            "description": feed.description,
            "link": feed.link,
            "language": feed.language,
            "image_url": feed.image_url,
            "tags": tags,
            "top_level_category": top_level_category,
            "popularity_score": feed.popularity_score or 0.0,
        }
    else:
        # Handle dict input (from enrichment snapshots)
        tags = feed.get("tags") or []
        top_level_category = feed.get("top_level_category")
        if top_level_category is not None:
            if isinstance(top_level_category, str):
                # Already a string value
                pass
            elif hasattr(top_level_category, "value"):
                # Enum object
                top_level_category = top_level_category.value
        else:
            top_level_category = None

        return {
            "id": str(feed["id"]),
            "url": feed.get("url", ""),
            "title": feed.get("title", "Unknown Feed"),
            "description": feed.get("description", ""),
            "link": feed.get("link"),
            "language": feed.get("language"),
            "image_url": feed.get("image_url"),
            "tags": tags,
            "top_level_category": top_level_category,
            "popularity_score": feed.get("popularity_score", 0.0),
        }


async def sync_feed(settings: Settings, feed: Feed) -> None:
    """Sync a single feed to Meilisearch (fire-and-forget style).

    Uses update_documents which performs upsert operation.

    Args:
        settings: Application settings
        feed: Feed ORM object to sync
    """
    try:
        client = get_client(settings)
        index = await client.get_index(settings.MEILISEARCH_INDEX_NAME)

        doc = feed_to_document(feed)
        await index.update_documents([doc])

        logger.debug("Synced feed to Meilisearch", feed_id=str(feed.id))
    except Exception as e:
        logger.warning("Meilisearch sync failed", feed_id=str(feed.id), error=str(e))


async def sync_feeds_batch(
    settings: Settings,
    feeds: Sequence[Feed | dict[str, Any]],
) -> None:
    """Sync multiple feeds to Meilisearch using batch update operation.

    Uses update_documents which performs upsert (add or update) operation.
    This is the preferred method for batch operations per REFACTOR.md.

    Args:
        settings: Application settings
        feeds: List of Feed ORM objects or dicts with feed data
    """
    if not feeds:
        return

    try:
        client = get_client(settings)
        index = await client.get_index(settings.MEILISEARCH_INDEX_NAME)

        # Convert feeds to documents (pure function)
        documents = [feed_to_document(feed) for feed in feeds]

        # Batch upsert using update_documents
        await index.update_documents(documents)

        logger.info("Synced feeds batch to Meilisearch", count=len(documents))
    except Exception as e:
        logger.error("Meilisearch batch sync failed", count=len(feeds), error=str(e), exc_info=True)


async def delete_feed(settings: Settings, feed_id: str) -> None:
    """Delete a feed from Meilisearch index.

    Args:
        settings: Application settings
        feed_id: Feed ID as string
    """
    try:
        client = get_client(settings)
        index = await client.get_index(settings.MEILISEARCH_INDEX_NAME)

        await index.delete_document(feed_id)

        logger.debug("Deleted feed from Meilisearch", feed_id=feed_id)
    except Exception as e:
        logger.warning("Meilisearch delete failed", feed_id=feed_id, error=str(e))
