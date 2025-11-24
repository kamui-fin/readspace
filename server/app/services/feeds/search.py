"""
Meilisearch integration module.
Handles search indexing for feeds.
"""

import structlog
from typing import Optional
from meilisearch_python_sdk import AsyncClient

from app.core.config import Settings
from app.models.feed import Feed

logger = structlog.get_logger(__name__)

_client: Optional[AsyncClient] = None


def get_client(settings: Settings) -> AsyncClient:
    global _client
    if _client is None:
        _client = AsyncClient(
            url=settings.MEILISEARCH_URL,
            api_key=settings.MEILISEARCH_MASTER_KEY.get_secret_value(),
        )
    return _client


async def sync_feed(settings: Settings, feed: Feed) -> None:
    """
    Sync feed to Meilisearch (Fire-and-forget style).
    Operations: 'add', 'update'
    """
    try:
        client = get_client(settings)
        index = await client.get_index(settings.MEILISEARCH_INDEX_NAME)

        doc = _feed_to_document(feed)
        await index.add_documents([doc])

        logger.debug("Synced feed to Meilisearch", feed_id=str(feed.id))
    except Exception as e:
        logger.warning("Meilisearch sync failed", feed_id=str(feed.id), error=str(e))


def _feed_to_document(feed: Feed) -> dict:
    tags = feed.tags or []
    if hasattr(tags, "tolist"):
        tags = tags.tolist()

    return {
        "id": str(feed.id),
        "url": feed.url,
        "title": feed.title,
        "description": feed.description,
        "link": feed.link,
        "language": feed.language,
        "image_url": feed.image_url,
        "tags": tags,
        "top_level_category": (feed.top_level_category.value if feed.top_level_category else None),
        "popularity_score": feed.popularity_score or 0.0,
    }
