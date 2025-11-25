from fastapi import APIRouter, Depends, Path

from app.services.opml.tasks import cancel_user_task, list_user_tasks
from app.services.user.auth import get_current_user
from app.typing.opml import OpmlImportCancelResponse, OpmlTaskMetadata
from app.typing.user import TokenData

router = APIRouter()


@router.get(
    "/import/tasks",
    response_model=list[OpmlTaskMetadata],
    summary="List user's active import tasks",
    description="Get a list of all active OPML import tasks for the authenticated user.",
)
async def list_user_import_tasks(
    current_user: TokenData = Depends(get_current_user),
) -> list[OpmlTaskMetadata]:
    """
    List all active OPML import tasks for the authenticated user.
    """
    return await list_user_tasks(current_user.sub)


@router.get(
    "/import/active",
    response_model=OpmlTaskMetadata | None,
    summary="Get most recent active import task",
    description="Retrieve the most recently created active OPML import task for the user.",
)
async def get_active_import_task(
    current_user: TokenData = Depends(get_current_user),
) -> OpmlTaskMetadata | None:
    """
    Get the most recent active OPML import task for the authenticated user.
    """
    tasks = await list_user_tasks(current_user.sub)

    if not tasks:
        return None

    # Return the most recent task (tasks are ordered by creation time typically, or we sort)
    # tasks from list_user_tasks are metadata objects.
    # created_at is ISO format string.
    return max(tasks, key=lambda x: x.created_at)


@router.delete(
    "/import/cancel/{task_id}",
    response_model=OpmlImportCancelResponse,
    summary="Cancel OPML import task",
    description="Cancel a running or pending OPML import task and clean up associated resources.",
)
async def cancel_import_task(
    task_id: str = Path(
        ...,
        description="Taskiq task ID of the import to cancel",
    ),
    current_user: TokenData = Depends(get_current_user),
) -> OpmlImportCancelResponse:
    """
    Cancel a running or pending OPML import task.
    """
    return await cancel_user_task(task_id, current_user.sub)
