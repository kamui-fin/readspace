import asyncio  # Add asyncio import
from uuid import UUID
from typing import List, Optional

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

@celery.task(name="app.workers.tasks.import_single_feed_task", bind=True, max_retries=2, default_retry_delay=60)
def import_single_feed_task(self, user_id: str, feed_url: str, folder_id: str, tag_names: Optional[List[str]] = None, feed_title: Optional[str] = None):
    """Celery task to import a single feed."""
    async def _async_import_single_feed():
        engine = None
        try:
            engine = create_async_engine(settings.SUPABASE_DB_CONNECTION, poolclass=NullPool)
            TaskAsyncSessionLocal = sessionmaker(
                bind=engine, class_=AsyncSession, autocommit=False, autoflush=False, expire_on_commit=False
            )
            
            async with TaskAsyncSessionLocal() as db:
                user_uuid = UUID(user_id)
                folder_uuid = UUID(folder_id)
                rss_service = RssService(db=db, user_id=user_uuid)
                
                try:
                    await rss_service.add_new_feed(
                        url=feed_url,
                        folder_id=folder_uuid,
                        tag_names=tag_names or []
                    )
                    return {
                        "success": True,
                        "url": feed_url,
                        "title": feed_title or "Unknown",
                        "status": "imported"
                    }
                except ValueError as e:
                    # Feed already exists or other validation error
                    error_msg = str(e).lower()
                    if "already exists" in error_msg:
                        return {
                            "success": True,
                            "url": feed_url,
                            "title": feed_title or "Unknown",
                            "status": "already_exists"
                        }
                    elif any(phrase in error_msg for phrase in ["no valid articles", "appears to be broken", "no articles found"]):
                        return {
                            "success": False,
                            "url": feed_url,
                            "title": feed_title or "Unknown",
                            "status": "broken_feed",
                            "error": "Feed has no valid articles"
                        }
                    else:
                        return {
                            "success": False,
                            "url": feed_url,
                            "title": feed_title or "Unknown",
                            "status": "validation_error",
                            "error": str(e)
                        }
                except Exception as e:
                    error_str = str(e).lower()
                    
                    # Improved error categorization
                    if any(code in error_str for code in ['404', '410']):
                        status = "broken_feed"
                    elif any(code in error_str for code in ['403', '401', '429']):
                        status = "broken_feed"
                    elif any(term in error_str for term in ['timeout', 'timed out']):
                        status = "timeout"
                    elif any(term in error_str for term in ['connection', 'network', 'dns', 'name resolution', 'no address']):
                        status = "network_error"
                    elif any(term in error_str for term in ['parse', 'xml', 'encoding', 'not well-formed']):
                        status = "broken_feed"
                    elif "greenlet" in error_str:
                        status = "unknown_error"
                    else:
                        status = "unknown_error"
                    
                    return {
                        "success": False,
                        "url": feed_url,
                        "title": feed_title or "Unknown",
                        "status": status,
                        "error": str(e)
                    }
                    
        except Exception as exc:
            raise
        finally:
            if engine:
                await engine.dispose()
    
    try:
        return asyncio.run(_async_import_single_feed())
    except Exception as exc:
        if self.request.retries < (self.max_retries or 2):
            logger.info(f"Retrying import_single_feed_task, attempt {self.request.retries + 1}", user_id=user_id, feed_url=feed_url)
            raise self.retry(exc=exc, countdown=60 * (self.request.retries + 1))
        else:
            logger.error("Max retries reached for import_single_feed_task", user_id=user_id, feed_url=feed_url, error=str(exc), exc_info=True)
            # Return failure result instead of raising
            return {
                "success": False,
                "url": feed_url,
                "title": feed_title or "Unknown",
                "status": "task_failed",
                "error": str(exc)
            }

@celery.task(name="app.workers.tasks.import_opml_task", bind=True, max_retries=1, default_retry_delay=300)
def import_opml_task(self, user_id: str, opml_content: str, default_folder_name: str = "Imported Feeds"):
    """Celery task to orchestrate OPML import by queuing individual feed import tasks."""
    async def _async_import_opml():
        engine = None
        try:
            engine = create_async_engine(settings.SUPABASE_DB_CONNECTION, poolclass=NullPool)
            TaskAsyncSessionLocal = sessionmaker(
                bind=engine, class_=AsyncSession, autocommit=False, autoflush=False, expire_on_commit=False
            )
            logger.info("Starting OPML import orchestration task", user_id=user_id)
            
            async with TaskAsyncSessionLocal() as db:
                user_uuid = UUID(user_id)
                rss_service = RssService(db=db, user_id=user_uuid)
                
                # Extract feeds from OPML and queue individual import tasks
                feeds_data = await rss_service.extract_feeds_from_opml(
                    opml_content=opml_content,
                    default_folder_name=default_folder_name
                )
                
                total_feeds = len(feeds_data)
                logger.info(f"Extracted {total_feeds} feeds from OPML, queuing import tasks", user_id=user_id)
                
                # Queue individual feed import tasks
                task_ids = []
                for feed_data in feeds_data:
                    task = import_single_feed_task.delay(
                        user_id=user_id,
                        feed_url=feed_data["url"],
                        folder_id=str(feed_data["folder_id"]),
                        tag_names=feed_data["tag_names"],
                        feed_title=feed_data["title"]
                    )
                    task_ids.append(task.id)
                
                logger.info(f"Queued {len(task_ids)} feed import tasks", user_id=user_id)
                
                # Return orchestration result
                return {
                    "total_feeds": total_feeds,
                    "queued_tasks": len(task_ids),
                    "task_ids": task_ids,
                    "status": "tasks_queued"
                }
                
        except Exception as exc:
            logger.error("Error in OPML import orchestration task", user_id=user_id, error=str(exc), exc_info=True)
            raise
        # finally:
        #     if engine:
        #         await engine.dispose()
        #         logger.info("Task-specific engine disposed for import_opml_task", user_id=user_id)
    
    try:
        return asyncio.run(_async_import_opml())
    except Exception as exc:
        if self.request.retries < (self.max_retries or 1):
            logger.info(f"Retrying OPML import task, attempt {self.request.retries + 1}", user_id=user_id)
            raise self.retry(exc=exc, countdown=300)
        else:
            logger.error("Max retries reached for OPML import task", user_id=user_id, error=str(exc), exc_info=True)
            raise



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
    
    try:
        return asyncio.run(_async_refresh_single_feed())
    except Exception as exc:
        if self.request.retries < (self.max_retries or 3):
            logger.info(f"Retrying refresh_single_feed_task, attempt {self.request.retries + 1}", feed_id=feed_id)
            raise self.retry(exc=exc, countdown=60 * (self.request.retries + 1))
        else:
            logger.error("Max retries reached for refresh_single_feed_task", feed_id=feed_id, error=str(exc), exc_info=True)
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