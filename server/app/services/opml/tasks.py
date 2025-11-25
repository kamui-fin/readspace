"""
OPML Task Management Service.

Handles task ownership, listing, cancellation, and status retrieval.
Interacts with Redis for state management.
"""

import structlog
from datetime import datetime, timezone
from fastapi import HTTPException, status

from app.core.constants import OPML_IMPORT_TASK_TTL_SECONDS
from app.core.redis_cache import delete, get, set
from app.models.enums import ImportStatus
from app.typing.opml import OpmlImportCancelResponse, OpmlTaskMetadata, OpmlImportStatusResponse
from app.workers.opml.progress import (
    get_import_progress,
    set_import_cancellation_flag,
    update_import_progress,
)

logger = structlog.get_logger(__name__)


async def store_task_ownership(task_id: str, user_id: str) -> None:
    """
    Store minimal ownership info for authorization.
    """
    # Store ownership for quick auth checks
    owner_key = f"opml_task_owner:{task_id}"
    await set(owner_key, user_id, ttl_seconds=OPML_IMPORT_TASK_TTL_SECONDS)

    # Add to user's task list for listing endpoint
    user_tasks_key = f"opml_import_tasks:user:{user_id}"
    existing_tasks = await get(user_tasks_key) or []
    if task_id not in existing_tasks:
        existing_tasks.append(task_id)
        await set(user_tasks_key, existing_tasks, ttl_seconds=OPML_IMPORT_TASK_TTL_SECONDS)


async def get_task_owner(task_id: str) -> str | None:
    """
    Get task owner for authorization.
    """
    owner_key = f"opml_task_owner:{task_id}"
    return await get(owner_key)


async def cleanup_task_ownership(task_id: str, user_id: str) -> None:
    """
    Clean up task ownership data.
    """
    # Remove ownership
    owner_key = f"opml_task_owner:{task_id}"
    await delete(owner_key)

    # Remove from user's list
    user_tasks_key = f"opml_import_tasks:user:{user_id}"
    existing_tasks = await get(user_tasks_key) or []
    if task_id in existing_tasks:
        existing_tasks.remove(task_id)
        if existing_tasks:
            await set(user_tasks_key, existing_tasks, ttl_seconds=OPML_IMPORT_TASK_TTL_SECONDS)
        else:
            await delete(user_tasks_key)


async def list_user_tasks(user_id: str) -> list[OpmlTaskMetadata]:
    """
    List all active OPML import tasks for the user.
    Clean up completed/stale tasks.
    """
    user_tasks_key = f"opml_import_tasks:user:{user_id}"
    task_ids = await get(user_tasks_key) or []

    active_tasks = []
    tasks_to_remove = []

    for task_id in task_ids:
        try:
            state = await get_import_progress(task_id)

            if not state:
                # No progress state yet, task is still pending or lost
                # Create a pending metadata object
                active_tasks.append(
                    OpmlTaskMetadata(
                        user_id=user_id,
                        task_id=task_id,
                        estimated_feeds=0,
                        filename="unknown.opml",
                        created_at=datetime.now(timezone.utc).isoformat(),
                        status=ImportStatus.PENDING,
                    )
                )
                continue

            if state.status in [ImportStatus.COMPLETED, ImportStatus.CANCELLED, ImportStatus.FAILED]:
                tasks_to_remove.append(task_id)
            else:
                active_tasks.append(state.to_metadata())

        except Exception as e:
            logger.warning("Error checking task status", task_id=task_id, error=str(e))
            # Keep in list but mark unknown if we want, or just skip
            active_tasks.append(
                OpmlTaskMetadata(
                    user_id=user_id,
                    task_id=task_id,
                    estimated_feeds=0,
                    filename="unknown.opml",
                    created_at=datetime.now(timezone.utc).isoformat(),
                    status=ImportStatus.UNKNOWN,
                )
            )

    # Clean up completed tasks
    for task_id in tasks_to_remove:
        await cleanup_task_ownership(task_id, user_id)

    return active_tasks


async def get_task_status(task_id: str, user_id: str) -> OpmlImportStatusResponse:
    """
    Get the current status and progress of an OPML import task.
    """
    # Get import progress state from Redis
    state = await get_import_progress(task_id)

    if not state:
        # Check if we have ownership record (task just queued)
        task_owner = await get_task_owner(task_id)
        if task_owner:
            if task_owner != user_id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="You don't have permission to access this import task.",
                )
            # Task exists but hasn't started yet
            return OpmlImportStatusResponse(
                task_id=task_id,
                status=ImportStatus.PENDING,
                message="OPML import is queued and waiting to start.",
                progress=None,
                result=None,
                error=None,
                metadata=OpmlTaskMetadata(
                    user_id=user_id,
                    task_id=task_id,
                    estimated_feeds=0,
                    filename="unknown.opml",
                    created_at=datetime.now(timezone.utc).isoformat(),
                    status=ImportStatus.PENDING,
                ),
            )
        else:
            logger.warning("Task not found", task_id=task_id, user_id=user_id)
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Import task not found or has expired.",
            )

    # Verify ownership
    if state.user_id != user_id:
        logger.warning(
            "Unauthorized access to import task",
            task_id=task_id,
            user_id=user_id,
            task_owner=state.user_id,
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to access this import task.",
        )

    # Build response based on status
    message = state.message
    progress = None
    result = None
    error = None

    if state.status == ImportStatus.PENDING:
        if not message:
            message = "OPML import is queued and waiting to start."

    elif state.status == ImportStatus.IN_PROGRESS:
        if not message:
            message = f"Importing feeds: {state.completed}/{state.total} completed"
        progress = state.to_progress()

    elif state.status in [ImportStatus.COMPLETED, ImportStatus.CANCELLED]:
        if not message:
            message = "Import completed."
        result = state.to_result()
        # Clean up ownership for completed task
        await cleanup_task_ownership(task_id, user_id)

    elif state.status == ImportStatus.FAILED:
        if not message:
            message = "OPML import failed. Please try again."
        error = message  # In failed state, message usually contains error info?
        # Actually errors are in state.errors list.
        if state.errors:
            error = f"Failed with {len(state.errors)} errors."

        # Clean up ownership for failed task
        await cleanup_task_ownership(task_id, user_id)

    return OpmlImportStatusResponse(
        task_id=task_id,
        status=state.status,
        message=message or "Unknown status",
        progress=progress,
        result=result,
        error=error,
        metadata=state.to_metadata(),
    )


async def cancel_user_task(task_id: str, user_id: str) -> OpmlImportCancelResponse:
    """
    Cancel a user's import task.
    """
    # Verify ownership
    owner = await get_task_owner(task_id)
    if not owner:
        # Not found or expired
        await cleanup_task_ownership(task_id, user_id)
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Import task not found or has already completed.",
        )

    if owner != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to cancel this import task.",
        )

    state = await get_import_progress(task_id)
    if not state:
        # Clean up and return "not found" equivalent or success if it's just gone
        await cleanup_task_ownership(task_id, user_id)
        return OpmlImportCancelResponse(
            task_id=task_id,
            message="Task not found or already completed.",
            cancelled=False,
            previous_state=ImportStatus.UNKNOWN,
        )

    if state.status in [ImportStatus.COMPLETED, ImportStatus.FAILED]:
        await cleanup_task_ownership(task_id, user_id)
        return OpmlImportCancelResponse(
            task_id=task_id,
            message=f"Task was already {state.status.value}.",
            cancelled=False,
            previous_state=state.status,
        )

    if state.status == ImportStatus.CANCELLED:
        await cleanup_task_ownership(task_id, user_id)
        return OpmlImportCancelResponse(
            task_id=task_id,
            message="Task was already cancelled.",
            cancelled=True,
            previous_state=ImportStatus.CANCELLED,
        )

    # Set cancellation flag
    await set_import_cancellation_flag(task_id)

    # Update progress if partially done
    if state.completed < state.total:
        await update_import_progress(
            task_id=task_id,
            status=ImportStatus.CANCELLED,
            completed_at=datetime.now(timezone.utc).isoformat(),
            message=f"Import cancelled. {state.completed} of {state.total} feeds processed.",
        )

    await cleanup_task_ownership(task_id, user_id)

    return OpmlImportCancelResponse(
        task_id=task_id, message="Cancellation requested.", cancelled=True, previous_state=state.status
    )
