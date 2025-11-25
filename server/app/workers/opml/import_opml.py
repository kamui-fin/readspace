"""OPML file import orchestration worker operations."""

from datetime import datetime, timezone
from typing import Any
from uuid import UUID

import structlog

from app.models.enums import ImportStatus
from app.services.opml.opml_import import process_opml_import
from app.services.opml.parsing import parse_opml
from app.workers.common import worker_db_factory
from app.workers.opml.progress import (
    check_import_cancellation_flag,
    initialize_import_progress,
    update_import_progress,
)

logger = structlog.get_logger(__name__)


async def import_opml(
    user_id: UUID,
    opml_content: str,
    default_folder_name: str = "Imported Feeds",
    task_id: str | None = None,
    filename: str | None = None,
) -> dict[str, Any]:
    """Import OPML file by dispatching individual feed tasks.

    This orchestration function:
    1. Parses OPML content (CPU-bound, no DB)
    2. Creates folders (single transaction via service)
    3. Dispatches individual feed import tasks

    Args:
        user_id: User UUID
        opml_content: OPML file content
        default_folder_name: Default folder name for feeds without folders
        task_id: Optional task ID for cooperative cancellation
        filename: Original OPML filename

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
                "status": ImportStatus.CANCELLED.value,
                "message": "Import was cancelled before starting",
            }

    try:
        # Initial parsing to get total feeds for progress tracking
        feeds = parse_opml(opml_content, default_folder_name)
        total_feeds = len(feeds)

        if task_id:
            await initialize_import_progress(
                task_id=task_id,
                user_id=str(user_id),
                filename=filename or "unknown.opml",
                total_feeds=total_feeds,
            )
            await update_import_progress(
                task_id=task_id,
                status=ImportStatus.IN_PROGRESS,
                started_at=datetime.now(timezone.utc).isoformat(),
            )

        if not feeds:
            if task_id:
                await update_import_progress(
                    task_id=task_id,
                    status=ImportStatus.COMPLETED,
                    completed_at=datetime.now(timezone.utc).isoformat(),
                    message="No feeds found to import",
                )
            return {"status": ImportStatus.COMPLETED.value, "message": "No feeds found"}

        # Process import (creates folders and dispatches tasks)
        result = await process_opml_import(
            worker_db_factory, user_id, opml_content, default_folder_name, parent_task_id=task_id
        )

        logger.info(
            "OPML import orchestration completed",
            dispatched_tasks=result.get("dispatched_count", 0),
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
                status=ImportStatus.FAILED,
                completed_at=datetime.now(timezone.utc).isoformat(),
                message=f"Import failed: {str(exc)}",
            )

        raise exc
