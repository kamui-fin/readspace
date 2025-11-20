"""OPML file import orchestration worker operations."""

from datetime import datetime, timezone
from typing import Any
from uuid import UUID

import structlog
from sqlalchemy.ext.asyncio import AsyncSession

from app.routers.opml.utils import (
    check_import_cancellation_flag,
    initialize_import_progress,
    update_import_progress,
)
from app.services.opml.opml_import import OpmlImportService

logger = structlog.get_logger(__name__)


async def import_opml(
    user_id: UUID,
    opml_content: str,
    db: AsyncSession,
    default_folder_name: str = "Imported Feeds",
    task_id: str | None = None,
    filename: str | None = None,
    estimated_feeds: int | None = None,
) -> dict[str, Any]:
    """Import OPML file by dispatching individual feed tasks.

    Args:
        user_id: User UUID
        opml_content: OPML file content
        db: Database session
        default_folder_name: Default folder name for feeds without folders
        task_id: Optional task ID for cooperative cancellation
        filename: Original OPML filename
        estimated_feeds: Estimated number of feeds to import

    Returns:
        Import result dictionary with metadata and dispatched task IDs
    """
    logger.info("Starting OPML import orchestration", user_id=str(user_id), task_id=task_id)

    # Check for cancellation at the start
    if task_id:
        is_cancelled = await check_import_cancellation_flag(task_id)
        if is_cancelled:
            logger.info(
                "OPML import cancelled before starting",
                task_id=task_id,
                user_id=str(user_id),
            )
            return {
                "status": "cancelled",
                "message": "Import was cancelled before starting",
            }

    try:
        opml_service = OpmlImportService(db=db, user_id=user_id)

        # Extract feeds first to get the count
        feeds_data = await opml_service.extract_feeds_from_opml(
            opml_content=opml_content,
            default_folder_name=default_folder_name,
        )

        total_feeds = len(feeds_data)

        # Initialize progress state in Redis if we have a task_id
        if task_id:
            await initialize_import_progress(
                task_id=task_id,
                user_id=str(user_id),
                filename=filename or "unknown.opml",
                total_feeds=total_feeds,
            )

            # Mark as started
            await update_import_progress(
                task_id=task_id,
                status="in_progress",
                started_at=datetime.now(timezone.utc).isoformat(),
            )

        if not feeds_data:
            if task_id:
                await update_import_progress(
                    task_id=task_id,
                    status="completed",
                    completed_at=datetime.now(timezone.utc).isoformat(),
                    message="No feeds found to import",
                )
            return {
                "status": "completed",
                "message": "No feeds found to import",
            }

        # Dispatch individual tasks
        result = await opml_service._dispatch_feed_tasks(feeds_data, task_id)

        logger.info(
            "OPML import orchestration completed",
            dispatched_tasks=len(result.get("task_ids", [])),
            total_feeds=total_feeds,
            user_id=str(user_id),
            task_id=task_id,
        )

        return result
    except Exception as exc:
        logger.error(
            "OPML import orchestration failed",
            user_id=str(user_id),
            error=str(exc),
            exc_info=True,
        )

        # Mark as failed in progress state
        if task_id:
            await update_import_progress(
                task_id=task_id,
                status="failed",
                completed_at=datetime.now(timezone.utc).isoformat(),
                message=f"Import failed: {str(exc)}",
            )

        raise exc
