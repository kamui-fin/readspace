"""OPML import Taskiq tasks."""

import time
from datetime import datetime, timezone
from typing import Annotated, Any
from uuid import UUID

import structlog
from sqlalchemy.ext.asyncio import AsyncSession
from taskiq import Context, TaskiqDepends

from app.core.metrics import (
    opml_feed_import_duration_seconds,
    opml_feeds_failed_total,
    opml_feeds_imported_total,
    opml_feeds_in_progress,
    opml_feeds_per_import,
    opml_imports_in_progress,
    opml_imports_total,
)
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
    parent_task_id: str | None = None,
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
        parent_task_id: Parent OPML import task ID for progress tracking

    Returns:
        Import result dictionary
    """
    from app.routers.opml.utils import update_import_progress
    from app.schemas import FeedImportError

    start_time = time.perf_counter()
    opml_feeds_in_progress.inc()  # Increment gauge

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

        duration = time.perf_counter() - start_time
        status = result.get("status", "unknown")

        # Record metrics based on result
        if result.get("success"):
            if status == "already_exists":
                opml_feeds_imported_total.labels(status="already_exists").inc()
            else:
                opml_feeds_imported_total.labels(status="success").inc()
        elif status == "limit_exceeded":
            opml_feeds_imported_total.labels(status="skipped").inc()
        else:
            opml_feeds_imported_total.labels(status="failed").inc()
            opml_feeds_failed_total.inc()

        opml_feed_import_duration_seconds.observe(duration)  # Record duration

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
                # Successful import or already exists
                await update_import_progress(
                    task_id=parent_task_id,
                    success=True,
                    already_exists=(status == "already_exists"),
                )
            elif status == "limit_exceeded":
                # Skipped due to subscription limit
                await update_import_progress(
                    task_id=parent_task_id,
                    skipped_limit=True,
                )
            else:
                # Failed import
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
        opml_feeds_imported_total.labels(status="failed").inc()
        opml_feeds_failed_total.inc()
        opml_feed_import_duration_seconds.observe(duration)

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
            from app.routers.opml.utils import update_import_progress
            from app.schemas import FeedImportError

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
    finally:
        opml_feeds_in_progress.dec()  # Decrement gauge


async def async_import_opml(
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
    from app.routers.opml.utils import (
        check_import_cancellation_flag,
        initialize_import_progress,
        update_import_progress,
    )

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
            from app.routers.opml.utils import update_import_progress

            await update_import_progress(
                task_id=task_id,
                status="failed",
                completed_at=datetime.now(timezone.utc).isoformat(),
                message=f"Import failed: {str(exc)}",
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
    parent_task_id: str | None = None,
) -> dict[str, Any]:
    """Import a single feed - Taskiq task wrapper.

    Args:
        user_id: User UUID (may be string from serialization)
        feed_url: Feed URL to import
        folder_id: Folder ID for the feed
        tag_names: Optional list of tag names
        feed_title: Optional feed title override
        update_existing: Whether to update existing feed
        parent_task_id: Parent OPML import task ID for cancellation checking

    Returns:
        Import result dictionary
    """
    user_id_uuid = ensure_uuid(user_id)

    # Check for cancellation before starting
    if parent_task_id:
        from app.routers.opml.utils import check_import_cancellation_flag, update_import_progress

        is_cancelled = await check_import_cancellation_flag(parent_task_id)
        if is_cancelled:
            logger.info(
                "Feed import cancelled",
                feed_url=feed_url,
                parent_task_id=parent_task_id,
                user_id=str(user_id_uuid),
            )

            # Update progress to reflect cancellation
            await update_import_progress(
                task_id=parent_task_id,
                cancelled=True,
            )

            return {
                "success": False,
                "url": feed_url,
                "title": feed_title or "Unknown",
                "status": "cancelled",
                "error": "Import was cancelled by user",
            }

    async for session in get_worker_db():
        return await async_import_single_feed(
            user_id=user_id_uuid,
            feed_url=feed_url,
            folder_id=folder_id,
            db=session,
            tag_names=tag_names,
            feed_title=feed_title,
            update_existing=update_existing,
            parent_task_id=parent_task_id,
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
    filename: str | None = None,
    estimated_feeds: int | None = None,
    context: Annotated[Context, TaskiqDepends()] = None,
) -> dict[str, Any]:
    """Import OPML file by dispatching individual feed tasks.

    This orchestration task extracts feeds from the OPML and dispatches
    individual Taskiq tasks for each feed. RabbitMQ handles queuing and
    Taskiq workers process feeds concurrently.

    Args:
        user_id: User UUID (may be string from serialization)
        opml_content: OPML file content
        default_folder_name: Default folder name for feeds without folders
        filename: Original OPML filename
        estimated_feeds: Estimated number of feeds to import
        context: Taskiq context (injected automatically)

    Returns:
        Dict with task_ids for each dispatched feed import task
    """
    user_id_uuid = ensure_uuid(user_id)

    # Get task_id from context for cooperative cancellation
    task_id = context.message.task_id if context and hasattr(context, "message") and context.message else None

    async for session in get_worker_db():
        return await async_import_opml(
            user_id=user_id_uuid,
            opml_content=opml_content,
            db=session,
            default_folder_name=default_folder_name,
            task_id=task_id,
            filename=filename,
            estimated_feeds=estimated_feeds,
        )
