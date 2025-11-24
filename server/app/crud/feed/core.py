"""Basic CRUD operations for feeds.

Pure SQL operations only. No Redis caching or Meilisearch syncing.
Those concerns are handled by the service layer.
"""

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.feed import Feed
from app.schemas.feeds import FeedBase


async def get_feed_by_id(db: AsyncSession, *, feed_id: UUID) -> Feed | None:
    """Get a feed by ID from the global feeds table."""
    result = await db.execute(select(Feed).filter(Feed.id == feed_id))
    return result.scalars().first()


async def get_feed_by_url(db: AsyncSession, *, normalized_url: str) -> Feed | None:
    """Get a feed by normalized URL from the global feeds table.
    
    Caller must handle URL normalization before calling this function.
    """
    result = await db.execute(select(Feed).filter(Feed.url == normalized_url))
    return result.scalars().first()


async def create_feed(db: AsyncSession, *, feed_data: FeedBase) -> Feed:
    """Create a new global feed.
    
    Caller must handle:
    - Existence checks
    - URL normalization
    - Search index syncing
    """
    feed_dict = feed_data.model_dump(exclude_unset=True)
    
    # Ensure URL fields are strings
    for key in ["url", "link", "image_url"]:
        if key in feed_dict and feed_dict[key] is not None:
            feed_dict[key] = str(feed_dict[key])

    db_feed = Feed(**feed_dict)
    db.add(db_feed)
    await db.flush()
    await db.refresh(db_feed)

    return db_feed


async def update_feed(db: AsyncSession, *, feed: Feed) -> Feed:
    """Update an existing feed.
    
    Caller must handle search index syncing.
    """
    db.add(feed)
    await db.flush()
    await db.refresh(feed)
    return feed
