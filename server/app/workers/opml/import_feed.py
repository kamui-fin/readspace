"""Single feed import worker operations."""

from typing import Any
from uuid import UUID

import structlog

from app.services.feeds.service import add_feed
from app.services.folder import ensure_default_folder
from app.typing.common import ImportStatus
from app.typing.opml import FeedImportError
from app.workers.common import worker_db_factory
from app.workers.opml.progress import OpmlImportTracker

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
    """Execute import logic for a single feed."""
    logger.info("Importing feed", user_id=str(user_id), url=feed_url)

    try:
        # Resolve folder
        if folder_id:
            resolved_folder_id = UUID(folder_id)
        else:
            async with worker_db_factory() as db:
                default_folder = await ensure_default_folder(db, user_id=user_id)
                resolved_folder_id = default_folder.id

        # Service Call (Manages its own sessions via factory)
        subscription, created = await add_feed(
            session_factory=worker_db_factory,
            user_id=user_id,
            url=feed_url,
            folder_id=resolved_folder_id,
            custom_title=feed_title,
        )

        if parent_task_id:
            await OpmlImportTracker(parent_task_id).mark_success(
                already_exists=not created
            )

        return {
            "success": True,
            "url": feed_url,
            "title": subscription.custom_title or subscription.feed.title,
            "status": (ImportStatus.COMPLETED.value if created else "already_exists"),
        }

    except Exception as exc:
        error_msg = str(exc)

        if parent_task_id:
            tracker = OpmlImportTracker(parent_task_id)
            await tracker.mark_failure(
                FeedImportError(
                    url=feed_url,
                    title=feed_title or "Unknown",
                    error=error_msg,
                    status="failed",
                )
            )

        logger.error("Feed import failed", url=feed_url, error=error_msg)

        return {
            "success": False,
            "url": feed_url,
            "title": feed_title or "Unknown",
            "status": ImportStatus.FAILED.value,
            "error": error_msg,
        }
