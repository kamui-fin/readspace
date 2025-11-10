"""OPML import Taskiq tasks."""

from typing import Any
from uuid import UUID

import structlog
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.taskiq_app import broker
from app.services.opml.opml_import import OpmlImportService
from app.workers.common import ensure_uuid, get_worker_db

logger = structlog.get_logger(__name__)


# ============================================================================
# ASYNC HELPER FUNCTIONS (for testing and reuse)
# ============================================================================


async def async_import_single_feed(
    user_id: UUID,
    feed_url: str,
    folder_id: str,
    db: AsyncSession,
    tag_names: list[str] | None = None,
    feed_title: str | None = None,
    update_existing: bool = False,
) -> dict[str, Any]:
    """Import a single feed - async implementation for testing.

    Args:
        user_id: User UUID
        feed_url: Feed URL to import
        folder_id: Folder ID for the feed
        db: Database session
        tag_names: Optional list of tag names
        feed_title: Optional feed title override
        update_existing: Whether to update existing feed

    Returns:
        Import result dictionary
    """
    logger.info("Starting feed import", user_id=str(user_id), feed_url=feed_url)

    try:
        opml_service = OpmlImportService(db=db, user_id=user_id)
        result = await opml_service.import_single_feed(
            feed_url=feed_url,
            folder_id=folder_id,
            tag_names=tag_names,
            feed_title=feed_title,
            update_existing=update_existing,
        )

        logger.info(
            "Feed import completed",
            user_id=str(user_id),
            feed_url=feed_url,
            success=result.get("success", False),
        )

        return result
    except Exception as exc:
        logger.error(
            "Feed import failed",
            user_id=str(user_id),
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


async def async_import_opml(
    user_id: UUID,
    opml_content: str,
    db: AsyncSession,
    default_folder_name: str = "Imported Feeds",
    test_mode: bool = False,
) -> dict[str, Any]:
    """Import OPML file - async implementation for testing.

    Args:
        user_id: User UUID
        opml_content: OPML file content
        db: Database session
        default_folder_name: Default folder name for feeds without folders
        test_mode: If True, processes feeds directly instead of dispatching tasks

    Returns:
        Import result dictionary
    """
    logger.info("Starting OPML import", user_id=str(user_id), test_mode=test_mode)

    try:
        opml_service = OpmlImportService(db=db, user_id=user_id)
        result = await opml_service.process_opml_import(
            opml_content=opml_content,
            default_folder_name=default_folder_name,
            test_mode=test_mode,
        )

        logger.info(
            "OPML import completed",
            queued_tasks=result.get("queued_tasks", 0),
            total_feeds=result.get("total_feeds", 0),
            user_id=str(user_id),
            test_mode=test_mode,
        )

        return result
    except Exception as exc:
        logger.error(
            "OPML import failed",
            user_id=str(user_id),
            error=str(exc),
            exc_info=True,
        )
        raise exc


# ============================================================================
# TASKIQ TASK WRAPPERS
# ============================================================================


@broker.task(
    task_name="opml_tasks.import_single_feed",
    retry_on_error=True,
    max_retries=2,
)
async def import_single_feed_task(
    user_id: str,
    feed_url: str,
    folder_id: str,
    tag_names: list[str] | None = None,
    feed_title: str | None = None,
    update_existing: bool = False,
) -> dict[str, Any]:
    """Import a single feed - Taskiq task wrapper.

    Args:
        user_id: User UUID (may be string from serialization)
        feed_url: Feed URL to import
        folder_id: Folder ID for the feed
        tag_names: Optional list of tag names
        feed_title: Optional feed title override
        update_existing: Whether to update existing feed

    Returns:
        Import result dictionary
    """
    user_id_uuid = ensure_uuid(user_id)

    async for session in get_worker_db():
        return await async_import_single_feed(
            user_id=user_id_uuid,
            feed_url=feed_url,
            folder_id=folder_id,
            db=session,
            tag_names=tag_names,
            feed_title=feed_title,
            update_existing=update_existing,
        )


@broker.task(
    task_name="opml_tasks.import_opml",
    retry_on_error=False,  # OPML orchestration shouldn't retry
    max_retries=0,
)
async def import_opml_task(
    user_id: str,
    opml_content: str,
    default_folder_name: str = "Imported Feeds",
) -> dict[str, Any]:
    """Import OPML file - Taskiq task wrapper.

    Args:
        user_id: User UUID (may be string from serialization)
        opml_content: OPML file content
        default_folder_name: Default folder name for feeds without folders

    Returns:
        Import result dictionary with queued_tasks count
    """
    user_id_uuid = ensure_uuid(user_id)

    async for session in get_worker_db():
        return await async_import_opml(
            user_id=user_id_uuid,
            opml_content=opml_content,
            db=session,
            default_folder_name=default_folder_name,
            test_mode=False,
        )
