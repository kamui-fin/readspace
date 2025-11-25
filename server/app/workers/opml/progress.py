"""OPML import progress tracking utilities.

This module is separate from routers to avoid circular imports.
Workers can import these functions without importing router code.
"""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from datetime import datetime, timezone

import orjson
import redis.asyncio as redis
import structlog

from app.core.constants import OPML_IMPORT_TASK_TTL_SECONDS
from app.core.redis_cache import delete as redis_delete
from app.core.redis_cache import exists as redis_exists
from app.core.redis_cache import get as redis_get
from app.core.redis_cache import get_pool
from app.core.redis_cache import set as redis_set
from app.typing.common import ImportStatus
from app.typing.opml import FeedImportError, OpmlImportState

logger = structlog.get_logger(__name__)


@asynccontextmanager
async def _get_redis() -> AsyncIterator[redis.Redis]:
    """Get Redis client from connection pool as a context manager."""
    pool = get_pool()
    async with redis.Redis(connection_pool=pool) as client:
        yield client


async def set_import_cancellation_flag(task_id: str) -> None:
    """Set cancellation flag for an import task."""
    cancel_key = f"opml_import_cancel:{task_id}"
    await redis_set(cancel_key, "1", ttl_seconds=OPML_IMPORT_TASK_TTL_SECONDS)
    logger.info("Set cancellation flag for import task", task_id=task_id)


async def check_import_cancellation_flag(task_id: str) -> bool:
    """Check if an import task has been cancelled."""
    cancel_key = f"opml_import_cancel:{task_id}"
    value = await redis_get(cancel_key)
    return bool(value)


async def initialize_import_progress(
    task_id: str,
    user_id: str,
    filename: str,
    total_feeds: int,
) -> OpmlImportState:
    """Initialize progress state for a new import task."""
    state = OpmlImportState(
        task_id=task_id,
        user_id=user_id,
        filename=filename,
        total=total_feeds,
        status=ImportStatus.PENDING,
        # Initialize counters
        completed=0,
        successful=0,
        failed=0,
        already_existed=0,
        skipped_limit=0,
        cancelled_count=0,
        errors=[],
        message=None,
        started_at=None,
        completed_at=None,
    )

    progress_key = f"opml_import_progress:{task_id}"

    # Store metadata (non-counter fields)
    meta_data = {
        "task_id": task_id,
        "user_id": user_id,
        "filename": filename,
        "total": total_feeds,
        "status": ImportStatus.PENDING.value,
        "created_at": state.created_at,
    }
    await redis_set(f"{progress_key}:meta", meta_data, ttl_seconds=OPML_IMPORT_TASK_TTL_SECONDS)

    # Initialize atomic counters (requires hash operations, so use direct Redis client)
    async with _get_redis() as r:
        await r.hset(
            f"{progress_key}:counters",
            mapping={
                "completed": 0,
                "successful": 0,
                "failed": 0,
                "already_existed": 0,
                "skipped_limit": 0,
                "cancelled_count": 0,
            },
        )
        await r.expire(f"{progress_key}:counters", OPML_IMPORT_TASK_TTL_SECONDS)

    logger.info(
        "Initialized import progress state",
        task_id=task_id,
        user_id=user_id,
        total_feeds=total_feeds,
    )

    return state


async def get_import_progress(task_id: str) -> OpmlImportState | None:
    """Get current import progress state from Redis."""
    progress_key = f"opml_import_progress:{task_id}"

    # Get metadata using redis_cache helper
    meta = await redis_get(f"{progress_key}:meta")
    if not meta:
        return None

    # Get atomic counters and errors list (requires hash/list operations)
    async with _get_redis() as r:
        counters = await r.hgetall(f"{progress_key}:counters")
        errors_raw = await r.lrange(f"{progress_key}:errors", 0, -1)

    # Parse errors
    errors = [FeedImportError(**orjson.loads(e)) for e in errors_raw] if errors_raw else []

    # Build state from metadata + counters
    # Note: counters from Redis are strings (decode_responses=True), need int conversion
    return OpmlImportState(
        task_id=meta["task_id"],
        user_id=meta["user_id"],
        filename=meta["filename"],
        created_at=meta.get("created_at"),
        started_at=meta.get("started_at"),
        completed_at=meta.get("completed_at"),
        status=ImportStatus(meta.get("status", "pending")),
        total=meta["total"],
        completed=int(counters.get("completed", 0)),
        successful=int(counters.get("successful", 0)),
        failed=int(counters.get("failed", 0)),
        already_existed=int(counters.get("already_existed", 0)),
        skipped_limit=int(counters.get("skipped_limit", 0)),
        cancelled_count=int(counters.get("cancelled_count", 0)),
        errors=errors,
        message=meta.get("message"),
    )


async def update_import_progress(
    task_id: str,
    success: bool = False,
    already_exists: bool = False,
    error: FeedImportError | None = None,
    status: ImportStatus | None = None,
    started_at: str | None = None,
    completed_at: str | None = None,
    message: str | None = None,
    cancelled: bool = False,
    skipped_limit: bool = False,
) -> OpmlImportState | None:
    """Atomically update import progress.

    Uses Redis HINCRBY for atomic counter increments.
    """
    progress_key = f"opml_import_progress:{task_id}"

    # Check if exists using redis_cache helper
    if not await redis_exists(f"{progress_key}:meta"):
        logger.warning("Attempted to update non-existent import progress", task_id=task_id)
        return None

    # Get current metadata
    meta = await redis_get(f"{progress_key}:meta")
    if not meta:
        logger.warning("Failed to retrieve import progress metadata", task_id=task_id)
        return None

    # Atomically increment counters and update errors (requires hash/list operations)
    async with _get_redis() as r:
        # Atomically increment counters
        if cancelled:
            await r.hincrby(f"{progress_key}:counters", "cancelled_count", 1)
            await r.hincrby(f"{progress_key}:counters", "completed", 1)
        elif skipped_limit:
            await r.hincrby(f"{progress_key}:counters", "skipped_limit", 1)
            await r.hincrby(f"{progress_key}:counters", "completed", 1)
        elif success:
            if already_exists:
                await r.hincrby(f"{progress_key}:counters", "already_existed", 1)
            else:
                await r.hincrby(f"{progress_key}:counters", "successful", 1)
            await r.hincrby(f"{progress_key}:counters", "completed", 1)
        elif error:
            await r.hincrby(f"{progress_key}:counters", "failed", 1)
            await r.hincrby(f"{progress_key}:counters", "completed", 1)
            await r.rpush(f"{progress_key}:errors", error.model_dump_json())
            await r.expire(f"{progress_key}:errors", OPML_IMPORT_TASK_TTL_SECONDS)

        # Refresh TTL
        await r.expire(f"{progress_key}:counters", OPML_IMPORT_TASK_TTL_SECONDS)

        # Get current counters to check completion
        counters = await r.hgetall(f"{progress_key}:counters")

    # Update metadata fields if provided
    meta_changed = False

    if status:
        meta["status"] = status.value
        meta_changed = True
    if started_at:
        meta["started_at"] = started_at
        meta_changed = True
    if completed_at:
        meta["completed_at"] = completed_at
        meta_changed = True
    if message:
        meta["message"] = message
        meta_changed = True

    # Check completion status
    completed = int(counters.get("completed", 0))
    total = meta["total"]

    # Auto-complete if all feeds processed
    # Only if currently in progress
    current_status = ImportStatus(meta.get("status", "pending"))
    if completed >= total and current_status == ImportStatus.IN_PROGRESS:
        meta["status"] = ImportStatus.COMPLETED.value
        meta["completed_at"] = datetime.now(timezone.utc).isoformat()
        meta_changed = True

        # Generate completion message
        successful = int(counters.get("successful", 0))
        failed = int(counters.get("failed", 0))
        existed = int(counters.get("already_existed", 0))
        skipped = int(counters.get("skipped_limit", 0))
        cancelled_cnt = int(counters.get("cancelled_count", 0))

        msg = f"{successful} feeds added. {existed} were already in your library."
        if failed > 0:
            msg += f" {failed} failed to import."
        if skipped > 0:
            msg += f" {skipped} skipped due to subscription limit."
        if cancelled_cnt > 0:
            msg += f" {cancelled_cnt} cancelled."
            meta["status"] = ImportStatus.CANCELLED.value

        meta["message"] = msg

        logger.info(
            "Import completed automatically",
            task_id=task_id,
            successful=successful,
            failed=failed,
            already_existed=existed,
            cancelled=cancelled_cnt,
        )

    # Save updated metadata using redis_cache helper
    if meta_changed:
        await redis_set(f"{progress_key}:meta", meta, ttl_seconds=OPML_IMPORT_TASK_TTL_SECONDS)

    # Return updated state
    return await get_import_progress(task_id)


async def delete_import_progress(task_id: str) -> None:
    """Delete import progress state from Redis."""
    progress_key = f"opml_import_progress:{task_id}"

    # Delete all related keys
    await redis_delete(f"{progress_key}:meta")
    await redis_delete(f"{progress_key}:counters")
    await redis_delete(f"{progress_key}:errors")

    logger.debug("Deleted import progress state", task_id=task_id)
