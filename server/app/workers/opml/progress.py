"""OPML import progress tracking utilities.

This module is separate from routers to avoid circular imports.
Workers can import these functions without importing router code.
"""

import json
from datetime import datetime, timezone

import redis.asyncio as redis
import structlog

from app.core.constants import OPML_IMPORT_TASK_TTL_SECONDS
from app.core.redis_cache import RedisCache
from app.schemas import FeedImportError, OpmlImportState

logger = structlog.get_logger(__name__)


async def _get_redis() -> redis.Redis:
    """Get Redis client from connection pool."""
    pool = await RedisCache.get_pool()
    return redis.Redis(connection_pool=pool)


async def set_import_cancellation_flag(task_id: str) -> None:
    """Set cancellation flag for an import task."""
    async with await _get_redis() as r:
        cancel_key = f"opml_import_cancel:{task_id}"
        await r.setex(cancel_key, OPML_IMPORT_TASK_TTL_SECONDS, "1")
    logger.info("Set cancellation flag for import task", task_id=task_id)


async def check_import_cancellation_flag(task_id: str) -> bool:
    """Check if an import task has been cancelled."""
    async with await _get_redis() as r:
        cancel_key = f"opml_import_cancel:{task_id}"
        return bool(await r.get(cancel_key))


async def clear_import_cancellation_flag(task_id: str) -> None:
    """Clear cancellation flag for an import task."""
    async with await _get_redis() as r:
        cancel_key = f"opml_import_cancel:{task_id}"
        await r.delete(cancel_key)


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
        total_feeds=total_feeds,
        status="pending",
    )

    progress_key = f"opml_import_progress:{task_id}"

    async with await _get_redis() as r:
        # Store metadata (non-counter fields)
        await r.setex(
            f"{progress_key}:meta",
            OPML_IMPORT_TASK_TTL_SECONDS,
            json.dumps({
                "task_id": task_id,
                "user_id": user_id,
                "filename": filename,
                "total_feeds": total_feeds,
                "status": "pending",
                "created_at": state.created_at,
            }),
        )
        
        # Initialize atomic counters
        await r.hset(
            f"{progress_key}:counters",
            mapping={
                "completed_feeds": 0,
                "successful_imports": 0,
                "failed_imports": 0,
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

    async with await _get_redis() as r:
        # Get metadata
        meta_json = await r.get(f"{progress_key}:meta")
        if not meta_json:
            return None
        
        meta = json.loads(meta_json)
        
        # Get atomic counters
        counters = await r.hgetall(f"{progress_key}:counters")
        
        # Get errors list
        errors_raw = await r.lrange(f"{progress_key}:errors", 0, -1)
        errors = [FeedImportError(**json.loads(e)) for e in errors_raw] if errors_raw else []
        
        # Build state from metadata + counters
        return OpmlImportState(
            task_id=meta["task_id"],
            user_id=meta["user_id"],
            filename=meta["filename"],
            created_at=meta.get("created_at"),
            started_at=meta.get("started_at"),
            completed_at=meta.get("completed_at"),
            status=meta.get("status", "pending"),
            total_feeds=meta["total_feeds"],
            completed_feeds=int(counters.get("completed_feeds", 0)),
            successful_imports=int(counters.get("successful_imports", 0)),
            failed_imports=int(counters.get("failed_imports", 0)),
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
    status: str | None = None,
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

    async with await _get_redis() as r:
        # Check if exists
        if not await r.exists(f"{progress_key}:meta"):
            logger.warning("Attempted to update non-existent import progress", task_id=task_id)
            return None
        
        # Atomically increment counters
        if cancelled:
            await r.hincrby(f"{progress_key}:counters", "cancelled_count", 1)
            await r.hincrby(f"{progress_key}:counters", "completed_feeds", 1)
        elif skipped_limit:
            await r.hincrby(f"{progress_key}:counters", "skipped_limit", 1)
            await r.hincrby(f"{progress_key}:counters", "completed_feeds", 1)
        elif success:
            if already_exists:
                await r.hincrby(f"{progress_key}:counters", "already_existed", 1)
            else:
                await r.hincrby(f"{progress_key}:counters", "successful_imports", 1)
            await r.hincrby(f"{progress_key}:counters", "completed_feeds", 1)
        elif error:
            await r.hincrby(f"{progress_key}:counters", "failed_imports", 1)
            await r.hincrby(f"{progress_key}:counters", "completed_feeds", 1)
            await r.rpush(f"{progress_key}:errors", error.model_dump_json())
            await r.expire(f"{progress_key}:errors", OPML_IMPORT_TASK_TTL_SECONDS)
        
        # Refresh TTL
        await r.expire(f"{progress_key}:counters", OPML_IMPORT_TASK_TTL_SECONDS)
        
        # Update metadata fields if provided
        meta_json = await r.get(f"{progress_key}:meta")
        meta = json.loads(meta_json)
        
        if status:
            meta["status"] = status
        if started_at:
            meta["started_at"] = started_at
        if completed_at:
            meta["completed_at"] = completed_at
        if message:
            meta["message"] = message
        
        # Get current counters to check completion
        counters = await r.hgetall(f"{progress_key}:counters")
        completed_feeds = int(counters.get("completed_feeds", 0))
        total_feeds = meta["total_feeds"]
        
        # Auto-complete if all feeds processed
        if completed_feeds >= total_feeds and meta.get("status") == "in_progress":
            meta["status"] = "completed"
            meta["completed_at"] = datetime.now(timezone.utc).isoformat()
            
            # Generate completion message
            successful = int(counters.get("successful_imports", 0))
            failed = int(counters.get("failed_imports", 0))
            existed = int(counters.get("already_existed", 0))
            skipped = int(counters.get("skipped_limit", 0))
            cancelled_count = int(counters.get("cancelled_count", 0))
            
            msg = f"{successful} feeds added. {existed} were already in your library."
            if failed > 0:
                msg += f" {failed} failed to import."
            if skipped > 0:
                msg += f" {skipped} skipped due to subscription limit."
            if cancelled_count > 0:
                msg += f" {cancelled_count} cancelled."
                meta["status"] = "cancelled"
            
            meta["message"] = msg
            
            logger.info(
                "Import completed automatically",
                task_id=task_id,
                successful=successful,
                failed=failed,
                already_existed=existed,
                cancelled=cancelled_count,
            )
        
        # Save updated metadata
        await r.setex(f"{progress_key}:meta", OPML_IMPORT_TASK_TTL_SECONDS, json.dumps(meta))
    
    # Return updated state
    return await get_import_progress(task_id)


async def delete_import_progress(task_id: str) -> None:
    """Delete import progress state from Redis."""
    progress_key = f"opml_import_progress:{task_id}"
    
    async with await _get_redis() as r:
        await r.delete(
            f"{progress_key}:meta",
            f"{progress_key}:counters",
            f"{progress_key}:errors",
        )
    
    logger.debug("Deleted import progress state", task_id=task_id)
