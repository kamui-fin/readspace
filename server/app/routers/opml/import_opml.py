from fastapi import APIRouter, Depends, File, Form, HTTPException, Path, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import MAX_OPML_FILE_SIZE_MB, SUPPORTED_OPML_EXTENSIONS
from app.core.custom_exceptions import ValidationError
from app.db.session import get_db
from app.services.opml.opml_import import handle_opml_upload
from app.services.opml.tasks import get_task_status
from app.services.user.auth import get_current_user
from app.typing.opml import OpmlImportResponse, OpmlImportStatusResponse
from app.typing.user import TokenData

router = APIRouter()


@router.post(
    "/import/",
    response_model=OpmlImportResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Import RSS feeds from OPML file",
    description=(
        "Upload an OPML file to import RSS feeds into the user's library. "
        "The import process runs asynchronously in the background."
    ),
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
    """
    if not opml_file.filename or not opml_file.filename.endswith(SUPPORTED_OPML_EXTENSIONS):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file type. Please upload a .opml or .xml file.",
        )

    content_bytes = await opml_file.read()

    # Check file size
    file_size_mb = len(content_bytes) / (1024 * 1024)
    if file_size_mb > MAX_OPML_FILE_SIZE_MB:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File too large. Maximum size is {MAX_OPML_FILE_SIZE_MB}MB.",
        )

    # Decode
    try:
        content_str = content_bytes.decode("utf-8")
    except UnicodeDecodeError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "File encoding error. Please ensure the OPML file is saved with UTF-8 encoding, "
                "or try exporting it again from your RSS reader."
            ),
        ) from e

    try:
        return await handle_opml_upload(
            db,
            current_user.sub,
            content_str,
            opml_file.filename or "unknown.opml",
            default_folder_name or "Imported Feeds",
        )
    except HTTPException:
        raise
    except ValidationError as e:
        # Handle validation errors from parsing
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e
    except ValueError as e:
        # Handle other validation errors
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e
    except Exception as e:
        # Handle generic errors that might bubble up from parsing
        if "Invalid XML" in str(e) or "RSS/Atom" in str(e) or "RSS feed" in str(e):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred while processing your OPML file.",
        ) from e
    finally:
        await opml_file.close()


@router.get(
    "/import/status/{task_id}",
    response_model=OpmlImportStatusResponse,
    summary="Get OPML import task status",
    description="Retrieve the current status and progress of an OPML import task.",
)
async def get_import_status(
    task_id: str = Path(
        ...,
        description="Taskiq task ID returned from the import endpoint",
    ),
    current_user: TokenData = Depends(get_current_user),
) -> OpmlImportStatusResponse:
    """
    Get the current status and progress of an OPML import task.
    """
    return await get_task_status(task_id, current_user.sub)
