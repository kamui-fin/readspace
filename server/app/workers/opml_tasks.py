"""OPML import Taskiq tasks."""

from typing import Any

import structlog
from taskiq import Context, TaskiqDepends

from app.core.taskiq_app import broker
from app.typing.opml import FeedImportError
from app.workers.common import ensure_uuid
from app.workers.opml.import_feed import import_single_feed
from app.workers.opml.import_opml import import_opml
from app.workers.opml.progress import OpmlImportTracker

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
    """Import a single feed (Task Wrapper)."""
    user_uuid = ensure_uuid(user_id)

    # Check Cancellation
    if parent_task_id:
        tracker = OpmlImportTracker(parent_task_id)
        if await tracker.is_cancelled():
            logger.info("Task cancelled", parent_task_id=parent_task_id, url=feed_url)
            await tracker.cancel()  # Re-confirm cancel state
            return {"success": False, "status": "cancelled"}

    try:
        return await import_single_feed(
            user_id=user_uuid,
            feed_url=feed_url,
            folder_id=folder_id,
            tag_names=tag_names,
            feed_title=feed_title,
            update_existing=update_existing,
            parent_task_id=parent_task_id,
        )
    except Exception as exc:
        logger.error("Feed task failed", error=str(exc), url=feed_url, exc_info=True)

        # Ensure progress is updated even on crash
        if parent_task_id:
            await OpmlImportTracker(parent_task_id).mark_failure(
                FeedImportError(
                    url=feed_url,
                    title=feed_title or "Unknown",
                    error=f"Task Exception: {str(exc)}",
                    status="task_exception",
                )
            )
        raise


@broker.task(task_name="opml_tasks.import_opml", retry_on_error=False)
async def import_opml_task(
    user_id: str,
    opml_content: str,
    default_folder_name: str = "Imported Feeds",
    filename: str | None = None,
    context: Context = TaskiqDepends(),
) -> dict[str, Any]:
    """Import OPML file (Orchestrator Wrapper)."""
    task_id = (
        context.message.task_id if context and hasattr(context, "message") else None
    )

    logger.info("Task wrapper called", task_id=task_id, has_context=bool(context))

    if not task_id:
        logger.error(
            "Task ID missing in wrapper",
            context_dir=dir(context) if context else "None",
        )

    return await import_opml(
        user_id=ensure_uuid(user_id),
        opml_content=opml_content,
        default_folder_name=default_folder_name,
        task_id=task_id,
        filename=filename,
    )
