from datetime import datetime, timezone
from typing import Any
from uuid import UUID

import structlog
from defusedxml import ElementTree
from fastapi import APIRouter, Depends, File, Form, HTTPException, Path, UploadFile, status
from fastapi.responses import PlainTextResponse
from sqlalchemy.ext.asyncio import AsyncSession
from taskiq_redis.exceptions import ResultIsMissingError

from app.core.constants import (
    FALLBACK_ENCODINGS,
    MAX_OPML_FILE_SIZE_MB,
    OPML_IMPORT_TASK_TTL_SECONDS,
    SUPPORTED_OPML_EXTENSIONS,
)
from app.core.redis_cache import RedisCache
from app.core.taskiq_app import broker
from app.crud.profile import crud_profile
from app.db.session import get_db
from app.schemas import (
    FeedImportError,
    OpmlImportCancelResponse,
    OpmlImportResponse,
    OpmlImportState,
    OpmlImportStatusResponse,
    OpmlTaskMetadata,
)
from app.schemas.auth import TokenData
from app.services.feeds.feed_management import FeedManagementService
from app.services.opml.opml_processor import OpmlProcessor
from app.services.user.auth import get_current_user
from app.services.user.resource_limits import ResourceLimitService
from app.workers.opml_tasks import import_opml_task  # Import the background task

logger = structlog.get_logger(__name__)
router = APIRouter(
    prefix="/opml",
    tags=["RSS OPML"],
    responses={
        401: {"description": "Authentication required"},
        422: {"description": "Validation error"},
    },
)


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
    try:
        root = ElementTree.fromstring(content)
    except ElementTree.ParseError as e:
        logger.warning(
            "Failed to parse OPML XML",
            filename=filename,
            error=str(e),
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
        logger.warning(
            "File is not OPML format",
            filename=filename,
            root_tag=root.tag,
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
        logger.warning(
            "OPML missing body element",
            filename=filename,
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid OPML structure: missing <body> element. Please check your OPML file.",
        )

    # Count feeds properly using XML parsing (feeds have xmlUrl attribute)
    feeds = root.findall(".//outline[@xmlUrl]")
    feed_count = len(feeds)

    logger.info(
        "OPML structure validated",
        filename=filename,
        feed_count=feed_count,
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


@router.post(
    "/import/",
    response_model=OpmlImportResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Import RSS feeds from OPML file",
    description="Upload an OPML file to import RSS feeds into the user's library. The import process runs asynchronously in the background.",  # noqa: E501
    responses={
        202: {
            "description": "OPML file accepted for processing",
            "model": OpmlImportResponse,
        },
        400: {
            "description": "Invalid file type, encoding error, or malformed OPML",
            "content": {
                "application/json": {
                    "examples": {
                        "invalid_file_type": {
                            "summary": "Invalid file extension",
                            "value": {"detail": "Invalid file type. Please upload a .opml or .xml file."},
                        },
                        "encoding_error": {
                            "summary": "File encoding issues",
                            "value": {
                                "detail": "File encoding error. Please ensure the OPML file is saved with UTF-8 encoding, or try exporting it again from your RSS reader."  # noqa: E501
                            },
                        },
                        "invalid_opml": {
                            "summary": "Malformed OPML content",
                            "value": {
                                "detail": "Invalid OPML file: Invalid XML structure. Please check that you've exported a valid OPML file from your RSS reader."  # noqa: E501
                            },
                        },
                    }
                }
            },
        },
        401: {"description": "Authentication required"},
        413: {
            "description": "File too large",
            "content": {"application/json": {"example": {"detail": "File too large. Maximum size is 50MB."}}},
        },
        422: {"description": "Validation error"},
        429: {
            "description": "Subscription limit exceeded",
            "content": {
                "application/json": {
                    "example": {"detail": "Importing this would exceed your feed subscription limit (25/100 left)"}
                }
            },
        },
        500: {"description": "Internal server error during import"},
    },
)
async def import_opml_file(
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
    opml_file: UploadFile = File(
        ...,
        description="OPML file to import (.opml or .xml extension, max 50MB)",
    ),
    default_folder_name: str | None = Form(
        "Imported Feeds",
        description="Default folder name for feeds without a specified folder in the OPML",
        min_length=1,
        max_length=100,
    ),
) -> OpmlImportResponse:
    """
    Import RSS feeds from an OPML file asynchronously.

    This endpoint accepts OPML files exported from RSS readers and imports the feeds
    into the user's library. The import process runs in the background using Taskiq
    tasks to handle large files efficiently.

    **Process Flow:**
    1. Validates file type and size
    2. Parses OPML content for feed URLs
    3. Queues background tasks for feed import
    4. Returns task ID for progress tracking

    **Supported File Types:**
    - .opml files (standard OPML format)
    - .xml files (XML-based OPML content)

    **File Size Limits:**
    - Maximum: 50MB
    - Recommended: Under 10MB for optimal performance

    **Error Handling:**
    - Invalid file types are rejected immediately
    - Encoding issues are handled with fallback encodings
    - Malformed OPML content results in validation errors
    - Network timeouts and memory issues are gracefully handled

    **Background Processing:**
    The import runs asynchronously to prevent timeouts on large files.
    Use the returned `task_id` to monitor progress via the status endpoint.

    Args:
        db: Database session dependency
        current_user: Authenticated user information
        opml_file: Uploaded OPML file
        default_folder_name: Folder name for feeds without specified folders

    Returns:
        OpmlImportResponse: Task information for tracking import progress

    Raises:
        HTTPException: 400 for invalid files, 413 for oversized files, 500 for server errors
    """
    if not opml_file.filename or not opml_file.filename.endswith(SUPPORTED_OPML_EXTENSIONS):
        logger.warning(
            "Invalid OPML file type uploaded",
            filename=opml_file.filename,
            user_id=current_user.sub,
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file type. Please upload a .opml or .xml file.",
        )

    try:
        content_bytes = await opml_file.read()

        # Check file size
        file_size_mb = len(content_bytes) / (1024 * 1024)

        if file_size_mb > MAX_OPML_FILE_SIZE_MB:
            logger.warning(
                "OPML file too large",
                filename=opml_file.filename,
                size_mb=file_size_mb,
                user_id=current_user.sub,
            )
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"File too large. Maximum size is {MAX_OPML_FILE_SIZE_MB}MB.",
            )

        try:
            content_str = content_bytes.decode("utf-8")
        except UnicodeDecodeError:
            # Try other common encodings
            for encoding in FALLBACK_ENCODINGS:
                try:
                    content_str = content_bytes.decode(encoding)
                    logger.info(
                        "OPML file decoded with alternate encoding",
                        encoding=encoding,
                        filename=opml_file.filename,
                        user_id=current_user.sub,
                    )
                    break
                except UnicodeDecodeError:
                    continue
            else:
                logger.warning(
                    "Failed to decode OPML file with any encoding",
                    filename=opml_file.filename,
                    user_id=current_user.sub,
                )
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=(
                        "File encoding error. Please ensure the OPML file is saved with UTF-8 encoding, "
                        "or try exporting it again from your RSS reader."
                    ),
                )

        # Validate OPML structure and count feeds properly
        feed_count = validate_opml_structure(content_str, opml_file.filename or "unknown.opml")

        # Check resource limits before importing
        profile = await crud_profile.get_by_id(db, user_id=UUID(current_user.sub))
        if not profile:
            raise HTTPException(status_code=404, detail="User profile not found")

        resource_service = ResourceLimitService(db)
        current_usage = await resource_service.get_current_usage(UUID(current_user.sub), "max_subscriptions")
        limits = resource_service.get_user_limits(str(profile.role))
        max_limit = limits.get("max_subscriptions", 0)

        # Admin users have unlimited (-1)
        if max_limit != -1:
            remaining_capacity = max_limit - current_usage
            if feed_count > remaining_capacity:
                logger.warning(
                    "OPML import would exceed subscription limit",
                    feed_count=feed_count,
                    current_usage=current_usage,
                    max_limit=max_limit,
                    remaining_capacity=remaining_capacity,
                    user_id=current_user.sub,
                    user_role=str(profile.role),
                )
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail=(
                        f"Importing this would exceed your feed subscription limit "
                        f"({remaining_capacity}/{max_limit} left)"
                    ),
                )

        # Queue orchestration task
        logger.info(
            "Queuing OPML import orchestration task",
            filename=opml_file.filename,
            size_mb=file_size_mb,
            feed_count=feed_count,
            user_id=current_user.sub,
        )

        orchestration_task = await import_opml_task.kiq(
            user_id=current_user.sub,
            opml_content=content_str,
            default_folder_name=default_folder_name,
            filename=opml_file.filename or "unknown.opml",
            estimated_feeds=feed_count,
        )

        # Store only ownership for authorization
        await store_task_ownership(
            task_id=orchestration_task.task_id,
            user_id=current_user.sub,
        )

        return {
            "processing_mode": "background",
            "task_id": orchestration_task.task_id,
            "message": (
                f"OPML file ({file_size_mb:.1f}MB) queued for processing. "
                "New feeds will be imported and existing feeds will be updated/reorganized as needed."
            ),
            "estimated_feeds": feed_count,
            "check_status_url": f"/api/rss/opml/import/status/{orchestration_task.task_id}",
            "status_page_url": f"/import-opml/status/{orchestration_task.task_id}",
        }

    except HTTPException:
        # Re-raise HTTP exceptions from validation functions without wrapping
        raise
    except ValueError as e:
        logger.warning(
            "Failed to import OPML due to validation error",
            error=str(e),
            filename=opml_file.filename,
            user_id=current_user.sub,
        )
        # Provide more user-friendly error messages
        error_message = str(e)
        if "RSS/Atom feed file" in error_message:
            # Already has a user-friendly message
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=error_message) from e
        elif "Invalid OPML format" in error_message:
            # Already has a user-friendly message
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=error_message) from e
        else:
            # Generic validation error
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"Invalid OPML file: {error_message}. Please check that you've "
                    "exported a valid OPML file from your RSS reader."
                ),
            ) from e
    except Exception as e:
        logger.error(
            "Error starting OPML import task",
            error=str(e),
            filename=opml_file.filename,
            user_id=current_user.sub,
            exc_info=True,
        )
        # Check for specific error types to provide better messages
        error_str = str(e).lower()
        if "timeout" in error_str:
            raise HTTPException(
                status_code=status.HTTP_408_REQUEST_TIMEOUT,
                detail="The import process timed out. Please try again with a smaller OPML file or try again later.",
            ) from e
        elif "memory" in error_str or "size" in error_str:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail="The OPML file is too large to process. Please try splitting it into smaller files.",
            ) from e
        else:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=(
                    "An unexpected error occurred while processing your OPML file. "
                    "Please try again, and if the problem persists, check that your OPML file is valid."
                ),
            ) from e
    finally:
        await opml_file.close()


@router.get(
    "/import/status/{task_id}",
    response_model=OpmlImportStatusResponse,
    summary="Get OPML import task status",
    description="Retrieve the current status and progress of an OPML import task from a single Redis key.",
    responses={
        200: {
            "description": "Import status retrieved successfully",
            "model": OpmlImportStatusResponse,
        },
        403: {
            "description": "Access denied - user doesn't own this task",
            "content": {
                "application/json": {"example": {"detail": "You don't have permission to access this import task."}}
            },
        },
        404: {
            "description": "Import task not found or expired",
            "content": {"application/json": {"example": {"detail": "Import task not found or has expired."}}},
        },
        500: {"description": "Error retrieving task status"},
    },
)
async def get_import_status(
    task_id: str = Path(
        ...,
        description="Taskiq task ID returned from the import endpoint",
        examples={
            "uuid": "550e8400-e29b-41d4-a716-446655440000",
        },
    ),
    current_user: TokenData = Depends(get_current_user),
) -> OpmlImportStatusResponse:
    """
    Get the current status and progress of an OPML import task.

    This endpoint reads from a single Redis key for scalable progress tracking,
    instead of checking thousands of individual task results.

    **Status Types:**
    - `pending`: Task is queued and waiting to start
    - `in_progress`: Task is actively processing feeds
    - `completed`: All feeds have been processed
    - `cancelled`: Import was cancelled by user
    - `failed`: Task encountered an unrecoverable error

    **Progress Information:**
    All progress data is maintained in a single Redis key and updated atomically
    by each feed import task. This approach scales to thousands of feeds without
    performance degradation.

    **Security:**
    Users can only access status for their own import tasks.

    Args:
        task_id: UUID of the import task to check
        current_user: Authenticated user information

    Returns:
        OpmlImportStatusResponse: Current status, progress, and results

    Raises:
        HTTPException: 403 for unauthorized access, 404 for missing tasks
    """
    # Get import progress state from Redis
    state = await get_import_progress(task_id)

    if not state:
        # Check if we have ownership record (task just queued)
        task_owner = await get_task_owner(task_id)
        if task_owner:
            if task_owner != current_user.sub:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="You don't have permission to access this import task.",
                )
            # Task exists but hasn't started yet
            return {
                "task_id": task_id,
                "status": "pending",
                "message": "OPML import is queued and waiting to start.",
                "metadata": {
                    "user_id": current_user.sub,
                    "task_id": task_id,
                    "estimated_feeds": 0,
                    "filename": "unknown.opml",
                    "created_at": datetime.now(timezone.utc).isoformat(),
                    "status": "pending",
                },
            }
        else:
            logger.warning(
                "Task not found",
                task_id=task_id,
                user_id=current_user.sub,
            )
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Import task not found or has expired.",
            )

    # Verify ownership
    if state.user_id != current_user.sub:
        logger.warning(
            "Unauthorized access to import task",
            task_id=task_id,
            user_id=current_user.sub,
            task_owner=state.user_id,
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to access this import task.",
        )

    # Build response based on status
    response: dict[str, Any] = {
        "task_id": task_id,
        "status": state.status,
        "metadata": state.to_metadata(),
    }

    if state.status == "pending":
        response["message"] = "OPML import is queued and waiting to start."
    elif state.status == "in_progress":
        response["message"] = f"Importing feeds: {state.completed_feeds}/{state.total_feeds} completed"
        response["progress"] = state.to_progress()
    elif state.status in ["completed", "cancelled"]:
        response["message"] = state.message or "Import completed."
        response["result"] = state.to_result()
        # Clean up ownership for completed task
        await cleanup_task_ownership(task_id, current_user.sub)
    elif state.status == "failed":
        response["message"] = state.message or "OPML import failed. Please try again."
        response["error"] = state.message
        # Clean up ownership for failed task
        await cleanup_task_ownership(task_id, current_user.sub)
    else:
        response["message"] = f"Task is in state: {state.status}"

    return response


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


@router.get(
    "/export/",
    response_class=PlainTextResponse,
    summary="Export user feeds to OPML",
    description="Export all of the user's RSS feeds to a standard OPML file for backup or migration.",
    responses={
        200: {
            "description": "OPML file generated successfully",
            "content": {
                "application/xml": {
                    "example": "<?xml version='1.0' encoding='UTF-8'?>\n<opml version='2.0'>\n  <head>\n    <title>Readspace Feeds Export</title>\n  </head>\n  <body>\n    <outline text='Technology' title='Technology'>\n      <outline type='rss' text='TechCrunch' title='TechCrunch' xmlUrl='https://techcrunch.com/feed/' htmlUrl='https://techcrunch.com'/>\n    </outline>\n  </body>\n</opml>"  # noqa: E501
                }
            },
        },
        401: {"description": "Authentication required"},
        500: {
            "description": "Error generating OPML export",
            "content": {
                "application/json": {"example": {"detail": "An unexpected error occurred during OPML export."}}
            },
        },
    },
)
async def export_opml_file(
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
) -> PlainTextResponse:
    """
    Export all user feeds to a standard OPML file.

    This endpoint generates an OPML file containing all of the authenticated
    user's RSS feeds, organized by folders. The file can be imported into
    other RSS readers or used as a backup.

    **OPML Structure:**
    - Feeds are organized by their folder structure
    - Each feed includes title, description, RSS URL, and website URL
    - Standard OPML 2.0 format for maximum compatibility
    - UTF-8 encoding for international characters

    **Export Contents:**
    - All subscribed feeds
    - Folder organization
    - Feed metadata (title, description, URLs)
    - Creation timestamps

    **File Format:**
    The exported file follows OPML 2.0 standards and includes:
    - XML declaration with UTF-8 encoding
    - OPML version specification
    - Header with export metadata
    - Body with nested outline elements

    **Download Behavior:**
    - File is returned as an attachment
    - Filename: `readspace_feeds_export.opml`
    - MIME type: `application/xml`
    - Browser will prompt to save the file

    **Use Cases:**
    - Backup feed subscriptions
    - Migrate to another RSS reader
    - Share feed collections
    - Archive feed lists

    Args:
        db: Database session dependency
        current_user: Authenticated user information

    Returns:
        PlainTextResponse: OPML XML content as downloadable file

    Raises:
        HTTPException: 500 for export generation errors
    """
    feed_service = FeedManagementService(db=db, user_id=UUID(current_user.sub))
    try:
        # Get all user feeds and export to OPML
        user_feeds = await feed_service.list_feeds()
        # Use OPML processor to handle export
        opml_processor = OpmlProcessor()
        opml_string = await opml_processor.export_feeds_to_opml(user_feeds)
        logger.info("OPML export successful", user_id=current_user.sub)
        return PlainTextResponse(
            content=opml_string,
            media_type="application/xml",
            headers={"Content-Disposition": "attachment; filename=readspace_feeds_export.opml"},
        )
    except Exception as e:
        logger.error(
            "Unexpected error during OPML export",
            error=str(e),
            user_id=current_user.sub,
            exc_info=True,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred during OPML export.",
        ) from e
