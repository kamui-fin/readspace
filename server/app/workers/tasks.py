import asyncio  # Add asyncio import
from uuid import UUID

import structlog
from celery import group
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

logger = structlog.get_logger(__name__)
settings = get_settings()


async def create_task_db_session():
    """Create a database session for Celery tasks."""
    engine = create_async_engine(
        settings.SUPABASE_DB_CONNECTION,
        poolclass=NullPool,
    )
    TaskAsyncSessionLocal = sessionmaker(
        bind=engine,
        class_=AsyncSession,
        autocommit=False,
        autoflush=False,
        expire_on_commit=False,
    )
    return engine, TaskAsyncSessionLocal


async def queue_feed_refresh_tasks(feeds: list, task_name: str) -> dict:
    """Queue refresh tasks for a list of feeds using bulk operations with Celery groups."""
    if not feeds:
        return {
            "total_feeds": 0,
            "queued_tasks": 0,
            "task_ids": [],
            "status": "no_feeds_found",
        }

    total_feeds = len(feeds)
    logger.info(f"Bulk queuing {total_feeds} feed refresh tasks for {task_name}")

    # Use Celery group for efficient bulk task queuing
    feed_ids = [str(feed.id) for feed in feeds]

    # Create a group of tasks - this is more efficient than individual .delay() calls
    task_group = group(refresh_single_feed_task.s(feed_id) for feed_id in feed_ids)
    group_result = task_group.apply_async()

    # Extract task IDs from the group result
    task_ids = [result.task_id for result in group_result.results]

    logger.info(
        f"Successfully bulk queued {len(task_ids)} feed refresh tasks for {task_name} using Celery group"
    )

    return {
        "total_feeds": total_feeds,
        "queued_tasks": len(task_ids),
        "task_ids": task_ids,
        "status": "tasks_queued",
    }


@celery.task(
    name="app.workers.tasks.import_single_feed_task",
    bind=True,
    max_retries=2,
    default_retry_delay=60,
)
def import_single_feed_task(
    self,
    user_id: str,
    feed_url: str,
    folder_id: str,
    tag_names: list[str] | None = None,
    feed_title: str | None = None,
    update_existing: bool = False,
):
    """Celery task to import a single feed."""

    async def _async_import_single_feed():
        # Check if task was revoked before starting work
        if hasattr(self.request, "is_revoked") and self.request.is_revoked():
            return {
                "success": False,
                "url": feed_url,
                "title": feed_title or "Unknown",
                "status": "cancelled",
                "error": "Task was cancelled by user",
            }

        engine, TaskAsyncSessionLocal = await create_task_db_session()
        try:
            async with TaskAsyncSessionLocal() as db:
                user_uuid = UUID(user_id)
                from app.services.rss_orchestration_service import (
                    RssOrchestrationService,
                )

                rss_service = RssOrchestrationService(db=db, user_id=user_uuid)

                # Use the refactored service method
                return await rss_service.import_single_feed(
                    feed_url=feed_url,
                    folder_id=folder_id,
                    tag_names=tag_names,
                    feed_title=feed_title,
                    update_existing=update_existing,
                )

        except Exception:
            raise
        finally:
            if engine:
                await engine.dispose()

    try:
        return asyncio.run(_async_import_single_feed())
    except Exception as exc:
        # Check if task was revoked/cancelled
        if hasattr(self.request, "is_revoked") and self.request.is_revoked():
            logger.info(
                "import_single_feed_task was cancelled",
                user_id=user_id,
                feed_url=feed_url,
            )
            return {
                "success": False,
                "url": feed_url,
                "title": feed_title or "Unknown",
                "status": "cancelled",
                "error": "Task was cancelled by user",
            }

        if self.request.retries < (self.max_retries or 2):
            logger.info(
                f"Retrying import_single_feed_task, attempt {self.request.retries + 1}",
                user_id=user_id,
                feed_url=feed_url,
            )
            raise self.retry(exc=exc, countdown=60 * (self.request.retries + 1))
        else:
            logger.error(
                "Max retries reached for import_single_feed_task",
                user_id=user_id,
                feed_url=feed_url,
                error=str(exc),
                exc_info=True,
            )
            # Return failure result instead of raising
            return {
                "success": False,
                "url": feed_url,
                "title": feed_title or "Unknown",
                "status": "task_failed",
                "error": str(exc),
            }


@celery.task(
    name="app.workers.tasks.import_opml_task",
    bind=True,
    max_retries=1,
    default_retry_delay=300,
)
def import_opml_task(
    self, user_id: str, opml_content: str, default_folder_name: str = "Imported Feeds"
):
    """Celery task to orchestrate OPML import by queuing individual feed import tasks."""

    async def _async_import_opml():
        # Check if task was revoked before starting work
        if hasattr(self.request, "is_revoked") and self.request.is_revoked():
            logger.info(
                "OPML import task was cancelled before starting", user_id=user_id
            )
            raise Exception("Task was cancelled by user")

        engine, TaskAsyncSessionLocal = await create_task_db_session()
        try:
            logger.info("Starting OPML import orchestration task", user_id=user_id)

            async with TaskAsyncSessionLocal() as db:
                user_uuid = UUID(user_id)
                from app.services.rss_orchestration_service import (
                    RssOrchestrationService,
                )

                rss_service = RssOrchestrationService(db=db, user_id=user_uuid)

                # Use the refactored service method
                result = await rss_service.process_opml_import(
                    opml_content=opml_content, default_folder_name=default_folder_name
                )

                logger.info(
                    f"Bulk queued {result['queued_tasks']} feed import tasks",
                    user_id=user_id,
                )

                return result

        except Exception as exc:
            logger.error(
                "Error in OPML import orchestration task",
                user_id=user_id,
                error=str(exc),
                exc_info=True,
            )
            raise
        finally:
            if engine:
                await engine.dispose()

    try:
        return asyncio.run(_async_import_opml())
    except Exception as exc:
        # Check if task was revoked/cancelled
        if hasattr(self.request, "is_revoked") and self.request.is_revoked():
            logger.info(
                "import_opml_task was cancelled",
                user_id=user_id,
            )
            raise exc  # Let it fail, cleanup will be handled by the API endpoint

        if self.request.retries < (self.max_retries or 1):
            logger.info(
                f"Retrying OPML import task, attempt {self.request.retries + 1}",
                user_id=user_id,
            )
            raise self.retry(exc=exc, countdown=300)
        else:
            logger.error(
                "Max retries reached for OPML import task",
                user_id=user_id,
                error=str(exc),
                exc_info=True,
            )
            raise


@celery.task(
    name="app.workers.tasks.refresh_single_feed_task",
    bind=True,
    max_retries=3,
    default_retry_delay=60,
)
def refresh_single_feed_task(self, feed_id: str):
    """Celery task to refresh a single global RSS feed."""

    async def _async_refresh_single_feed():
        engine, TaskAsyncSessionLocal = await create_task_db_session()
        try:
            logger.info(
                "Starting refresh_single_feed_task (new version)", feed_id=feed_id
            )

            async with TaskAsyncSessionLocal() as db:
                from app.services.feed_service import FeedService

                feed_uuid = UUID(feed_id)
                feed_service = FeedService(db=db)

                # Get the global feed
                feed_to_refresh = await feed_service.get_feed_by_id(feed_id=feed_uuid)

                if not feed_to_refresh:
                    logger.warning(
                        "Global feed not found in task, skipping refresh",
                        feed_id=feed_id,
                    )
                    return None

                # Refresh the global feed (will create articles for all subscribers)
                await feed_service.refresh_feed(feed_id=feed_uuid)
                logger.info(
                    "Successfully refreshed global feed via task", feed_id=feed_id
                )
            return None
        except Exception as exc:
            logger.error(
                "Error in _async_refresh_single_feed (new version)",
                feed_id=feed_id,
                error=str(exc),
                exc_info=True,
            )
            raise  # Re-raise to be caught by the outer sync function to call self.retry
        finally:
            if engine:
                await engine.dispose()

    try:
        return asyncio.run(_async_refresh_single_feed())
    except Exception as exc:
        # Categorize errors for better user feedback
        error_str = str(exc).lower()
        if "dataerror" in error_str or "invalid input for query argument" in error_str:
            # SQL type conversion error - usually from malformed feed data
            logger.error(
                "SQL type conversion error for refresh_single_feed_task",
                feed_id=feed_id,
                error=str(exc),
            )
            if self.request.retries < (self.max_retries or 3):
                logger.info(
                    f"Retrying refresh_single_feed_task after SQL error, attempt {self.request.retries + 1}",
                    feed_id=feed_id,
                )
                raise self.retry(exc=exc, countdown=60 * (self.request.retries + 1))
            else:
                logger.error(
                    "Max retries reached for refresh_single_feed_task with SQL error",
                    feed_id=feed_id,
                    error=str(exc),
                )
                raise ConnectionError(
                    "Feed data contains invalid types that cannot be processed"
                ) from exc
        elif "timeout" in error_str or "timed out" in error_str:
            # Timeout error
            raise ConnectionError("Feed timed out during refresh") from exc
        elif "connection" in error_str:
            # Connection error
            raise ConnectionError("Connection failed during feed refresh") from exc
        else:
            # Other errors - retry as normal
            if self.request.retries < (self.max_retries or 3):
                logger.info(
                    f"Retrying refresh_single_feed_task, attempt {self.request.retries + 1}",
                    feed_id=feed_id,
                )
                raise self.retry(exc=exc, countdown=60 * (self.request.retries + 1))
            else:
                logger.error(
                    "Max retries reached for refresh_single_feed_task",
                    feed_id=feed_id,
                    error=str(exc),
                    exc_info=True,
                )
                raise


@celery.task(
    name="app.workers.tasks.refresh_folder_feeds_task",
    bind=True,
    max_retries=1,
    default_retry_delay=60,
)
def refresh_folder_feeds_task(self, user_id: str, folder_id: str):
    """Celery task to refresh all feeds in a specific folder."""

    async def _async_refresh_folder_feeds():
        engine, TaskAsyncSessionLocal = await create_task_db_session()
        try:
            logger.info(
                "Starting refresh_folder_feeds_task",
                user_id=user_id,
                folder_id=folder_id,
            )

            async with TaskAsyncSessionLocal() as db:
                user_uuid = UUID(user_id)
                folder_uuid = UUID(folder_id)
                feeds_tuples = await crud_feed.get_feeds_by_user(
                    db, user_id=user_uuid, folder_id=folder_uuid
                )
                feeds = [
                    feed for feed, subscription in feeds_tuples
                ]  # Extract Feed objects
                return await queue_feed_refresh_tasks(feeds, f"folder {folder_id}")

        except Exception as exc:
            logger.error(
                "Error in refresh_folder_feeds_task",
                user_id=user_id,
                folder_id=folder_id,
                error=str(exc),
                exc_info=True,
            )
            raise
        finally:
            if engine:
                await engine.dispose()

    try:
        return asyncio.run(_async_refresh_folder_feeds())
    except Exception as exc:
        if self.request.retries < (self.max_retries or 1):
            logger.info(
                f"Retrying refresh_folder_feeds_task, attempt {self.request.retries + 1}",
                user_id=user_id,
                folder_id=folder_id,
            )
            raise self.retry(exc=exc, countdown=60)
        else:
            logger.error(
                "Max retries reached for refresh_folder_feeds_task",
                user_id=user_id,
                folder_id=folder_id,
                error=str(exc),
                exc_info=True,
            )
            raise


@celery.task(
    name="app.workers.tasks.refresh_all_user_feeds_task",
    bind=True,
    max_retries=1,
    default_retry_delay=60,
)
def refresh_all_user_feeds_task(self, user_id: str):
    """Celery task to refresh all feeds for a specific user."""

    async def _async_refresh_all_user_feeds():
        engine, TaskAsyncSessionLocal = await create_task_db_session()
        try:
            logger.info("Starting refresh_all_user_feeds_task", user_id=user_id)

            async with TaskAsyncSessionLocal() as db:
                user_uuid = UUID(user_id)
                feeds_tuples = await crud_feed.get_feeds_by_user(db, user_id=user_uuid)
                feeds = [
                    feed for feed, subscription in feeds_tuples
                ]  # Extract Feed objects
                return await queue_feed_refresh_tasks(feeds, "all user feeds")

        except Exception as exc:
            logger.error(
                "Error in refresh_all_user_feeds_task",
                user_id=user_id,
                error=str(exc),
                exc_info=True,
            )
            raise
        finally:
            if engine:
                await engine.dispose()

    try:
        return asyncio.run(_async_refresh_all_user_feeds())
    except Exception as exc:
        if self.request.retries < (self.max_retries or 1):
            logger.info(
                f"Retrying refresh_all_user_feeds_task, attempt {self.request.retries + 1}",
                user_id=user_id,
            )
            raise self.retry(exc=exc, countdown=60)
        else:
            logger.error(
                "Max retries reached for refresh_all_user_feeds_task",
                user_id=user_id,
                error=str(exc),
                exc_info=True,
            )
            raise


@celery.task(name="app.workers.tasks.schedule_all_feed_refreshes_task")
def schedule_all_feed_refreshes_task():
    """Celery Beat task to find global feeds needing refresh and dispatch individual refresh tasks."""

    async def _async_schedule_all_feeds():
        engine, TaskAsyncSessionLocal = await create_task_db_session()
        try:
            logger.info("Starting schedule_all_feed_refreshes_task (new version)")

            async with TaskAsyncSessionLocal() as db:
                from app.services.feed_service import FeedService

                feed_service = FeedService(db=db)
                feeds_to_check = await feed_service.get_feeds_needing_refresh(limit=200)

                logger.info(
                    f"Found {len(feeds_to_check)} global feeds to potentially refresh."
                )

                # Bulk queue all refresh tasks at once for better performance
                if feeds_to_check:
                    feed_ids = [str(feed.id) for feed in feeds_to_check]
                    tasks = [
                        refresh_single_feed_task.delay(feed_id) for feed_id in feed_ids
                    ]
                    dispatched_count = len(tasks)

                    # Log efficiency metrics
                    logger.info(
                        f"Bulk dispatched {dispatched_count} global feed refresh tasks"
                    )
                else:
                    dispatched_count = 0
            return None
        except Exception as e:
            logger.error(
                "Error in _async_schedule_all_feeds (new version)",
                error=str(e),
                exc_info=True,
            )
            raise  # Re-raise to be handled by the outer sync function/Celery
        finally:
            if engine:
                await engine.dispose()
                logger.info(
                    "Task-specific engine disposed for schedule_all_feed_refreshes_task"
                )

    return asyncio.run(_async_schedule_all_feeds())


# Example of how you might add a new CRUD method (conceptual)
# in crud_feed.py:
# def get_all_active_feeds(db: Session, limit: int = 1000):
#     return db.query(Feed).filter(Feed.is_active == True).order_by(Feed.last_fetched_at.asc().nulls_first()).limit(limit).all() # noqa
# Need to define is_active on Feed model or use another flag.
