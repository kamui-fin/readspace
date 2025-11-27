"""OPML file import orchestration worker operations."""

from collections.abc import Callable, Coroutine
from datetime import datetime, timezone
from typing import Any
from uuid import UUID

import orjson
import structlog
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud import folder as crud_folder
from app.services.opml.parsing import extract_opml_metadata, parse_opml
from app.typing.common import ImportStatus
from app.workers.common import worker_db_factory
from app.workers.opml.progress import OpmlImportTracker

logger = structlog.get_logger(__name__)

# Type definition for session factory
SessionFactory = Callable[[], Coroutine[Any, Any, AsyncSession]]  # Simplified for brevity


async def import_opml(
    user_id: UUID,
    opml_content: str,
    default_folder_name: str = "Imported Feeds",
    task_id: str | None = None,
    filename: str | None = None,
) -> dict[str, Any]:
    """Orchestrate OPML import process."""
    logger.info("Starting OPML import", user_id=str(user_id), task_id=task_id)

    # 1. Pre-flight Check
    if task_id:
        tracker = OpmlImportTracker(task_id)
        if await tracker.is_cancelled():
            return {
                "status": ImportStatus.CANCELLED.value,
                "message": "Import cancelled before start",
            }

    try:
        # 2. Parse (CPU Bound) and extract metadata
        opml_title, opml_author = extract_opml_metadata(opml_content)
        feeds = parse_opml(opml_content, default_folder_name)
        total_feeds = len(feeds)

        # 3. Init Tracker with metadata
        if task_id:
            await tracker.initialize(
                user_id=str(user_id),
                filename=filename or "unknown.opml",
                total_feeds=total_feeds,
                opml_title=opml_title,
                opml_author=opml_author,
            )

        if not feeds:
            return {"status": ImportStatus.COMPLETED.value, "message": "No feeds found"}

        # 4. Process (Folder creation + Task dispatch)
        result = await _process_opml_import(
            worker_db_factory, user_id, opml_content, default_folder_name, parent_task_id=task_id
        )

        logger.info("OPML dispatch complete", dispatched=result.get("dispatched_count"), total=total_feeds)
        return result

    except Exception as exc:
        logger.error("OPML orchestrator failed", error=str(exc), exc_info=True)
        if task_id:
            await _fail_tracker(task_id, str(exc))
        raise exc


async def _process_opml_import(
    db_factory: Any,
    user_id: UUID,
    opml_content: str,
    default_folder_name: str,
    parent_task_id: str | None,
) -> dict[str, Any]:
    """Execute import steps."""
    from app.workers.opml_tasks import import_single_feed_task  # Lazy import

    # Parse feeds (already done in import_opml, but kept for consistency)
    raw_feeds = parse_opml(opml_content, default_folder_name)

    # Batch create folders (Single DB Session)
    async with db_factory() as db:
        folders = {f.get("folder_name") for f in raw_feeds if f.get("folder_name")}
        folder_map = await crud_folder.upsert_batch(db, list(folders), user_id) if folders else {}

    # Dispatch Tasks
    task_ids = []
    dispatched = 0

    for feed in raw_feeds:
        folder_id = folder_map.get(feed.get("folder_name", ""))
        try:
            task = await import_single_feed_task.kiq(
                user_id=str(user_id),
                feed_url=feed["xml_url"],
                folder_id=str(folder_id) if folder_id else "",
                feed_title=feed.get("title"),
                parent_task_id=parent_task_id,
            )
            task_ids.append(task.task_id)
            dispatched += 1
        except Exception as e:
            logger.error("Task dispatch failed", url=feed.get("xml_url"), error=str(e))

    return {
        "total_feeds": len(raw_feeds),
        "dispatched_count": dispatched,
        "task_ids": task_ids,
        "status": "processing",
    }


async def _fail_tracker(task_id: str, error_msg: str) -> None:
    """Helper to mark tracker as failed."""
    tracker = OpmlImportTracker(task_id)
    state = await tracker.get_state()
    if state:
        async with tracker._client() as r:
            meta_raw = await r.get(tracker.key_meta)
            if meta_raw:
                meta = orjson.loads(meta_raw)
                meta.update(
                    {
                        "status": ImportStatus.FAILED.value,
                        "completed_at": datetime.now(timezone.utc).isoformat(),
                        "message": f"Orchestrator Error: {error_msg}",
                    }
                )
                await r.setex(tracker.key_meta, tracker._ttl, orjson.dumps(meta))
