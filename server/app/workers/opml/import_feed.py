"""Single feed import worker operations."""

import time
from typing import Any
from uuid import UUID

import structlog

from app.schemas import FeedImportError
from app.services.opml.opml_import import OpmlImportService
from app.workers.common import worker_db_factory
from app.workers.opml.progress import update_import_progress

logger = structlog.get_logger(__name__)


async def import_single_feed(
    user_id: UUID,
    feed_url: str,
    folder_id: str,
    tag_names: list[str] | None = None,
    feed_title: str | None = None,
    update_existing: bool = False,
    parent_task_id: str | None = None,
) -> dict[str, Any]:
    """Import a single feed.

    Args:
        user_id: User UUID
        feed_url: Feed URL to import
        folder_id: Folder ID for the feed
        tag_names: Optional list of tag names
        feed_title: Optional feed title override
        update_existing: Whether to update existing feed
        parent_task_id: Parent OPML import task ID for progress tracking

    Returns:
        Import result dictionary
    """

    start_time = time.perf_counter()

    logger.info(
        "Starting feed import",
        user_id=str(user_id),
        feed_url=feed_url,
    )

    try:
        opml_service = OpmlImportService(user_id=user_id)
        result = await opml_service.import_single_feed(
            worker_db_factory,
            feed_url=feed_url,
            folder_id=folder_id,
            tag_names=tag_names,
            feed_title=feed_title,
            update_existing=update_existing,
        )

        duration = time.perf_counter() - start_time
        status = result.get("status", "unknown")

        logger.info(
            "Feed import completed",
            user_id=str(user_id),
            feed_url=feed_url,
            success=result.get("success", False),
            status=status,
            duration_seconds=round(duration, 3),
        )

        # Update progress state if we have a parent task
        if parent_task_id:
            if result.get("success"):
                await update_import_progress(
                    task_id=parent_task_id,
                    success=True,
                    already_exists=(status == "already_exists"),
                )
            elif status == "limit_exceeded":
                await update_import_progress(
                    task_id=parent_task_id,
                    skipped_limit=True,
                )
            else:
                error = FeedImportError(
                    url=result.get("url", feed_url),
                    title=result.get("title", feed_title or "Unknown"),
                    error=result.get("error", "Unknown error"),
                    status=status,
                )
                await update_import_progress(
                    task_id=parent_task_id,
                    error=error,
                )

        return result
    except Exception as exc:
        duration = time.perf_counter() - start_time

        logger.error(
            "Feed import failed",
            user_id=str(user_id),
            feed_url=feed_url,
            error=str(exc),
            error_type=type(exc).__name__,
            duration_seconds=round(duration, 3),
            exc_info=True,
        )

        result = {
            "success": False,
            "url": feed_url,
            "title": feed_title or "Unknown",
            "status": "task_failed",
            "error": str(exc),
        }

        # Update progress state if we have a parent task
        if parent_task_id:
            error = FeedImportError(
                url=feed_url,
                title=feed_title or "Unknown",
                error=str(exc),
                status="task_failed",
            )
            await update_import_progress(
                task_id=parent_task_id,
                error=error,
            )

        return result
