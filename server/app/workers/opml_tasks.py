"""OPML import Celery tasks."""

from typing import Any
from uuid import UUID

import structlog
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.celery_app import celery
from app.services.opml.opml_import import OpmlImportService
from app.workers.common import ensure_uuid, get_task_event_loop, get_worker_db

logger = structlog.get_logger(__name__)


# ============================================================================
# ASYNC IMPLEMENTATIONS
# ============================================================================


async def _execute_single_feed_import(
    session: AsyncSession,
    user_id: UUID,
    feed_url: str,
    folder_id: str,
    tag_names: list[str] | None,
    feed_title: str | None,
    update_existing: bool,
) -> dict[str, Any]:
    """Execute single feed import with provided session."""
    opml_service = OpmlImportService(db=session, user_id=user_id)
    return await opml_service.import_single_feed(
        feed_url=feed_url,
        folder_id=folder_id,
        tag_names=tag_names,
        feed_title=feed_title,
        update_existing=update_existing,
    )


async def async_import_single_feed(
    user_id: UUID,
    feed_url: str,
    folder_id: str,
    tag_names: list[str] | None = None,
    feed_title: str | None = None,
    update_existing: bool = False,
    is_revoked: bool = False,
    db: AsyncSession | None = None,
) -> dict[str, Any]:
    """Import a single feed - async implementation.

    Args:
        user_id: User UUID
        feed_url: Feed URL to import
        folder_id: Folder ID for the feed
        tag_names: Optional list of tag names
        feed_title: Optional feed title override
        update_existing: Whether to update existing feed
        is_revoked: Whether the task was cancelled
        db: Optional database session. If not provided, creates a new session.

    Returns:
        Import result dictionary
    """
    if is_revoked:
        return {
            "success": False,
            "url": feed_url,
            "title": feed_title or "Unknown",
            "status": "cancelled",
            "error": "Task was cancelled by user",
        }

    if db is not None:
        return await _execute_single_feed_import(
            db, user_id, feed_url, folder_id, tag_names, feed_title, update_existing
        )

    async for session in get_worker_db():
        return await _execute_single_feed_import(
            session, user_id, feed_url, folder_id, tag_names, feed_title, update_existing
        )


async def _execute_opml_import(
    session: AsyncSession, user_id: UUID, opml_content: str, default_folder_name: str, test_mode: bool = False
) -> dict[str, Any]:
    """Execute OPML import with provided session."""
    opml_service = OpmlImportService(db=session, user_id=user_id)
    result = await opml_service.process_opml_import(
        opml_content=opml_content, default_folder_name=default_folder_name, test_mode=test_mode
    )

    if test_mode:
        logger.info(
            "Direct feed import completed",
            imported_count=result.get("imported_count", 0),
            total_feeds=result["total_feeds"],
            user_id=str(user_id),
        )
    else:
        logger.info(
            "Bulk queued feed import tasks",
            queued_tasks=result["queued_tasks"],
            user_id=str(user_id),
        )
    return result


async def async_import_opml(
    user_id: UUID,
    opml_content: str,
    default_folder_name: str = "Imported Feeds",
    is_revoked: bool = False,
    db: AsyncSession | None = None,
    test_mode: bool = False,
) -> dict[str, Any]:
    """Import OPML file - async implementation.

    Args:
        user_id: User UUID
        opml_content: OPML file content
        default_folder_name: Default folder name for feeds without folders
        is_revoked: Whether the task was cancelled
        db: Optional database session. If not provided, creates a new session.
        test_mode: If True, import feeds directly without queuing Celery tasks

    Returns:
        Import result dictionary
    """
    if is_revoked:
        logger.info("OPML import task was cancelled before starting", user_id=str(user_id))
        raise Exception("Task was cancelled by user")

    logger.info("Starting OPML import orchestration", user_id=str(user_id), test_mode=test_mode)

    if db is not None:
        return await _execute_opml_import(db, user_id, opml_content, default_folder_name, test_mode=test_mode)

    async for session in get_worker_db():
        return await _execute_opml_import(session, user_id, opml_content, default_folder_name, test_mode=test_mode)


# ============================================================================
# CELERY TASK WRAPPERS
# ============================================================================


@celery.task(
    name="app.workers.opml_tasks.import_single_feed_task",
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
    """Celery task wrapper for importing a single feed."""
    loop = get_task_event_loop()
    is_revoked = hasattr(self.request, "is_revoked") and self.request.is_revoked()

    try:
        return loop.run_until_complete(
            async_import_single_feed(
                user_id=ensure_uuid(user_id),
                feed_url=feed_url,
                folder_id=folder_id,
                tag_names=tag_names,
                feed_title=feed_title,
                update_existing=update_existing,
                is_revoked=is_revoked,
            )
        )
    except Exception as exc:
        if is_revoked:
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
                "Retrying import_single_feed_task",
                attempt=self.request.retries + 1,
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
            return {
                "success": False,
                "url": feed_url,
                "title": feed_title or "Unknown",
                "status": "task_failed",
                "error": str(exc),
            }


@celery.task(
    name="app.workers.opml_tasks.import_opml_task",
    bind=True,
    max_retries=0,
    default_retry_delay=300,
)
def import_opml_task(
    self: Any, user_id: str, opml_content: str, default_folder_name: str = "Imported Feeds"
) -> dict[str, Any]:
    """Celery task wrapper for OPML import orchestration."""
    loop = get_task_event_loop()
    is_revoked = hasattr(self.request, "is_revoked") and self.request.is_revoked()

    try:
        return loop.run_until_complete(
            async_import_opml(
                user_id=ensure_uuid(user_id),
                opml_content=opml_content,
                default_folder_name=default_folder_name,
                is_revoked=is_revoked,
            )
        )
    except Exception as exc:
        if is_revoked:
            logger.info("import_opml_task was cancelled", user_id=user_id)
            raise exc

        logger.error(
            "OPML import task failed",
            user_id=user_id,
            error=str(exc),
            exc_info=True,
        )
        raise exc
