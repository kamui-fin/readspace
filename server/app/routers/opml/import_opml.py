"""OPML import routes - upload and status checking."""

from typing import Annotated

import structlog
from fastapi import APIRouter, Depends, File, Form, Path, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import MAX_OPML_FILE_SIZE_MB, SUPPORTED_OPML_EXTENSIONS
from app.core.custom_exceptions import ValidationError
from app.db.session import get_db
from app.services.opml.opml_import import handle_opml_upload
from app.services.opml.tasks import get_task_status
from app.services.user.auth import get_current_user
from app.typing.opml import OpmlImportResponse, OpmlImportStatusResponse
from app.typing.user import TokenData

logger = structlog.get_logger(__name__)
router = APIRouter()


# --- Helpers ---
async def validate_and_read_opml(file: UploadFile) -> str:
    """
    Validates file extension, size, and encoding. Returns decoded content string.
    Raises ValidationError on failure.
    """
    # 1. Check Extension
    if not file.filename or not file.filename.endswith(SUPPORTED_OPML_EXTENSIONS):
        raise ValidationError(message="Invalid file type. Please upload a .opml or .xml file.")

    # 2. Check Size
    if file.size:
        file_size_mb = file.size / (1024 * 1024)
        if file_size_mb > MAX_OPML_FILE_SIZE_MB:
            raise ValidationError(message=f"File too large. Maximum size is {MAX_OPML_FILE_SIZE_MB}MB.")

    # 3. Read Content
    content_bytes = await file.read()

    # 4. Decode
    try:
        return content_bytes.decode("utf-8")
    except UnicodeDecodeError as e:
        raise ValidationError(message="File encoding error. Please ensure the OPML file is UTF-8 encoded.") from e
    finally:
        await file.close()


# --- Routes ---
@router.post(
    "/import/",
    response_model=OpmlImportResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Import RSS feeds from OPML file",
    description="Upload an OPML file to asynchronously import RSS feeds.",
)
async def import_opml_file(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[TokenData, Depends(get_current_user)],
    opml_file: Annotated[UploadFile, File(description="OPML/XML file (max 50MB)")],
    default_folder_name: Annotated[str | None, Form(min_length=1, max_length=100)] = "Imported Feeds",
) -> OpmlImportResponse:
    """
    Initiates asynchronous OPML import.
    """
    logger.bind(user_id=current_user.sub, filename=opml_file.filename)

    # 1. Validate & Read
    content_str = await validate_and_read_opml(opml_file)

    # 2. Start Import Task
    # Service raises ValidationError if XML parsing fails
    response = await handle_opml_upload(
        db,
        current_user.sub,
        content_str,
        opml_file.filename or "unknown.opml",
        default_folder_name or "Imported Feeds",
    )

    logger.info("OPML import started successfully", task_id=response.task_id)
    return response


@router.get(
    "/import/status/{task_id}",
    response_model=OpmlImportStatusResponse,
    summary="Get OPML import task status",
)
async def get_import_status(
    task_id: Annotated[str, Path(description="Taskiq task ID")],
    current_user: Annotated[TokenData, Depends(get_current_user)],
) -> OpmlImportStatusResponse:
    """
    Retrieve the current status and progress of an OPML import task.
    """
    logger.bind(user_id=current_user.sub, task_id=task_id)

    # Service handles logic, returns Pydantic model
    return await get_task_status(task_id, current_user.sub)
