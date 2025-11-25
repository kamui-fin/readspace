"""Single feed import worker operations."""

from typing import Any
from uuid import UUID

import structlog

from app.services.feeds.service import add_feed
from app.services.folder import ensure_default_folder
from app.typing.common import ImportStatus
from app.typing.opml import FeedImportError
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
        folder_id: Folder ID for the feed (empty string uses default folder)
        tag_names: Optional list of tag names
        feed_title: Optional feed title override
        update_existing: Whether to update existing feed
        parent_task_id: Parent OPML import task ID for progress tracking

    Returns:
        Import result dictionary
    """
    logger.info(
        "Starting feed import",
        user_id=str(user_id),
        feed_url=feed_url,
    )

    try:
        # Resolve folder_id: use default folder if empty/None
        if folder_id:
            resolved_folder_id = UUID(folder_id)
        else:
            async with worker_db_factory() as db:
                default_folder = await ensure_default_folder(db, user_id=user_id)
                resolved_folder_id = default_folder.id

        # Use the core feed service to add/subscribe
        # add_feed handles: resolving URL, fetching, parsing, creating feed, subscribing
        subscription = await add_feed(
            session_factory=worker_db_factory,
            user_id=user_id,
            url=feed_url,
            folder_id=resolved_folder_id,
            custom_title=feed_title,
        )

        # Success
        logger.info(
            "Feed import completed",
            user_id=str(user_id),
            feed_url=feed_url,
            success=True,
        )

        if parent_task_id:
            await update_import_progress(
                task_id=parent_task_id,
                success=True,
                # logic for already_exists might need to be derived from add_feed return?
                # add_feed raises FeedSubscriptionError if already subscribed.
                # So if we are here, it's likely a success (new or existing feed, but new subscription)
                already_exists=False,
            )

        return {
            "success": True,
            "url": feed_url,
            "title": subscription.custom_title or subscription.feed.title,  # Assuming subscription object structure
            "status": ImportStatus.COMPLETED.value,
        }

    except Exception as exc:
        # Check for specific exceptions
        error_msg = str(exc)
        status = ImportStatus.FAILED.value
        already_exists = False

        if "Already subscribed" in error_msg:
            status = "already_exists"  # Not a real ImportStatus but useful for progress logic
            already_exists = True
            # We might want to count this as success in terms of "processed"?
            # The progress tracker handles `already_exists` specially.

        logger.error(
            "Feed import failed",
            user_id=str(user_id),
            feed_url=feed_url,
            error=error_msg,
            exc_info=True,
        )

        if parent_task_id:
            if already_exists:
                await update_import_progress(
                    task_id=parent_task_id,
                    success=True,
                    already_exists=True,
                )
            else:
                error = FeedImportError(
                    url=feed_url,
                    title=feed_title or "Unknown",
                    error=error_msg,
                    status="failed",
                )
                await update_import_progress(
                    task_id=parent_task_id,
                    error=error,
                )

        return {
            "success": already_exists,  # Technically success if we just want to ensure it's there
            "url": feed_url,
            "title": feed_title or "Unknown",
            "status": status,
            "error": error_msg,
        }
