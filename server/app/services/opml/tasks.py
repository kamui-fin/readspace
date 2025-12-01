"""
OPML Task Management Service.

Handles task ownership, listing, cancellation, and status retrieval.
Interacts with Redis for state management.
"""

from datetime import datetime, timezone

import structlog
from fastapi import HTTPException, status
from redis.asyncio import Redis

from app.core.constants import OPML_IMPORT_TASK_TTL_SECONDS
from app.core.redis_cache import get_pool
from app.typing.common import ImportStatus
from app.typing.opml import (
    OpmlImportCancelResponse,
    OpmlImportStatusResponse,
    OpmlTaskMetadata,
)
from app.workers.opml.progress import OpmlImportTracker

logger = structlog.get_logger(__name__)


class TaskRepository:
    """
    Abstracts Redis keys and storage for User <-> Task relationships.
    Uses Redis Sets (SADD/SREM) for atomic updates.
    """

    def __init__(self):
        self.ttl = OPML_IMPORT_TASK_TTL_SECONDS

    @property
    def pool(self):
        return get_pool()

    def _owner_key(self, task_id: str) -> str:
        return f"opml_task_owner:{task_id}"

    def _user_list_key(self, user_id: str) -> str:
        return f"opml_import_tasks:user:{user_id}"

    async def assign_ownership(self, task_id: str, user_id: str) -> None:
        async with Redis(connection_pool=self.pool) as r:
            async with r.pipeline() as pipe:
                # 1. Set direct ownership key
                pipe.setex(self._owner_key(task_id), self.ttl, user_id)
                # 2. Add to user's set of tasks (Atomic SADD)
                pipe.sadd(self._user_list_key(user_id), task_id)
                pipe.expire(self._user_list_key(user_id), self.ttl)
                await pipe.execute()

    async def get_owner(self, task_id: str) -> str | None:
        async with Redis(connection_pool=self.pool) as r:
            owner = await r.get(self._owner_key(task_id))
            if owner is None:
                return None
            # Handle both bytes and str (depending on decode_responses setting)
            return owner.decode() if isinstance(owner, bytes) else owner

    async def remove_ownership(self, task_id: str, user_id: str) -> None:
        async with Redis(connection_pool=self.pool) as r:
            async with r.pipeline() as pipe:
                pipe.delete(self._owner_key(task_id))
                pipe.srem(self._user_list_key(user_id), task_id)
                await pipe.execute()

    async def get_user_task_ids(self, user_id: str) -> set[str]:
        async with Redis(connection_pool=self.pool) as r:
            members = await r.smembers(self._user_list_key(user_id))
            return {m.decode() if isinstance(m, bytes) else m for m in members}


# --- Service Functions ---

repo = TaskRepository()


async def store_task_ownership(task_id: str, user_id: str) -> None:
    await repo.assign_ownership(task_id, user_id)


async def get_task_owner(task_id: str) -> str | None:
    return await repo.get_owner(task_id)


async def cleanup_user_task(task_id: str, user_id: str) -> None:
    """
    Remove task ownership and user association.
    Used for cleaning up completed/old tasks.
    """
    await repo.remove_ownership(task_id, user_id)


async def list_user_tasks(user_id: str) -> list[OpmlTaskMetadata]:
    """
    List all active OPML import tasks for the user.
    Lazily cleans up tasks that have expired from Redis.
    """
    task_ids = await repo.get_user_task_ids(user_id)
    active_tasks = []

    # We collect IDs that are totally missing from Redis to clean up the User Set
    expired_ids = []

    for task_id in task_ids:
        try:
            tracker = OpmlImportTracker(task_id)
            state = await tracker.get_state()

            if not state:
                # If state is None, the data TTL expired, or it never started.
                # Check if we still have ownership data (it might be just queued)
                if await repo.get_owner(task_id):
                    active_tasks.append(
                        OpmlTaskMetadata(
                            user_id=user_id,
                            task_id=task_id,
                            estimated_feeds=0,
                            filename="processing...",
                            created_at=datetime.now(timezone.utc).isoformat(),
                            status=ImportStatus.PENDING,
                        )
                    )
                else:
                    # Truly gone. Mark for cleanup.
                    expired_ids.append(task_id)
                continue

            if state.status == ImportStatus.CANCELLED:
                # Clean up cancelled tasks immediately if found
                await tracker.delete()
                await repo.remove_ownership(task_id, user_id)
                continue

            active_tasks.append(state.to_metadata())

        except Exception as e:
            logger.error(
                "Error retrieving task metadata", task_id=task_id, error=str(e)
            )
            # Include as unknown rather than hiding it, so user knows something happened
            active_tasks.append(
                OpmlTaskMetadata(
                    user_id=user_id,
                    task_id=task_id,
                    estimated_feeds=0,
                    filename="error",
                    created_at=datetime.now(timezone.utc).isoformat(),
                    status=ImportStatus.UNKNOWN,
                )
            )

    # Lazy cleanup of expired/orphaned IDs
    for task_id in expired_ids:
        await repo.remove_ownership(task_id, user_id)

    # Sort by created_at desc (newest first)
    active_tasks.sort(key=lambda x: x.created_at, reverse=True)
    return active_tasks


async def get_task_status(task_id: str, user_id: str) -> OpmlImportStatusResponse:
    """
    Get the current status and progress of an OPML import task.
    """
    tracker = OpmlImportTracker(task_id)
    state = await tracker.get_state()

    # 1. Handle Missing State (Expired or Queued)
    if not state:
        owner = await repo.get_owner(task_id)
        if not owner:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Import task not found or has expired.",
            )

        if owner != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail="Access denied."
            )

        # It exists in ownership but no state yet -> Pending
        return OpmlImportStatusResponse(
            task_id=task_id,
            status=ImportStatus.PENDING,
            message="OPML import is queued.",
            metadata=OpmlTaskMetadata(
                user_id=user_id,
                task_id=task_id,
                estimated_feeds=0,
                filename="...",
                created_at=datetime.now(timezone.utc).isoformat(),
                status=ImportStatus.PENDING,
            ),
        )

    # 2. Verify Ownership
    if state.user_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Access denied."
        )

    # 3. Build Response
    response = OpmlImportStatusResponse(
        task_id=task_id,
        status=state.status,
        message=state.message or "Processing...",
        metadata=state.to_metadata(),
    )

    if state.status == ImportStatus.IN_PROGRESS:
        response.progress = state.to_progress()
        if not state.message:
            # Use OPML title if available for better UX
            source_name = state.opml_title or state.filename
            response.message = (
                f"Importing '{source_name}': {state.progress_percentage}%"
            )

    elif state.status in (ImportStatus.COMPLETED, ImportStatus.CANCELLED):
        response.result = state.to_result()
        # Note: We do NOT remove ownership here. We let it expire naturally
        # so the user can see the success message.

    elif state.status == ImportStatus.FAILED:
        response.error = state.message or "Unknown error"
        if state.errors:
            response.error = f"Failed with {len(state.errors)} errors."

    return response


async def cancel_user_task(task_id: str, user_id: str) -> OpmlImportCancelResponse:
    """
    Cancel a user's import task.
    """
    owner = await repo.get_owner(task_id)
    if not owner or owner != user_id:
        # If it doesn't exist, we treat it as 404. If owned by another, 403.
        # To avoid leaking existence, strict 404 is sometimes better,
        # but here we stick to standard HTTP semantics.
        if not owner:
            raise HTTPException(status_code=404, detail="Task not found.")
        raise HTTPException(status_code=403, detail="Access denied.")

    tracker = OpmlImportTracker(task_id)
    state = await tracker.get_state()

    # If state is gone but ownership exists, it's pending/stuck.
    # We just clean up ownership.
    if not state:
        await repo.remove_ownership(task_id, user_id)
        return OpmlImportCancelResponse(
            task_id=task_id,
            message="Task cancelled (was pending).",
            cancelled=True,
            previous_state=ImportStatus.PENDING,
        )

    if state.status in [ImportStatus.COMPLETED, ImportStatus.FAILED]:
        return OpmlImportCancelResponse(
            task_id=task_id,
            message=f"Cannot cancel: Task is {state.status.value}.",
            cancelled=False,
            previous_state=state.status,
        )

    if state.status == ImportStatus.CANCELLED:
        return OpmlImportCancelResponse(
            task_id=task_id,
            message="Task is already cancelled.",
            cancelled=True,
            previous_state=ImportStatus.CANCELLED,
        )

    # 1. Signal workers to stop
    await tracker.cancel()

    # 2. Delete task data immediately
    await tracker.delete()
    await repo.remove_ownership(task_id, user_id)

    return OpmlImportCancelResponse(
        task_id=task_id,
        message="Cancellation processed.",
        cancelled=True,
        previous_state=state.status,
    )
