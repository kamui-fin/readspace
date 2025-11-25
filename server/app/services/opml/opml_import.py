"""
OPML Import Service.

Orchestrates parsing, folder creation, and background task dispatch.
Handles both the initial upload (router-facing) and the background processing (worker-facing).
"""

from typing import Any
from uuid import UUID

import structlog
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud import folder as crud_folder
from app.db.session_factory import SessionFactory
from app.services.opml.parsing import parse_opml
from app.services.opml.tasks import store_task_ownership
from app.services.user.resource_limits import enforce_subscription_limit
from app.typing.opml import OpmlImportResponse
from app.workers.opml_tasks import import_single_feed_task

logger = structlog.get_logger(__name__)


async def handle_opml_upload(
    db: AsyncSession,
    user_id: str,
    opml_content: str,
    filename: str,
    default_folder_name: str = "Imported Feeds",
) -> OpmlImportResponse:
    """
    Handle OPML file upload from the router.
    Validates content, checks limits, and dispatches the background task.
    """
    # 1. Parse to validate structure and get count (CPU bound)
    # This will raise ValidationError if invalid, which router should handle
    # We use the parsing logic to count feeds accurately
    feeds = parse_opml(opml_content, default_folder_name)
    feed_count = len(feeds)

    # 2. Check subscription limits
    # This raises HTTPException(429) if limit exceeded
    await enforce_subscription_limit(db, UUID(user_id))

    # 3. Dispatch Orchestration Task
    # Local import to avoid circular dependency with workers
    from app.workers.opml_tasks import import_opml_task

    orchestration_task = await import_opml_task.kiq(
        user_id=user_id,
        opml_content=opml_content,
        default_folder_name=default_folder_name,
        filename=filename,
    )

    # 4. Store ownership for authorization
    await store_task_ownership(
        task_id=orchestration_task.task_id,
        user_id=user_id,
    )

    logger.info(
        "OPML import queued",
        user_id=user_id,
        task_id=orchestration_task.task_id,
        feed_count=feed_count,
    )

    # 5. Return response
    return OpmlImportResponse(
        task_id=orchestration_task.task_id,
        message=(
            f"OPML file queued for processing. "
            "New feeds will be imported and existing feeds will be updated/reorganized as needed."
        ),
        estimated_feeds=feed_count,
    )


async def process_opml_import(
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
                folder_id=str(folder_id) if folder_id else None,
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
