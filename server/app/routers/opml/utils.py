"""Shared utilities for OPML import/export operations."""

import time
from typing import Any

import structlog
from defusedxml import ElementTree
from fastapi import HTTPException, status
from taskiq_redis.exceptions import ResultIsMissingError

from app.core.constants import OPML_IMPORT_TASK_TTL_SECONDS
from app.core.redis_cache import RedisCache
from app.core.taskiq_app import broker

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


# Progress tracking functions are now imported from app.workers.opml.progress
# and re-exported above for backward compatibility
