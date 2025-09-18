import asyncio  # Add asyncio import
from typing import Any
from uuid import UUID

import structlog
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.core.celery_app import celery
from app.core.config import get_settings

logger = structlog.get_logger(__name__)
settings = get_settings()


async def create_task_db_session() -> tuple[AsyncEngine, async_sessionmaker[AsyncSession]]:
    """Create a database session for Celery tasks."""
    engine = create_async_engine(
        settings.SUPABASE_DB_CONNECTION,
        poolclass=NullPool,
    )
    task_async_session_local = async_sessionmaker(
        engine,
        class_=AsyncSession,
        autoflush=False,
        expire_on_commit=False,
    )
    return engine, task_async_session_local


@celery.task(
    name="app.workers.tasks.import_single_feed_task",
    bind=True,
    max_retries=2,
    default_retry_delay=60,
)
def import_single_feed_task(
    self: Any,
    user_id: str,
    feed_url: str,
    folder_id: str,
    tag_names: list[str] | None = None,
    feed_title: str | None = None,
    update_existing: bool = False,
) -> dict[str, Any]:
    """Celery task to import a single feed."""

    async def _async_import_single_feed() -> dict[str, Any]:
        # Check if task was revoked before starting work
        if hasattr(self.request, "is_revoked") and self.request.is_revoked():
            return {
                "success": False,
                "url": feed_url,
                "title": feed_title or "Unknown",
                "status": "cancelled",
                "error": "Task was cancelled by user",
            }

        engine, task_async_session_local = await create_task_db_session()
        try:
            async with task_async_session_local() as db:
                user_uuid = UUID(user_id)
                from app.services.rss_service import (
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
            raise self.retry(exc=exc, countdown=60 * (self.request.retries + 1)) from exc
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
    max_retries=0,  # No retries for OPML imports - fail immediately
    default_retry_delay=300,
)
def import_opml_task(
    self: Any, user_id: str, opml_content: str, default_folder_name: str = "Imported Feeds"
) -> dict[str, Any]:
    """Celery task to orchestrate OPML import by queuing individual feed import tasks."""

    async def _async_import_opml() -> dict[str, Any]:
        # Check if task was revoked before starting work
        if hasattr(self.request, "is_revoked") and self.request.is_revoked():
            logger.info("OPML import task was cancelled before starting", user_id=user_id)
            raise Exception("Task was cancelled by user")

        engine, task_async_session_local = await create_task_db_session()
        try:
            logger.info("Starting OPML import orchestration task", user_id=user_id)

            async with task_async_session_local() as db:
                user_uuid = UUID(user_id)
                from app.services.rss_service import (
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

        # No retries for OPML import tasks - fail immediately
        logger.error(
            "OPML import task failed",
            user_id=user_id,
            error=str(exc),
            exc_info=True,
        )
        raise exc


@celery.task(
    name="app.workers.tasks.refresh_single_feed_task",
    bind=True,
    max_retries=2,
    default_retry_delay=30,
)
def refresh_single_feed_task(self: Any, feed_id: str) -> None:
    """Celery task to refresh a single global RSS feed."""

    async def _async_refresh_single_feed() -> None:
        engine, task_async_session_local = await create_task_db_session()
        try:
            logger.info("Starting refresh_single_feed_task", feed_id=feed_id)

            async with task_async_session_local() as db:
                from app.services.feed_service import FeedService

                feed_uuid = UUID(feed_id)
                feed_service = FeedService(db=db)

                # Refresh the global feed (will create articles for all subscribers)
                await feed_service.refresh_feed(feed_id=feed_uuid)
                logger.info("Successfully refreshed global feed via task", feed_id=feed_id)
            return None
        except Exception as exc:
            logger.error(
                "Error in _async_refresh_single_feed",
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
                raise self.retry(exc=exc, countdown=60 * (self.request.retries + 1)) from exc
            else:
                logger.error(
                    "Max retries reached for refresh_single_feed_task with SQL error",
                    feed_id=feed_id,
                    error=str(exc),
                )
                raise ConnectionError("Feed data contains invalid types that cannot be processed") from exc
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
                raise self.retry(exc=exc, countdown=60 * (self.request.retries + 1)) from exc
            else:
                logger.error(
                    "Max retries reached for refresh_single_feed_task",
                    feed_id=feed_id,
                    error=str(exc),
                    exc_info=True,
                )
                raise


@celery.task(name="app.workers.tasks.schedule_all_feed_refreshes_task")
def schedule_all_feed_refreshes_task() -> None:
    """Celery Beat task to find global feeds needing refresh and dispatch individual refresh tasks."""

    async def _async_schedule_all_feeds() -> None:
        engine, task_async_session_local = await create_task_db_session()
        try:
            logger.info("Starting schedule_all_feed_refreshes_task (new version)")

            async with task_async_session_local() as db:
                from app.services.feed_service import FeedService

                feed_service = FeedService(db=db)
                feeds_to_check = await feed_service.get_feeds_needing_refresh(limit=1000)

                logger.info(f"Found {len(feeds_to_check)} global feeds to potentially refresh.")

                # Bulk queue all refresh tasks at once for better performance
                if feeds_to_check:
                    feed_ids = [str(feed.id) for feed in feeds_to_check]
                    tasks = [refresh_single_feed_task.delay(feed_id) for feed_id in feed_ids]
                    dispatched_count = len(tasks)

                    # Log efficiency metrics
                    logger.info(f"Bulk dispatched {dispatched_count} global feed refresh tasks")
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
                logger.info("Task-specific engine disposed for schedule_all_feed_refreshes_task")

    return asyncio.run(_async_schedule_all_feeds())


@celery.task(
    name="app.workers.tasks.enrich_feed_task",
    bind=True,
    max_retries=2,
    default_retry_delay=300,
)
def enrich_feed_task(self: Any, feed_id: str) -> dict[str, Any]:
    """Celery task to enrich a feed with AI-powered metadata and additional information."""

    async def _async_enrich_feed() -> dict[str, Any]:
        engine, task_async_session_local = await create_task_db_session()
        try:
            logger.info("Starting feed enrichment task", feed_id=feed_id)

            async with task_async_session_local() as db:
                from app.services.feed_enrichment_service import FeedEnrichmentService

                enrichment_service = FeedEnrichmentService(db=db)
                result = await enrichment_service.enrich_feed(feed_id)

                if result.get("success"):
                    logger.info(
                        "Feed enrichment completed successfully",
                        feed_id=feed_id,
                        enrichment_data=result.get("enrichment_data", {}),
                    )
                else:
                    logger.error(
                        "Feed enrichment failed",
                        feed_id=feed_id,
                        error=result.get("error"),
                    )

                return result

        except Exception as exc:
            logger.error(
                "Error in feed enrichment task",
                feed_id=feed_id,
                error=str(exc),
                exc_info=True,
            )
            raise
        finally:
            if engine:
                await engine.dispose()

    try:
        return asyncio.run(_async_enrich_feed())
    except Exception as exc:
        if self.request.retries < (self.max_retries or 2):
            logger.info(
                f"Retrying feed enrichment task, attempt {self.request.retries + 1}",
                feed_id=feed_id,
            )
            raise self.retry(exc=exc, countdown=300 * (self.request.retries + 1)) from exc
        else:
            logger.error(
                "Max retries reached for feed enrichment task",
                feed_id=feed_id,
                error=str(exc),
                exc_info=True,
            )
            # Return failure result instead of raising
            return {
                "success": False,
                "feed_id": feed_id,
                "error": str(exc),
                "status": "task_failed",
            }
