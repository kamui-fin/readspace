"""OPML import Taskiq tasks.

This module defines Taskiq task wrappers that handle:
- Database session management via get_worker_db()
- Task scheduling and retry configuration
- Cooperative cancellation checking

The actual business logic is in app.workers.opml package.
"""

from typing import Annotated, Any

import structlog
from taskiq import Context, TaskiqDepends

from app.core.taskiq_app import broker
from app.workers.common import ensure_uuid
from app.workers.opml.import_feed import import_single_feed
from app.typing.opml import FeedImportError
from app.workers.opml.import_opml import import_opml
from app.workers.opml.progress import check_import_cancellation_flag, update_import_progress

logger = structlog.get_logger(__name__)


@broker.task(
    task_name="opml_tasks.import_single_feed",
    retry_on_error=True,
    max_retries=2,
    timeout=120,
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
    """Import a single feed - Taskiq task wrapper."""

    user_id_uuid = ensure_uuid(user_id)

    # Check for cancellation before starting
    if parent_task_id:
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

    try:
        # Service function manages its own sessions internally
        return await import_single_feed(
            user_id=user_id_uuid,
            feed_url=feed_url,
            folder_id=folder_id,
            tag_names=tag_names,
            feed_title=feed_title,
            update_existing=update_existing,
            parent_task_id=parent_task_id,
        )
    except Exception as exc:
        logger.error(
            "Unhandled exception in feed import task wrapper",
            feed_url=feed_url,
            error=str(exc),
            user_id=str(user_id_uuid),
            exc_info=True,
        )

        # CRITICAL: Update progress even on catastrophic failure
        if parent_task_id:
            await update_import_progress(
                task_id=parent_task_id,
                error=FeedImportError(
                    url=feed_url,
                    title=feed_title or "Unknown",
                    error=f"Task wrapper exception: {str(exc)}",
                    status="task_exception",
                ),
            )

        # Re-raise to let Taskiq handle retry logic
        raise


@broker.task(
    task_name="opml_tasks.import_opml",
    retry_on_error=False,
    max_retries=0,
)
async def import_opml_task(
    user_id: str,
    opml_content: str,
    default_folder_name: str = "Imported Feeds",
    filename: str | None = None,
    context: Annotated[Context, TaskiqDepends()] | None = None,
) -> dict[str, Any]:
    """Import OPML file by dispatching individual feed tasks."""
    user_id_uuid = ensure_uuid(user_id)

    # Get task_id from context for cooperative cancellation
    task_id = None
    if context and hasattr(context, "message"):
        task_id = context.message.task_id

    return await import_opml(
        user_id=user_id_uuid,
        opml_content=opml_content,
        default_folder_name=default_folder_name,
        task_id=task_id,
        filename=filename,
    )
