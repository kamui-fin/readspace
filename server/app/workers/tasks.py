import asyncio  # Add asyncio import
from uuid import UUID

import structlog
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import NullPool

from app.core.celery_app import celery
from app.core.config import (
    get_settings,  # For DB URL if needed directly, or through AsyncSessionLocal
)
from app.crud import crud_feed

# AsyncSessionLocal is no longer imported directly from app.db.session for use in tasks
# from app.db.session import AsyncSessionLocal 
from app.services.rss_service import RssService

logger = structlog.get_logger(__name__)
settings = get_settings()

# It is crucial to ensure that your Celery worker setup (version, execution pool, startup command)
# correctly supports asyncio tasks. The error "Object of type coroutine is not JSON serializable"
# typically means the Celery worker did not await the async task function, and tried to serialize
# the coroutine object itself as the result.
# Ensure Celery version is 5.3+ for robust Python 3.12 asyncio support.

# Comment about Celery worker setup and asyncio remains relevant, 
# but using asyncio.run() is a workaround if direct async task handling is problematic.

@celery.task(name="app.workers.tasks.refresh_single_feed_task", bind=True, max_retries=3, default_retry_delay=60)
def refresh_single_feed_task(self, feed_id: str):
    """Celery task to refresh a single RSS feed."""
    async def _async_refresh_single_feed():
        engine = None  # Ensure engine is defined for finally block
        try:
            # Create a new engine and session factory for this task run
            # Using NullPool to avoid connection reuse issues across different event loops
            engine = create_async_engine(settings.SUPABASE_DB_CONNECTION, poolclass=NullPool)
            TaskAsyncSessionLocal = sessionmaker(
                bind=engine, class_=AsyncSession, autocommit=False, autoflush=False
            )
            logger.info("Starting refresh_single_feed_task", feed_id=feed_id)
            
            async with TaskAsyncSessionLocal() as db:
                feed_uuid = UUID(feed_id)
                feed_to_refresh = await crud_feed.get_feed_by_id_for_system(db, feed_id=feed_uuid)
                
                if not feed_to_refresh:
                    logger.warning("Feed not found in task, skipping refresh", feed_id=feed_id)
                    return None

                if not feed_to_refresh.user_id:
                    logger.error("User ID not found on feed, cannot refresh", feed_id=feed_id)
                    return None
                    
                rss_service = RssService(db=db, user_id=feed_to_refresh.user_id)
                await rss_service.refresh_feed(feed_id=feed_uuid)
                logger.info("Successfully refreshed feed via task", feed_id=feed_id)
            return None
        except Exception as exc:
            logger.error("Error in _async_refresh_single_feed", feed_id=feed_id, error=str(exc), exc_info=True)
            raise  # Re-raise to be caught by the outer sync function to call self.retry
        finally:
            if engine:
                await engine.dispose()
                logger.info("Task-specific engine disposed for refresh_single_feed_task", feed_id=feed_id)
    
    try:
        return asyncio.run(_async_refresh_single_feed())
    except Exception as exc:
        # self.request will only be populated if the task has been called
        # For retries, Celery expects the original exception that led to the retry call.
        if self.request.retries < (self.max_retries or 3): # Default to 3 if max_retries is None
            logger.info(f"Retrying refresh_single_feed_task, attempt {self.request.retries + 1}", feed_id=feed_id)
            raise self.retry(exc=exc, countdown=60 * (self.request.retries + 1))
        else:
            logger.error("Max retries reached for refresh_single_feed_task", feed_id=feed_id, error=str(exc), exc_info=True)
            # Optionally re-raise if you want Celery to mark it as FAILED after max retries
            raise

@celery.task(name="app.workers.tasks.schedule_all_feed_refreshes_task")
def schedule_all_feed_refreshes_task():
    """Celery Beat task to find feeds needing refresh and dispatch individual refresh tasks."""
    async def _async_schedule_all_feeds():
        engine = None # Ensure engine is defined for finally block
        try:
            # Create a new engine and session factory for this task run
            engine = create_async_engine(settings.SUPABASE_DB_CONNECTION, poolclass=NullPool)
            TaskAsyncSessionLocal = sessionmaker(
                bind=engine, class_=AsyncSession, autocommit=False, autoflush=False
            )
            logger.info("Starting schedule_all_feed_refreshes_task")
            
            async with TaskAsyncSessionLocal() as db:
                feeds_to_check = await crud_feed.get_feeds_needing_refresh(db, limit=200)
                
                logger.info(f"Found {len(feeds_to_check)} feeds to potentially refresh.")
                dispatched_count = 0
                for feed in feeds_to_check:
                    logger.info("Dispatching refresh task for feed", feed_id=feed.id, feed_url=feed.url)
                    refresh_single_feed_task.delay(str(feed.id))
                    dispatched_count += 1
                
                logger.info(f"Dispatched {dispatched_count} feed refresh tasks.")
            return None
        except Exception as e:
            logger.error("Error in _async_schedule_all_feeds", error=str(e), exc_info=True)
            raise # Re-raise to be handled by the outer sync function/Celery
        finally:
            if engine:
                await engine.dispose()
                logger.info("Task-specific engine disposed for schedule_all_feed_refreshes_task")

    return asyncio.run(_async_schedule_all_feeds())

# Example of how you might add a new CRUD method (conceptual)
# in crud_feed.py:
# def get_all_active_feeds(db: Session, limit: int = 1000):
#     return db.query(Feed).filter(Feed.is_active == True).order_by(Feed.last_fetched_at.asc().nulls_first()).limit(limit).all() # noqa
# Need to define is_active on Feed model or use another flag. 