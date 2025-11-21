"""OPML import progress tracking utilities.

This module is separate from routers to avoid circular imports.
Workers can import these functions without importing router code.
"""

from datetime import datetime, timezone

import structlog

from app.core.constants import OPML_IMPORT_TASK_TTL_SECONDS
from app.core.redis_cache import RedisCache
from app.schemas import FeedImportError, OpmlImportState

logger = structlog.get_logger(__name__)


async def set_import_cancellation_flag(task_id: str) -> None:
    """Set cancellation flag for an import task."""
    redis_cache = RedisCache()
    cancel_key = f"opml_import_cancel:{task_id}"
    await redis_cache.set(cancel_key, True, ttl_seconds=OPML_IMPORT_TASK_TTL_SECONDS)
    logger.info("Set cancellation flag for import task", task_id=task_id)


async def check_import_cancellation_flag(task_id: str) -> bool:
    """Check if an import task has been cancelled."""
    redis_cache = RedisCache()
    cancel_key = f"opml_import_cancel:{task_id}"
    is_cancelled = await redis_cache.get(cancel_key)
    return bool(is_cancelled)


async def clear_import_cancellation_flag(task_id: str) -> None:
    """Clear cancellation flag for an import task."""
    redis_cache = RedisCache()
    cancel_key = f"opml_import_cancel:{task_id}"
    await redis_cache.delete(cancel_key)


async def initialize_import_progress(
    task_id: str,
    user_id: str,
    filename: str,
    total_feeds: int,
) -> OpmlImportState:
    """Initialize progress state for a new import task."""
    redis_cache = RedisCache()

    state = OpmlImportState(
        task_id=task_id,
        user_id=user_id,
        filename=filename,
        total_feeds=total_feeds,
        status="pending",
    )

    progress_key = f"opml_import_progress:{task_id}"
    await redis_cache.set(
        progress_key,
        state.model_dump(),
        ttl_seconds=OPML_IMPORT_TASK_TTL_SECONDS,
    )

    logger.info(
        "Initialized import progress state",
        task_id=task_id,
        user_id=user_id,
        total_feeds=total_feeds,
    )

    return state


async def get_import_progress(task_id: str) -> OpmlImportState | None:
    """Get current import progress state from Redis."""
    redis_cache = RedisCache()
    progress_key = f"opml_import_progress:{task_id}"

    state_dict = await redis_cache.get(progress_key)
    if not state_dict:
        return None

    return OpmlImportState(**state_dict)


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
    """Atomically update import progress for a single feed completion."""
    redis_cache = RedisCache()
    progress_key = f"opml_import_progress:{task_id}"

    # Get current state
    state = await get_import_progress(task_id)
    if not state:
        logger.warning(
            "Attempted to update non-existent import progress",
            task_id=task_id,
        )
        return None

    # Update counters
    if cancelled:
        state.cancelled_count += 1
        state.completed_feeds += 1
    elif skipped_limit:
        state.skipped_limit += 1
        state.completed_feeds += 1
    elif success:
        if already_exists:
            state.already_existed += 1
        else:
            state.successful_imports += 1
        state.completed_feeds += 1
    elif error:
        state.failed_imports += 1
        state.completed_feeds += 1
        state.errors.append(error)

    # Update status and timestamps
    if status:
        state.status = status
    if started_at:
        state.started_at = started_at
    if completed_at:
        state.completed_at = completed_at
    if message:
        state.message = message

    # Auto-complete if all feeds are processed
    if state.completed_feeds >= state.total_feeds and state.status == "in_progress":
        state.status = "completed"
        state.completed_at = datetime.now(timezone.utc).isoformat()

        # Generate completion message
        completion_message = (
            f"{state.successful_imports} feeds added. {state.already_existed} were already in your library."
        )
        if state.failed_imports > 0:
            completion_message += f" {state.failed_imports} failed to import."
        if state.skipped_limit > 0:
            completion_message += f" {state.skipped_limit} skipped due to subscription limit."
        if state.cancelled_count > 0:
            completion_message += f" {state.cancelled_count} cancelled."
            state.status = "cancelled"

        state.message = completion_message

        logger.info(
            "Import completed automatically",
            task_id=task_id,
            successful=state.successful_imports,
            failed=state.failed_imports,
            already_existed=state.already_existed,
            cancelled=state.cancelled_count,
        )

    # Save back to Redis
    await redis_cache.set(
        progress_key,
        state.model_dump(),
        ttl_seconds=OPML_IMPORT_TASK_TTL_SECONDS,
    )

    logger.debug(
        "Updated import progress",
        task_id=task_id,
        completed=state.completed_feeds,
        total=state.total_feeds,
        status=state.status,
    )

    return state


async def delete_import_progress(task_id: str) -> None:
    """Delete import progress state from Redis."""
    redis_cache = RedisCache()
    progress_key = f"opml_import_progress:{task_id}"
    await redis_cache.delete(progress_key)

    logger.debug("Deleted import progress state", task_id=task_id)
