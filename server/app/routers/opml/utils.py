"""Shared utilities for OPML import/export operations."""

import time
from datetime import datetime, timezone
from typing import Any

import structlog
from defusedxml import ElementTree
from fastapi import HTTPException, status
from taskiq_redis.exceptions import ResultIsMissingError

from app.core.constants import OPML_IMPORT_TASK_TTL_SECONDS
from app.core.metrics import opml_validation_total
from app.core.redis_cache import RedisCache
from app.core.taskiq_app import broker
from app.schemas import FeedImportError, OpmlImportState

logger = structlog.get_logger(__name__)


def validate_opml_structure(content: str, filename: str) -> int:
    """Validate OPML file structure and count feeds.

    Parses the OPML XML to ensure it's valid and counts feeds properly using
    XML parsing instead of naive string search.

    Args:
        content: OPML file content as string
        filename: Original filename for error reporting

    Returns:
        int: Number of feeds found in the OPML file

    Raises:
        HTTPException: If XML is malformed or not a valid OPML file
    """
    start_time = time.perf_counter()

    try:
        root = ElementTree.fromstring(content)
    except ElementTree.ParseError as e:
        duration = time.perf_counter() - start_time
        opml_validation_total.labels(status="invalid_xml").inc()

        logger.warning(
            "Failed to parse OPML XML",
            filename=filename,
            error=str(e),
            error_type="ParseError",
            duration_seconds=round(duration, 3),
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Invalid XML structure in OPML file: {str(e)}. "
                "Please ensure the file is a valid OPML document exported from an RSS reader."
            ),
        ) from e

    # Verify it's an OPML file (not RSS or other XML)
    if root.tag != "opml":
        duration = time.perf_counter() - start_time
        opml_validation_total.labels(status="invalid_structure").inc()

        logger.warning(
            "File is not OPML format",
            filename=filename,
            root_tag=root.tag,
            duration_seconds=round(duration, 3),
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Invalid file format. Expected OPML root element, got '{root.tag}'. "
                "This appears to be an RSS/Atom feed file, not an OPML subscription list. "
                "Please export your feed subscriptions as OPML from your RSS reader."
            ),
        )

    # Check for body element
    body = root.find(".//body")
    if body is None:
        duration = time.perf_counter() - start_time
        opml_validation_total.labels(status="invalid_structure").inc()

        logger.warning(
            "OPML missing body element",
            filename=filename,
            duration_seconds=round(duration, 3),
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid OPML structure: missing <body> element. Please check your OPML file.",
        )

    # Count feeds properly using XML parsing (feeds have xmlUrl attribute)
    feeds = root.findall(".//outline[@xmlUrl]")
    feed_count = len(feeds)

    duration = time.perf_counter() - start_time
    opml_validation_total.labels(status="success").inc()

    logger.info(
        "OPML structure validated",
        filename=filename,
        feed_count=feed_count,
        duration_seconds=round(duration, 3),
    )

    return feed_count


async def store_task_ownership(task_id: str, user_id: str) -> None:
    """
    Store minimal ownership info for authorization.

    Only stores user_id for authorization checks. All other metadata
    (filename, estimated_feeds, created_at) is stored in the task result.

    Args:
        task_id: Taskiq task ID
        user_id: UUID of the user who owns this import task
    """
    redis_cache = RedisCache()

    # Store ownership for quick auth checks
    owner_key = f"opml_task_owner:{task_id}"
    await redis_cache.set(owner_key, user_id, ttl_seconds=OPML_IMPORT_TASK_TTL_SECONDS)

    # Add to user's task list for listing endpoint
    user_tasks_key = f"opml_import_tasks:user:{user_id}"
    existing_tasks = await redis_cache.get(user_tasks_key) or []
    if task_id not in existing_tasks:
        existing_tasks.append(task_id)
        await redis_cache.set(user_tasks_key, existing_tasks, ttl_seconds=OPML_IMPORT_TASK_TTL_SECONDS)


async def get_task_owner(task_id: str) -> str | None:
    """
    Get task owner for authorization.

    Args:
        task_id: Taskiq task ID to look up

    Returns:
        str | None: User ID if found, None otherwise
    """
    redis_cache = RedisCache()
    owner_key = f"opml_task_owner:{task_id}"
    return await redis_cache.get(owner_key)


async def get_user_task_ids(user_id: str) -> list[str]:
    """
    Get all task IDs for a user.

    Args:
        user_id: User UUID

    Returns:
        list[str]: List of task IDs
    """
    redis_cache = RedisCache()
    user_tasks_key = f"opml_import_tasks:user:{user_id}"
    return await redis_cache.get(user_tasks_key) or []


async def cleanup_task_ownership(task_id: str, user_id: str) -> None:
    """
    Clean up task ownership data.

    Args:
        task_id: Taskiq task ID to remove
        user_id: UUID of the user who owns the task
    """
    redis_cache = RedisCache()

    # Remove ownership
    owner_key = f"opml_task_owner:{task_id}"
    await redis_cache.delete(owner_key)

    # Remove from user's list
    user_tasks_key = f"opml_import_tasks:user:{user_id}"
    existing_tasks = await redis_cache.get(user_tasks_key) or []
    if task_id in existing_tasks:
        existing_tasks.remove(task_id)
        if existing_tasks:
            await redis_cache.set(user_tasks_key, existing_tasks, ttl_seconds=OPML_IMPORT_TASK_TTL_SECONDS)
        else:
            await redis_cache.delete(user_tasks_key)


async def get_taskiq_result(task_id: str) -> tuple[str, Any | None, Any | None] | None:
    """
    Get task result from Taskiq result backend.

    Args:
        task_id: Taskiq task ID

    Returns:
        Tuple of (state, result, error) or None if task not found
        State can be: "pending", "success", "failure"
    """
    if not broker.result_backend:
        # In test mode with InMemoryBroker, result backend might not be available
        return None

    try:
        # Check if result is ready
        is_ready = await broker.result_backend.is_result_ready(task_id)
        if not is_ready:
            return ("pending", None, None)

        # Get the result
        taskiq_result = await broker.result_backend.get_result(task_id)

        if taskiq_result.is_err:
            return ("failure", None, taskiq_result.error)
        else:
            return ("success", taskiq_result.return_value, None)
    except ResultIsMissingError:
        # Task not found in result backend
        return None
    except Exception as e:
        logger.warning(
            "Error getting task result from Taskiq",
            task_id=task_id,
            error=str(e),
        )
        return None


async def set_import_cancellation_flag(task_id: str) -> None:
    """
    Set cancellation flag for an import task.

    Args:
        task_id: Import task ID to cancel
    """
    redis_cache = RedisCache()
    cancel_key = f"opml_import_cancel:{task_id}"
    await redis_cache.set(cancel_key, True, ttl_seconds=OPML_IMPORT_TASK_TTL_SECONDS)
    logger.info("Set cancellation flag for import task", task_id=task_id)


async def check_import_cancellation_flag(task_id: str) -> bool:
    """
    Check if an import task has been cancelled.

    Args:
        task_id: Import task ID to check

    Returns:
        True if the task should be cancelled, False otherwise
    """
    redis_cache = RedisCache()
    cancel_key = f"opml_import_cancel:{task_id}"
    is_cancelled = await redis_cache.get(cancel_key)
    return bool(is_cancelled)


async def clear_import_cancellation_flag(task_id: str) -> None:
    """
    Clear cancellation flag for an import task.

    Args:
        task_id: Import task ID to clear
    """
    redis_cache = RedisCache()
    cancel_key = f"opml_import_cancel:{task_id}"
    await redis_cache.delete(cancel_key)


async def initialize_import_progress(
    task_id: str,
    user_id: str,
    filename: str,
    total_feeds: int,
) -> OpmlImportState:
    """
    Initialize progress state for a new import task.

    Creates the single Redis key that will track all progress for this import.

    Args:
        task_id: Taskiq task ID
        user_id: User ID who owns the import
        filename: Original OPML filename
        total_feeds: Total number of feeds to import

    Returns:
        OpmlImportState: Initialized state
    """
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
    """
    Get current import progress state from Redis.

    Args:
        task_id: Taskiq task ID

    Returns:
        OpmlImportState | None: Current state or None if not found
    """
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
    """
    Atomically update import progress for a single feed completion.

    This function loads the current state, updates it, and saves it back.
    Redis operations are atomic at the key level.

    Args:
        task_id: Taskiq task ID
        success: Whether the feed was successfully imported
        already_exists: Whether the feed already existed
        error: Error information if the feed failed
        status: New overall status to set
        started_at: ISO timestamp when processing started
        completed_at: ISO timestamp when processing completed
        message: Status message to set
        cancelled: Whether this feed was cancelled
        skipped_limit: Whether this feed was skipped due to subscription limit

    Returns:
        OpmlImportState | None: Updated state or None if not found
    """
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
    """
    Delete import progress state from Redis.

    Args:
        task_id: Taskiq task ID
    """
    redis_cache = RedisCache()
    progress_key = f"opml_import_progress:{task_id}"
    await redis_cache.delete(progress_key)

    logger.debug("Deleted import progress state", task_id=task_id)
