from datetime import datetime, timezone
from typing import Any
from uuid import UUID

import structlog
# AsyncResult is no longer needed with Taskiq
from defusedxml import ElementTree
from fastapi import APIRouter, Depends, File, Form, HTTPException, Path, UploadFile, status
from fastapi.responses import PlainTextResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import (
    FALLBACK_ENCODINGS,
    MAX_OPML_FILE_SIZE_MB,
    OPML_IMPORT_TASK_TTL_SECONDS,
    SUPPORTED_OPML_EXTENSIONS,
)
from app.core.redis_cache import RedisCache
from app.crud.profile import crud_profile
from app.db.session import get_db
from app.schemas import (
    OpmlImportCancelResponse,
    OpmlImportResponse,
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


async def store_import_task_metadata(user_id: str, task_id: str, estimated_feeds: int, filename: str) -> None:
    """
    Store import task metadata in Redis for user ownership tracking.

    Creates two Redis keys for efficient access patterns:
    1. User-specific key for listing all user tasks
    2. Task-specific key for quick ownership verification

    Args:
        user_id: UUID of the user who owns this import task
        task_id: Celery task ID
        estimated_feeds: Number of feeds estimated to be imported
        filename: Original name of the uploaded OPML file

    Note:
        Data expires after 24 hours to prevent Redis bloat
    """
    redis_cache = RedisCache()
    task_metadata = {
        "user_id": user_id,
        "task_id": task_id,
        "estimated_feeds": estimated_feeds,
        "filename": filename,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "status": "pending",
    }

    # Store with two keys for different access patterns
    # 1. User -> task mapping (for listing user's tasks)
    user_tasks_key = f"opml_import_tasks:user:{user_id}"
    existing_tasks = await redis_cache.get(user_tasks_key) or []

    # Remove any old tasks for this user that might be completed
    active_tasks = []
    for task in existing_tasks:
        if task.get("task_id") != task_id:
            active_tasks.append(task)

    active_tasks.append(task_metadata)
    await redis_cache.set(user_tasks_key, active_tasks, ttl_seconds=OPML_IMPORT_TASK_TTL_SECONDS)

    # 2. Task -> metadata mapping (for auth and quick lookup)
    task_key = f"opml_import_task:{task_id}"
    await redis_cache.set(task_key, task_metadata, ttl_seconds=OPML_IMPORT_TASK_TTL_SECONDS)


async def get_import_task_metadata(task_id: str) -> dict[str, Any] | None:
    """
    Get import task metadata from Redis.

    Args:
        task_id: Celery task ID to look up

    Returns:
        dict[str, Any] | None: Task metadata if found, None if not found or expired
    """
    redis_cache = RedisCache()
    task_key = f"opml_import_task:{task_id}"
    return await redis_cache.get(task_key)


async def cleanup_completed_task(user_id: str, task_id: str) -> None:
    """
    Remove completed task from Redis.

    Cleans up both the user's task list and the individual task metadata
    to prevent Redis bloat from completed imports.

    Args:
        user_id: UUID of the user who owns the task
        task_id: Celery task ID to remove
    """
    redis_cache = RedisCache()

    # Remove from user's active tasks list
    user_tasks_key = f"opml_import_tasks:user:{user_id}"
    existing_tasks = await redis_cache.get(user_tasks_key) or []
    active_tasks = [task for task in existing_tasks if task.get("task_id") != task_id]

    if active_tasks:
        await redis_cache.set(user_tasks_key, active_tasks, ttl_seconds=OPML_IMPORT_TASK_TTL_SECONDS)
    else:
        await redis_cache.delete(user_tasks_key)

    # Remove task metadata
    task_key = f"opml_import_task:{task_id}"
    await redis_cache.delete(task_key)


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
                    "example": {
                        "detail": "Cannot import 100 feeds. You have 25 subscription slots remaining (current: 0/25). Please upgrade your plan or remove some feeds before importing."
                    }
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
    into the user's library. The import process runs in the background using Celery
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
                        f"Cannot import {feed_count} feeds. You have {remaining_capacity} subscription slots "
                        f"remaining (current: {current_usage}/{max_limit}). Please upgrade your plan or "
                        f"remove some feeds before importing."
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
        )

        # Store task metadata in Redis for persistence and auth
        await store_import_task_metadata(
            user_id=current_user.sub,
            task_id=orchestration_task.task_id,
            estimated_feeds=feed_count,
            filename=opml_file.filename or "unknown.opml",
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
    description="Retrieve the current status and progress of an OPML import task.",
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
        description="Celery task ID returned from the import endpoint",
        examples={
            "uuid": "550e8400-e29b-41d4-a716-446655440000",
        },
    ),
    current_user: TokenData = Depends(get_current_user),
) -> OpmlImportStatusResponse:
    """
    Get the current status and progress of an OPML import task.

    This endpoint provides real-time status information for background OPML import
    tasks, including progress details and final results.

    **Status Types:**
    - `pending`: Task is queued and waiting to start
    - `in_progress`: Task is actively processing feeds
    - `completed`: All feeds have been processed
    - `failed`: Task encountered an unrecoverable error

    **Progress Information:**
    For active imports, the response includes:
    - Number of feeds completed vs total
    - Success/failure breakdown
    - Individual feed errors (if any)

    **Completed Results:**
    For finished imports, detailed results include:
    - Count of successfully imported feeds
    - Count of feeds that already existed
    - Count of failed imports with error details
    - Summary message

    **Security:**
    Users can only access status for their own import tasks.
    Task ownership is verified via Redis metadata.

    Args:
        task_id: UUID of the import task to check
        current_user: Authenticated user information

    Returns:
        OpmlImportStatusResponse: Current status, progress, and results

    Raises:
        HTTPException: 403 for unauthorized access, 404 for missing tasks, 500 for server errors
    """
    # Try to get task metadata from Redis
    task_metadata = await get_import_task_metadata(task_id)

    # If metadata exists, verify user ownership
    if task_metadata and task_metadata.get("user_id") != current_user.sub:
        logger.warning(
            "Unauthorized access to import task",
            task_id=task_id,
            user_id=current_user.sub,
            task_owner=task_metadata.get("user_id"),
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to access this import task.",
        )

    try:
        task_result = AsyncResult(task_id)

        # If task doesn't exist in Celery either, it's truly not found
        if task_result.state == "PENDING" and not task_metadata:
            logger.warning(
                "Task not found in both Redis and Celery",
                task_id=task_id,
                user_id=current_user.sub,
            )
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Import task not found or has expired.",
            )

        # If we have metadata but no user verification was done above, verify now
        if not task_metadata:
            logger.info(
                "Task metadata missing from Redis, checking Celery task only",
                task_id=task_id,
                user_id=current_user.sub,
            )
            # Without metadata, we can't verify user ownership, but we can still return task status
            # This is a fallback for cases where Redis data was lost but Celery task still exists

        if task_result.state == "PENDING":
            return {
                "task_id": task_id,
                "status": "pending",
                "message": "OPML import is queued and waiting to start.",
                "metadata": task_metadata,
            }
        elif task_result.state == "PROGRESS":
            return {
                "task_id": task_id,
                "status": "in_progress",
                "message": "OPML import is being processed and individual feeds are being queued.",
                "progress": task_result.info,
                "metadata": task_metadata,
            }
        elif task_result.state == "SUCCESS":
            # Orchestration completed, now check individual feed import tasks
            orchestration_data = task_result.result
            feed_task_ids = orchestration_data.get("task_ids", [])

            if not feed_task_ids:
                # Clean up task metadata for completed task if it exists
                if task_metadata:
                    await cleanup_completed_task(current_user.sub, task_id)

                return {
                    "task_id": task_id,
                    "status": "completed",
                    "result": {
                        "imported_count": 0,
                        "failed_count": 0,
                        "already_existed_count": 0,
                        "total_feeds": 0,
                        "summary": {"successful": 0, "failed": 0, "already_existed": 0},
                        "message": "No feeds found to import.",
                    },
                    "metadata": task_metadata,
                }

            # Check status of individual feed import tasks
            completed_tasks = 0
            successful_imports = 0
            failed_imports = 0
            already_existed = 0
            errors = []

            logger.info(
                "Checking status of individual feed import tasks",
                total_tasks=len(feed_task_ids),
                task_id=task_id,
            )

            for i, feed_task_id in enumerate(feed_task_ids):
                feed_task_result = AsyncResult(feed_task_id)
                logger.debug(
                    "Checking feed import task",
                    task_index=i,
                    feed_task_id=feed_task_id,
                    state=feed_task_result.state,
                )

                if feed_task_result.state == "SUCCESS":
                    completed_tasks += 1
                    task_data = feed_task_result.result

                    if task_data.get("success"):
                        task_status = task_data.get("status", "unknown")
                        if task_status == "already_exists":
                            already_existed += 1
                        elif task_status in ["imported", "imported_or_updated"]:
                            successful_imports += 1
                        else:
                            # Log unexpected status for debugging
                            logger.warning(
                                "Unexpected success status during OPML import",
                                task_id=feed_task_id,
                                status=task_status,
                                url=task_data.get("url"),
                            )
                            # Treat as successful import by default
                            successful_imports += 1
                    else:
                        failed_imports += 1
                        errors.append(
                            {
                                "url": task_data.get("url", "Unknown"),
                                "title": task_data.get("title", "Unknown"),
                                "error": task_data.get("error", "Unknown error"),
                                "status": task_data.get("status", "unknown"),
                            }
                        )
                elif feed_task_result.state == "FAILURE":
                    completed_tasks += 1
                    failed_imports += 1

                    # Try to get error information
                    error_info = {
                        "url": "Unknown",
                        "title": "Unknown",
                        "error": str(feed_task_result.info) if feed_task_result.info else "Task failed",
                        "status": "task_failed",
                    }
                    errors.append(error_info)

            total_feeds = len(feed_task_ids)
            is_complete = completed_tasks == total_feeds

            logger.info(
                "OPML import task status summary",
                completed=completed_tasks,
                total=total_feeds,
                successful=successful_imports,
                failed=failed_imports,
                already_existed=already_existed,
                is_complete=is_complete,
            )

            if is_complete:
                # Clean up task metadata for completed task if it exists
                if task_metadata:
                    await cleanup_completed_task(current_user.sub, task_id)

                result: dict[str, Any] = {
                    "task_id": task_id,
                    "status": "completed",
                    "message": f"{successful_imports} feeds added. {already_existed} were already in your library."
                    + (f" {failed_imports} failed to import." if failed_imports > 0 else ""),
                    "result": {
                        "imported_count": successful_imports,
                        "failed_count": failed_imports,
                        "already_existed_count": already_existed,
                        "total_feeds": total_feeds,
                        "summary": {
                            "successful": successful_imports,
                            "failed": failed_imports,
                            "already_existed": already_existed,
                        },
                        "message": f"{successful_imports} feeds added. {already_existed} were already in your library."
                        + (f" {failed_imports} failed to import." if failed_imports > 0 else ""),
                    },
                    "metadata": task_metadata,
                }

                # Include error details if any failed
                if errors:
                    result["result"]["errors"] = errors

                return result
            else:
                return {
                    "task_id": task_id,
                    "status": "in_progress",
                    "message": f"Importing feeds: {completed_tasks}/{total_feeds} completed",
                    "progress": {
                        "completed": completed_tasks,
                        "total": total_feeds,
                        "successful": successful_imports,
                        "failed": failed_imports,
                        "already_existed": already_existed,
                    },
                    "metadata": task_metadata,
                }
        elif task_result.state == "FAILURE":
            # Clean up task metadata for failed task if it exists
            if task_metadata:
                await cleanup_completed_task(current_user.sub, task_id)

            return {
                "task_id": task_id,
                "status": "failed",
                "error": str(task_result.info) if task_result.info else "Unknown error",
                "message": "OPML import failed. Please try again.",
                "metadata": task_metadata,
            }
        else:
            return {
                "task_id": task_id,
                "status": task_result.state.lower(),
                "message": f"Task is in state: {task_result.state}",
                "metadata": task_metadata,
            }

    except Exception as e:
        logger.error(
            "Error fetching task status from Celery backend",
            task_id=task_id,
            error=str(e),
        )
        raise HTTPException(status_code=500, detail="Could not retrieve task status.") from e


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
    redis_cache = RedisCache()
    user_tasks_key = f"opml_import_tasks:user:{current_user.sub}"
    user_tasks = await redis_cache.get(user_tasks_key) or []

    # Clean up completed tasks and get updated status
    active_tasks = []
    tasks_to_remove = []

    for task in user_tasks:
        task_id = task.get("task_id")
        if not task_id:
            continue

        try:
            task_result = AsyncResult(task_id)

            # Check if task is completed or failed
            if task_result.state in ["SUCCESS", "FAILURE"]:
                # Check if it's truly done by looking at individual feed tasks
                if task_result.state == "SUCCESS":
                    orchestration_data = task_result.result
                    feed_task_ids = orchestration_data.get("task_ids", [])

                    if feed_task_ids:
                        # Check if all individual tasks are complete
                        all_complete = True
                        for feed_task_id in feed_task_ids:
                            feed_task_result = AsyncResult(feed_task_id)
                            if feed_task_result.state not in ["SUCCESS", "FAILURE"]:
                                all_complete = False
                                break

                        if not all_complete:
                            # Still in progress
                            task["current_status"] = "in_progress"
                            active_tasks.append(task)
                        else:
                            # Truly complete
                            tasks_to_remove.append(task_id)
                    else:
                        # No feeds to import, completed
                        tasks_to_remove.append(task_id)
                else:
                    # Failed
                    tasks_to_remove.append(task_id)
            else:
                # Still pending or in progress
                task["current_status"] = task_result.state.lower()
                active_tasks.append(task)

        except Exception as e:
            logger.warning(
                "Error checking task status in list_user_import_tasks",
                task_id=task_id,
                error=str(e),
            )
            # Keep the task in list but mark as unknown
            task["current_status"] = "unknown"
            active_tasks.append(task)

    # Clean up completed tasks from Redis
    if tasks_to_remove:
        for task_id in tasks_to_remove:
            await cleanup_completed_task(current_user.sub, task_id)

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
        description="Celery task ID of the import to cancel",
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
    2. Revokes the main orchestration task
    3. Cancels all individual feed import subtasks
    4. Cleans up Redis metadata
    5. Terminates any running workers

    **Cancellation States:**
    - `pending`: Task cancelled before starting
    - `in_progress`: Task terminated during execution
    - `completed`: Cannot cancel already finished tasks
    - `failed`: Cannot cancel already failed tasks

    **Subtask Handling:**
    For imports that have already started processing individual feeds,
    the endpoint will attempt to cancel all subtasks and report the count.

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
    # Get task metadata from Redis to verify ownership
    task_metadata = await get_import_task_metadata(task_id)

    if not task_metadata:
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
    if task_metadata.get("user_id") != current_user.sub:
        logger.warning(
            "Unauthorized attempt to cancel import task",
            task_id=task_id,
            user_id=current_user.sub,
            task_owner=task_metadata.get("user_id"),
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to cancel this import task.",
        )

    try:
        # Get the Celery task
        task_result = AsyncResult(task_id)

        # Check if task can be cancelled
        if task_result.state in ["SUCCESS", "FAILURE", "REVOKED"]:
            logger.info(
                "Attempted to cancel already completed task",
                task_id=task_id,
                state=task_result.state,
                user_id=current_user.sub,
            )
            # Clean up metadata for completed task
            await cleanup_completed_task(current_user.sub, task_id)
            return {
                "task_id": task_id,
                "message": f"Task was already {task_result.state.lower()}. Redirecting to import page.",
                "cancelled": False,
                "previous_state": task_result.state.lower(),
                "redirect_url": "/import-opml",
            }

        # Check if it's an orchestration task with individual feed tasks
        if task_result.state == "SUCCESS":
            orchestration_data = task_result.result
            feed_task_ids = orchestration_data.get("task_ids", [])

            if feed_task_ids:
                # Cancel all individual feed import tasks
                cancelled_tasks = 0
                for feed_task_id in feed_task_ids:
                    try:
                        feed_task = AsyncResult(feed_task_id)
                        if feed_task.state not in ["SUCCESS", "FAILURE", "REVOKED"]:
                            feed_task.revoke(terminate=True)
                            cancelled_tasks += 1
                    except Exception as e:
                        logger.warning(
                            "Error cancelling individual feed task",
                            feed_task_id=feed_task_id,
                            error=str(e),
                        )

                logger.info(
                    "Cancelled individual feed import tasks",
                    task_id=task_id,
                    cancelled_count=cancelled_tasks,
                    total_tasks=len(feed_task_ids),
                    user_id=current_user.sub,
                )
            else:
                # No individual tasks, just mark as cancelled
                cancelled_tasks = 0

        # Cancel the main orchestration task
        task_result.revoke(terminate=True)

        # Clean up task metadata
        await cleanup_completed_task(current_user.sub, task_id)

        logger.info(
            "Successfully cancelled OPML import task",
            task_id=task_id,
            user_id=current_user.sub,
        )

        return {
            "task_id": task_id,
            "message": "Import task cancelled successfully. Redirecting to import page.",
            "cancelled": True,
            "cancelled_subtasks": cancelled_tasks if "cancelled_tasks" in locals() else 0,
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
