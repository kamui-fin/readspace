"""
OPML Import Service.

Orchestrates parsing, folder creation, and background task dispatch.
Handles both the initial upload (router-facing) and the background processing (worker-facing).
"""

from uuid import UUID

import structlog
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.custom_exceptions import ValidationError
from app.services.opml.parsing import parse_opml
from app.services.opml.tasks import store_task_ownership
from app.services.user.resource_limits import enforce_subscription_limit
from app.typing.opml import OpmlImportResponse

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
    # 1. Parse to validate structure and get count
    # 1. Parse to validate structure and get count
    try:
        feeds = parse_opml(opml_content, default_folder_name)
    except ValueError as e:
        raise ValidationError(message=str(e)) from e

    feed_count = len(feeds)

    if feed_count == 0:
        raise ValidationError(message="No feed entries found in OPML file.")

    # 2. Check subscription limits
    # This raises HTTPException(429) if limit exceeded
    await enforce_subscription_limit(db, UUID(user_id), additional_count=feed_count)

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
            "OPML file queued for processing. "
            "New feeds will be imported and existing feeds will be updated/reorganized as needed."
        ),
        estimated_feeds=feed_count,
    )
