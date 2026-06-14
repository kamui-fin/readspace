"""Background favicon extraction worker operations."""

from uuid import UUID

import structlog

from app.core.config import get_settings
from app.crud.feed import core as feed_crud
from app.services.feeds.favicon import extract_favicon_and_canonical_url
from app.services.feeds.meilisearch import sync_feed
from app.workers.common import worker_db_factory

logger = structlog.get_logger(__name__)


async def fetch_feed_favicon(feed_id: UUID) -> None:
    """Fetch feed favicon in the background, update database and Meilisearch."""
    logger.info("Starting background favicon fetch", feed_id=str(feed_id))

    async with worker_db_factory() as db:
        feed = await feed_crud.get_feed_by_id(db, feed_id=feed_id)
        if not feed:
            logger.warning("Feed not found for background favicon fetch", feed_id=str(feed_id))
            return

        target_url = feed.link or str(feed.url)
        if target_url and target_url.startswith("newsletter://"):
            try:
                parts = target_url.replace("newsletter://", "").split("/")
                if len(parts) >= 2:
                    sender_email = parts[1]
                    if "@" in sender_email:
                        domain = sender_email.split("@")[1]
                        target_url = f"https://{domain}"
                    else:
                        target_url = None
                else:
                    target_url = None
            except Exception as e:
                logger.warning("Failed to parse newsletter URL for favicon extraction", url=target_url, error=str(e))
                target_url = None

        if not target_url:
            logger.warning("No URL found for favicon extraction", feed_id=str(feed_id))
            return

    # Call external library and download/upload to Supabase outside the DB transaction block
    try:
        favicon_result = await extract_favicon_and_canonical_url(target_url)
    except Exception as e:
        logger.warning(
            "Background favicon extraction failed",
            feed_id=str(feed_id),
            url=target_url,
            error=str(e),
        )
        return

    if not favicon_result.image_url:
        logger.info("No favicon found for feed", feed_id=str(feed_id), url=target_url)
        return

    # Update feed in the database
    async with worker_db_factory() as db:
        feed = await feed_crud.get_feed_by_id(db, feed_id=feed_id)
        if not feed:
            logger.warning("Feed not found when saving background favicon", feed_id=str(feed_id))
            return

        logger.info(
            "Found favicon, updating feed",
            feed_id=str(feed_id),
            image_url=favicon_result.image_url,
        )
        await feed_crud.update_feed(db, feed=feed, update_data={"image_url": favicon_result.image_url})

    # Sync the updated feed to Meilisearch
    try:
        async with worker_db_factory() as db:
            feed = await feed_crud.get_feed_by_id(db, feed_id=feed_id)
            if feed:
                await sync_feed(get_settings(), feed)
    except Exception as e:
        logger.warning(
            "Meilisearch sync failed for background favicon",
            feed_id=str(feed_id),
            error=str(e),
        )
