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
from app.workers.common import ensure_uuid, get_worker_db
from app.workers.opml import import_opml, import_single_feed
from app.workers.opml.progress import check_import_cancellation_flag, update_import_progress

logger = structlog.get_logger(__name__)


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
        return await import_single_feed(
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
        return await import_opml(
            user_id=user_id_uuid,
            opml_content=opml_content,
            db=session,
            default_folder_name=default_folder_name,
            task_id=task_id,
            filename=filename,
            estimated_feeds=estimated_feeds,
        )
