import time
from typing import Any
from uuid import UUID

import structlog
from fastapi import APIRouter, Depends, File, Form, HTTPException, Path, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import FALLBACK_ENCODINGS, MAX_OPML_FILE_SIZE_MB, SUPPORTED_OPML_EXTENSIONS
from app.crud.profile import get_profile_by_id
from app.db.session import get_db
from app.schemas import OpmlImportResponse, OpmlImportStatusResponse
from app.schemas.auth import TokenData
from app.services.user.auth import get_current_user
from app.services.user.resource_limits import ResourceLimitService
from app.workers.opml_tasks import import_opml_task

from .utils import (
    cleanup_task_ownership,
    get_import_progress,
    get_task_owner,
    store_task_ownership,
    validate_opml_structure,
)

logger = structlog.get_logger(__name__)
router = APIRouter()


@router.post(
    "/import/",
    response_model=OpmlImportResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Import RSS feeds from OPML file",
    description="Upload an OPML file to import RSS feeds into the user's library. The import process runs asynchronously in the background.",
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
                                "detail": "File encoding error. Please ensure the OPML file is saved with UTF-8 encoding, or try exporting it again from your RSS reader."
                            },
                        },
                        "invalid_opml": {
                            "summary": "Malformed OPML content",
                            "value": {
                                "detail": "Invalid OPML file: Invalid XML structure. Please check that you've exported a valid OPML file from your RSS reader."
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
    start_time = time.perf_counter()

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
                size_mb=round(file_size_mb, 2),
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
            encoding_found = False
            for encoding in FALLBACK_ENCODINGS:
                try:
                    content_str = content_bytes.decode(encoding)
                    encoding_found = True
                    logger.info(
                        "OPML file decoded with alternate encoding",
                        encoding=encoding,
                        filename=opml_file.filename,
                        user_id=current_user.sub,
                        fallback_attempts=FALLBACK_ENCODINGS.index(encoding) + 1,
                    )
                    break
                except UnicodeDecodeError:
                    continue

            if not encoding_found:
                logger.warning(
                    "Failed to decode OPML file with any encoding",
                    filename=opml_file.filename,
                    user_id=current_user.sub,
                    encodings_tried=["utf-8"] + list(FALLBACK_ENCODINGS),
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
        profile = await get_profile_by_id(db, user_id=UUID(current_user.sub))
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
            size_mb=round(file_size_mb, 2),
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

        duration = time.perf_counter() - start_time

        logger.info(
            "OPML import request accepted",
            task_id=orchestration_task.task_id,
            filename=opml_file.filename,
            size_mb=round(file_size_mb, 2),
            feed_count=feed_count,
            user_id=current_user.sub,
            duration_seconds=round(duration, 3),
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
    from datetime import datetime, timezone

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
