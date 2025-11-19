from datetime import datetime, timezone

import structlog
from fastapi import APIRouter, Depends, HTTPException, Path, status

from app.schemas import OpmlImportCancelResponse, OpmlTaskMetadata
from app.schemas.auth import TokenData
from app.services.user.auth import get_current_user

from .utils import (
    cleanup_task_ownership,
    get_import_progress,
    get_task_owner,
    get_user_task_ids,
    set_import_cancellation_flag,
    update_import_progress,
)

logger = structlog.get_logger(__name__)
router = APIRouter()


@router.get(
    "/import/tasks",
    response_model=list[OpmlTaskMetadata],
    summary="List user's active import tasks",
    description="Get a list of all active OPML import tasks for the authenticated user.",
    responses={
        200: {
            "description": "List of active import tasks retrieved successfully",
            "model": list[OpmlTaskMetadata],
        },
        401: {"description": "Authentication required"},
    },
)
async def list_user_import_tasks(
    current_user: TokenData = Depends(get_current_user),
) -> list[OpmlTaskMetadata]:
    """
    List all active OPML import tasks for the authenticated user.

    This endpoint returns a list of currently running or recently completed
    import tasks for the user. Completed tasks are automatically cleaned up
    from the list.

    **Task Cleanup:**
    - Completed tasks are removed from the active list
    - Failed tasks are also cleaned up automatically
    - Tasks are kept for 24 hours before expiring

    **Task Information:**
    Each task includes:
    - Task ID for status checking
    - Original filename
    - Estimated number of feeds
    - Creation timestamp
    - Current status

    **Use Cases:**
    - Check if any imports are currently running
    - Display import history in UI
    - Prevent multiple simultaneous imports
    - Resume checking status after page refresh

    Args:
        current_user: Authenticated user information

    Returns:
        list[OpmlTaskMetadata]: List of active import tasks
    """
    # Get task IDs from Redis
    task_ids = await get_user_task_ids(current_user.sub)

    # Build metadata from progress states
    active_tasks = []
    tasks_to_remove = []

    for task_id in task_ids:
        try:
            # Get progress state from Redis
            state = await get_import_progress(task_id)

            if not state:
                # No progress state yet, task is still pending
                task_metadata = OpmlTaskMetadata(
                    user_id=current_user.sub,
                    task_id=task_id,
                    estimated_feeds=0,
                    filename="unknown.opml",
                    created_at=datetime.now(timezone.utc).isoformat(),
                    status="pending",
                    current_status="pending",
                )
                active_tasks.append(task_metadata)
                continue

            # Check if task is completed
            if state.status in ["completed", "cancelled", "failed"]:
                tasks_to_remove.append(task_id)
            else:
                # Still active
                active_tasks.append(state.to_metadata())

        except Exception as e:
            logger.warning(
                "Error checking task status in list_user_import_tasks",
                task_id=task_id,
                error=str(e),
            )
            # Keep the task in list but mark as unknown
            task_metadata = OpmlTaskMetadata(
                user_id=current_user.sub,
                task_id=task_id,
                estimated_feeds=0,
                filename="unknown.opml",
                created_at=datetime.now(timezone.utc).isoformat(),
                status="pending",
                current_status="unknown",
            )
            active_tasks.append(task_metadata)

    # Clean up completed tasks from Redis
    if tasks_to_remove:
        for task_id in tasks_to_remove:
            await cleanup_task_ownership(task_id, current_user.sub)

    return active_tasks


@router.get(
    "/import/active",
    response_model=OpmlTaskMetadata | None,
    summary="Get most recent active import task",
    description="Retrieve the most recently created active OPML import task for the user.",
    responses={
        200: {
            "description": "Active import task retrieved (or null if none active)",
            "content": {
                "application/json": {
                    "examples": {
                        "active_task": {
                            "summary": "User has an active import",
                            "value": {
                                "user_id": "123e4567-e89b-12d3-a456-426614174000",
                                "task_id": "550e8400-e29b-41d4-a716-446655440000",
                                "estimated_feeds": 45,
                                "filename": "my_feeds.opml",
                                "created_at": "2024-01-15T10:30:00Z",
                                "status": "pending",
                                "current_status": "in_progress",
                            },
                        },
                        "no_active_task": {
                            "summary": "No active imports",
                            "value": None,
                        },
                    }
                }
            },
        },
        401: {"description": "Authentication required"},
    },
)
async def get_active_import_task(
    current_user: TokenData = Depends(get_current_user),
) -> OpmlTaskMetadata | None:
    """
    Get the most recent active OPML import task for the authenticated user.

    This is a convenience endpoint that returns the latest import task,
    useful for UI components that need to show current import status.

    **Return Value:**
    - Returns the most recently created active task
    - Returns `null` if no active tasks exist
    - Tasks are ordered by creation timestamp

    **Use Cases:**
    - Show import progress in header/navigation
    - Determine if user can start a new import
    - Auto-redirect to status page for ongoing imports
    - Display quick status in dashboard

    Args:
        current_user: Authenticated user information

    Returns:
        OpmlTaskMetadata | None: Most recent active task or None
    """
    tasks = await list_user_import_tasks(current_user)

    if not tasks:
        return None

    # Return the most recent task (tasks are ordered by creation time)
    return max(tasks, key=lambda x: x.get("created_at", ""))


@router.delete(
    "/import/cancel/{task_id}",
    response_model=OpmlImportCancelResponse,
    summary="Cancel OPML import task",
    description="Cancel a running or pending OPML import task and clean up associated resources.",
    responses={
        200: {
            "description": "Import task cancelled successfully",
            "model": OpmlImportCancelResponse,
        },
        403: {
            "description": "Access denied - user doesn't own this task",
            "content": {
                "application/json": {"example": {"detail": "You don't have permission to cancel this import task."}}
            },
        },
        404: {
            "description": "Import task not found or already completed",
            "content": {"application/json": {"example": {"detail": "Import task not found or has already completed."}}},
        },
        500: {"description": "Error cancelling import task"},
    },
)
async def cancel_import_task(
    task_id: str = Path(
        ...,
        description="Taskiq task ID of the import to cancel",
        examples={
            "uuid": "550e8400-e29b-41d4-a716-446655440000",
        },
    ),
    current_user: TokenData = Depends(get_current_user),
) -> OpmlImportCancelResponse:
    """
    Cancel a running or pending OPML import task.

    This endpoint allows users to cancel their own import tasks that are
    currently running or waiting in the queue.

    **Cancellation Process:**
    1. Verifies user ownership of the task
    2. Sets a cancellation flag in Redis that the worker checks
    3. Cleans up task metadata
    4. Worker stops processing new feeds once it sees the flag

    **Cooperative Cancellation:**
    This uses a cooperative cancellation model:
    - A cancellation flag is set in Redis
    - The worker checks this flag before processing each feed
    - Feeds already being processed will complete
    - No new feeds will be started after the flag is set

    **Cancellation States:**
    - `pending`: Task can be cancelled (flag set, no feeds processed yet)
    - `in_progress`: Partial cancellation (some feeds complete, remaining skipped)
    - `completed`: Cannot cancel already finished tasks
    - `failed`: Cannot cancel already failed tasks

    **Cleanup:**
    All associated metadata is removed from Redis to prevent orphaned data.

    **Security:**
    Users can only cancel their own import tasks. Ownership is verified
    through Redis metadata before allowing cancellation.

    Args:
        task_id: UUID of the import task to cancel
        current_user: Authenticated user information

    Returns:
        OpmlImportCancelResponse: Cancellation result and cleanup summary

    Raises:
        HTTPException: 403 for unauthorized access, 404 for missing tasks, 500 for server errors
    """
    # Check ownership
    task_owner = await get_task_owner(task_id)

    if not task_owner:
        logger.warning(
            "Attempted to cancel non-existent task",
            task_id=task_id,
            user_id=current_user.sub,
        )
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Import task not found or has already completed. Redirecting to import page.",
        )

    # Verify user ownership
    if task_owner != current_user.sub:
        logger.warning(
            "Unauthorized attempt to cancel import task",
            task_id=task_id,
            user_id=current_user.sub,
            task_owner=task_owner,
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to cancel this import task.",
        )

    try:
        # Get progress state to check current status
        state = await get_import_progress(task_id)

        if not state:
            # Task not found, might already be cleaned up
            logger.info(
                "Attempted to cancel task that doesn't exist",
                task_id=task_id,
                user_id=current_user.sub,
            )
            await cleanup_task_ownership(task_id, current_user.sub)
            return {
                "task_id": task_id,
                "message": "Task not found or already completed. Redirecting to import page.",
                "cancelled": False,
                "previous_state": "unknown",
                "redirect_url": "/import-opml",
            }

        # Check if task can be cancelled (already completed or failed)
        if state.status in ["completed", "failed"]:
            logger.info(
                "Attempted to cancel already completed task",
                task_id=task_id,
                state=state.status,
                user_id=current_user.sub,
            )
            # Clean up metadata for completed task
            await cleanup_task_ownership(task_id, current_user.sub)
            return {
                "task_id": task_id,
                "message": f"Task was already {state.status}. Redirecting to import page.",
                "cancelled": False,
                "previous_state": state.status,
                "redirect_url": "/import-opml",
            }

        # If already cancelled, just confirm
        if state.status == "cancelled":
            logger.info(
                "Task was already cancelled",
                task_id=task_id,
                user_id=current_user.sub,
            )
            await cleanup_task_ownership(task_id, current_user.sub)
            return {
                "task_id": task_id,
                "message": "Task was already cancelled. Redirecting to import page.",
                "cancelled": True,
                "previous_state": "cancelled",
                "redirect_url": "/import-opml",
            }

        # Set cooperative cancellation flag
        # The worker will check this flag and stop processing new feeds
        await set_import_cancellation_flag(task_id)

        # Update progress state to cancelled if not completed yet
        if state.completed_feeds < state.total_feeds:
            # Mark remaining feeds as cancelled
            await update_import_progress(
                task_id=task_id,
                status="cancelled",
                completed_at=datetime.now(timezone.utc).isoformat(),
                message=f"Import cancelled. {state.completed_feeds} of {state.total_feeds} feeds were processed.",
            )

        # Clean up ownership
        await cleanup_task_ownership(task_id, current_user.sub)

        logger.info(
            "Set cancellation flag for OPML import task",
            task_id=task_id,
            user_id=current_user.sub,
        )

        return {
            "task_id": task_id,
            "message": (
                "Cancellation requested. The import will stop processing new feeds. "
                "Feeds already being processed will complete. Redirecting to import page."
            ),
            "cancelled": True,
            "cancelled_subtasks": 0,  # Cooperative cancellation, no direct subtask cancellation
            "redirect_url": "/import-opml",
        }

    except Exception as e:
        logger.error(
            "Error cancelling import task",
            task_id=task_id,
            error=str(e),
            user_id=current_user.sub,
            exc_info=True,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to cancel import task.",
        ) from e
