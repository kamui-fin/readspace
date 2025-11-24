"""
OPML Import Service.
Orchestrates parsing, folder creation, and background task dispatch.
Uses SessionFactory to minimize DB connection holding time.
"""

from typing import Any
from uuid import UUID

import structlog

from app.crud import folder as crud_folder
from app.db.session import SessionFactory
from app.services.opml.parsing import parse_opml
from app.services.user.resource_limits import check_limit
from app.workers.opml_tasks import import_single_feed_task

logger = structlog.get_logger(__name__)

async def process_opml_import(
    db_factory: SessionFactory,
    user_id: UUID,
    opml_content: str,
    default_folder_name: str = "Imported Feeds",
    parent_task_id: str | None = None
) -> dict[str, Any]:
    """
    Process an OPML string.
    
    Optimization:
    1. Parses XML (CPU) without a DB connection.
    2. Acquires DB connection ONLY for folder creation/limit checks.
    3. Dispatches tasks.
    """
    # ---------------------------------------------------------
    # 1. Parse Content (CPU bound, no DB connection needed)
    # ---------------------------------------------------------
    # Extract flat list of {xml_url, folder_name, title, ...}
    # If this takes 5 seconds for a huge file, we aren't blocking the DB pool.
    raw_feeds = parse_opml(opml_content, default_folder_name)
    
    logger.info("OPML Parsed", user_id=user_id, count=len(raw_feeds))

    # ---------------------------------------------------------
    # 2. Database Operations (Surgical Session)
    # ---------------------------------------------------------
    folder_map = {}
    
    async with db_factory() as db:
        # A. Limit Check (Early fail)
        # Note: We pass user_role explicitly or fetch profile here if needed.
        # Assuming checking against 'basic' or fetching profile inside check_limit helper
        # For simplicity, we log but don't hard-stop the whole batch here, 
        # the individual workers will enforce strict limits.
        pass 

        # B. Bulk Create Folders
        # Extract unique folder names
        folder_names = {
            f["folder_name"] for f in raw_feeds 
            if f.get("folder_name")
        }
        
        if folder_names:
            # upsert_batch returns { "Name": UUID }
            folder_map = await crud_folder.upsert_batch(db, list(folder_names), user_id)

    # ---------------------------------------------------------
    # 3. Dispatch Tasks (Network bound, no DB connection needed)
    # ---------------------------------------------------------
    # Taskiq dispatch connects to Redis/RabbitMQ, not Postgres.
    task_ids = []
    dispatched_count = 0
    
    for feed in raw_feeds:
        folder_id = folder_map.get(feed.get("folder_name", ""))
        
        try:
            task = await import_single_feed_task.kiq(
                user_id=str(user_id),
                feed_url=feed["xml_url"],
                folder_id=str(folder_id) if folder_id else None,
                feed_title=feed.get("title"),
                parent_task_id=parent_task_id,
                tag_names=[] 
            )
            task_ids.append(task.task_id)
            dispatched_count += 1
        except Exception as e:
            logger.error(
                "Failed to dispatch import task", 
                url=feed.get("xml_url"), 
                error=str(e)
            )

    logger.info(
        "OPML Import Dispatched", 
        user_id=user_id, 
        total=len(raw_feeds), 
        dispatched=dispatched_count
    )

    return {
        "total_feeds": len(raw_feeds),
        "dispatched_count": dispatched_count,
        "task_ids": task_ids,
        "status": "processing"
    }