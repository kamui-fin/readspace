"""OPML task management routes - list, active check, cancel."""

from typing import Annotated

import structlog
from fastapi import APIRouter, Depends, Path

from app.services.opml.tasks import cancel_user_task, cleanup_user_task, list_user_tasks
from app.services.user.auth import get_current_user
from app.typing.common import ImportStatus
from app.typing.opml import OpmlImportCancelResponse, OpmlTaskMetadata
from app.typing.user import TokenData

logger = structlog.get_logger(__name__)
router = APIRouter()


@router.get(
    "/import/active",
    response_model=OpmlTaskMetadata | None,
    summary="Get most recent active import task",
)
async def get_active_import_task(
    current_user: Annotated[TokenData, Depends(get_current_user)],
) -> OpmlTaskMetadata | None:
    """
    Get the most recently created active OPML import task.
    """
    logger.bind(user_id=current_user.sub)

    tasks = await list_user_tasks(current_user.sub)
    if not tasks:
        return None

    # Return the most recent task based on creation timestamp
    recent_task = max(tasks, key=lambda x: x.created_at)

    # If the most recent task is completed, clean it up and return None
    if recent_task.status == ImportStatus.COMPLETED:
        await cleanup_user_task(recent_task.task_id, current_user.sub)
        return None

    return recent_task


@router.delete(
    "/import/cancel/{task_id}",
    response_model=OpmlImportCancelResponse,
    summary="Cancel OPML import task",
)
async def cancel_import_task(
    task_id: Annotated[str, Path(description="Taskiq task ID to cancel")],
    current_user: Annotated[TokenData, Depends(get_current_user)],
) -> OpmlImportCancelResponse:
    """
    Cancel a running or pending OPML import task.
    """
    logger.bind(user_id=current_user.sub, task_id=task_id)

    result = await cancel_user_task(task_id, current_user.sub)

    logger.info("OPML task cancellation requested", cancelled=result.cancelled)
    return result
