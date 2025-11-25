"""OPML file import orchestration worker operations."""

from collections.abc import Callable
from datetime import datetime, timezone
from typing import Any
from uuid import UUID

import structlog

from app.crud import folder as crud_folder
from app.services.opml.parsing import parse_opml
from app.typing.common import ImportStatus
from app.workers.common import worker_db_factory
from app.workers.opml.progress import OpmlImportTracker

logger = structlog.get_logger(__name__)

SessionFactory = Callable[[], Any]


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
        tracker = OpmlImportTracker(task_id)
        is_cancelled = await tracker.is_cancelled()
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
            tracker = OpmlImportTracker(task_id)
            await tracker.initialize(
                user_id=str(user_id),
                filename=filename or "unknown.opml",
                total_feeds=total_feeds,
            )

        if not feeds:
            # No need to update progress - tracker auto-completes when completed == total (0 == 0)
            return {"status": ImportStatus.COMPLETED.value, "message": "No feeds found"}

        # Process import (creates folders and dispatches tasks)
        result = await _process_opml_import(
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
            tracker = OpmlImportTracker(task_id)
            state = await tracker.get_state()
            if state:
                # Update metadata to mark as failed
                async with tracker._client() as r:
                    meta_raw = await r.get(tracker.key_meta)
                    if meta_raw:
                        import orjson
                        meta = orjson.loads(meta_raw)
                        meta["status"] = ImportStatus.FAILED.value
                        meta["completed_at"] = datetime.now(timezone.utc).isoformat()
                        meta["message"] = f"Import failed: {str(exc)}"
                        await r.setex(tracker.key_meta, tracker._ttl, orjson.dumps(meta))

        raise exc


async def _process_opml_import(
    db_factory: SessionFactory,
    user_id: UUID,
    opml_content: str,
    default_folder_name: str = "Imported Feeds",
    parent_task_id: str | None = None,
) -> dict[str, Any]:
    """
    Process an OPML string (Worker-facing).

    Executed by the background worker.
    1. Parses XML (CPU).
    2. Acquires DB connection ONLY for folder creation.
    3. Dispatches individual feed tasks.
    """
    # Lazy import to avoid circular dependency
    from app.workers.opml_tasks import import_single_feed_task

    # 1. Parse Content
    raw_feeds = parse_opml(opml_content, default_folder_name)

    logger.info("OPML Parsed in worker", user_id=str(user_id), count=len(raw_feeds))

    # 2. Database Operations (Surgical Session)
    folder_map = {}
    async with db_factory() as db:
        # Bulk Create Folders
        folder_names = {f["folder_name"] for f in raw_feeds if f.get("folder_name")}
        if folder_names:
            folder_map = await crud_folder.upsert_batch(db, list(folder_names), user_id)

    # 3. Dispatch Tasks
    task_ids = []
    dispatched_count = 0

    for feed in raw_feeds:
        folder_id = folder_map.get(feed.get("folder_name", ""))

        try:
            # Dispatch single feed import
            task = await import_single_feed_task.kiq(
                user_id=str(user_id),
                feed_url=feed["xml_url"],
                folder_id=str(folder_id) if folder_id else "",
                feed_title=feed.get("title"),
                parent_task_id=parent_task_id,
                tag_names=[],
            )
            task_ids.append(task.task_id)
            dispatched_count += 1
        except Exception as e:
            logger.error(
                "Failed to dispatch feed import task", url=feed.get("xml_url"), error=str(e), user_id=str(user_id)
            )

    logger.info("OPML Import Dispatched", user_id=str(user_id), total=len(raw_feeds), dispatched=dispatched_count)

    return {
        "total_feeds": len(raw_feeds),
        "dispatched_count": dispatched_count,
        "task_ids": task_ids,
        "status": "processing",
    }
