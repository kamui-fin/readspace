from uuid import UUID

import structlog
from app.core.celery_app import celery
from app.core.config import (
    get_settings,  # For DB URL if needed directly, or through SessionLocal
)
from app.crud import crud_feed
from app.db.session import SessionLocal  # To create a new DB session for each task
from app.services.rss_service import RssService

logger = structlog.get_logger(__name__)
settings = get_settings()

@celery.task(name="app.workers.tasks.refresh_single_feed_task", bind=True, max_retries=3, default_retry_delay=60)
async def refresh_single_feed_task(self, feed_id: str):
    """Celery task to refresh a single RSS feed."""
    logger.info("Starting refresh_single_feed_task", feed_id=feed_id)
    try:
        feed_uuid = UUID(feed_id)
        
        async with SessionLocal() as db: # Use async context manager
            # Use the new CRUD method that doesn't require user_id for system tasks
            feed_to_refresh = await crud_feed.get_feed_by_id_for_system(db, feed_id=feed_uuid)
            
            if not feed_to_refresh:
                logger.warning("Feed not found in task, skipping refresh", feed_id=feed_id)
                return

            if not feed_to_refresh.user_id: # Should always exist if feed is found
                logger.error("User ID not found on feed, cannot refresh", feed_id=feed_id)
                return
                
            rss_service = RssService(db=db, user_id=feed_to_refresh.user_id)
            await rss_service.refresh_feed(feed_id=feed_uuid)
            logger.info("Successfully refreshed feed via task", feed_id=feed_id)

    except Exception as exc:
        logger.error("Error in refresh_single_feed_task", feed_id=feed_id, error=str(exc), exc_info=True)
        raise self.retry(exc=exc, countdown=60 * (self.request.retries + 1))
    # No finally db.close() needed with "async with"

@celery.task(name="app.workers.tasks.schedule_all_feed_refreshes_task")
async def schedule_all_feed_refreshes_task():
    """Celery Beat task to find feeds needing refresh and dispatch individual refresh tasks."""
    logger.info("Starting schedule_all_feed_refreshes_task")
    try:
        async with SessionLocal() as db: # Use async context manager
            feeds_to_check = await crud_feed.get_feeds_needing_refresh(db, limit=200)
            
            logger.info(f"Found {len(feeds_to_check)} feeds to potentially refresh based on get_feeds_needing_refresh logic.")
            dispatched_count = 0
            for feed in feeds_to_check:
                logger.info("Dispatching refresh task for feed", feed_id=feed.id, feed_url=feed.url)
                refresh_single_feed_task.delay(str(feed.id))
                dispatched_count += 1
            
            logger.info(f"Dispatched {dispatched_count} feed refresh tasks.")

    except Exception as e:
        logger.error("Error in schedule_all_feed_refreshes_task", error=str(e), exc_info=True)
    # No finally db.close() needed with "async with"

# Example of how you might add a new CRUD method (conceptual)
# in crud_feed.py:
# def get_all_active_feeds(db: Session, limit: int = 1000):
#     return db.query(Feed).filter(Feed.is_active == True).order_by(Feed.last_fetched_at.asc().nulls_first()).limit(limit).all() # noqa
# Need to define is_active on Feed model or use another flag. 