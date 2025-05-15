import pathlib
from typing import Annotated
from uuid import UUID

import structlog
from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    HTTPException,
    UploadFile,
    status,
)
from pydantic import BaseModel, Field

from app.repositories.supabase import (
    SupabaseStorageClient,
    get_storage_client,
)
from app.schemas.auth import TokenData
from app.schemas.settings import Settings
from app.services.auth import get_current_user

router = APIRouter()
logger = structlog.get_logger()
settings = Settings()


class UploadResponse(BaseModel):
    """Response model for file upload endpoint."""

    file_path: str = Field(..., description="Path where the file was stored")
    book_id: str = Field(..., description="ID of the book associated with the upload")


class FileUploadError(Exception):
    """Custom exception for file upload errors."""

    def __init__(
        self, message: str, status_code: int = status.HTTP_500_INTERNAL_SERVER_ERROR
    ):
        self.message = message
        self.status_code = status_code
        super().__init__(message)


async def validate_file_upload(
    file: UploadFile,
    book_id: str,
    user: TokenData,
) -> tuple[UUID, str, str]:
    """
    Validate file upload request parameters.

    Returns:
        tuple: (user_id, user_role, file_extension)
    """
    try:
        user_id = UUID(user.sub)
        user_role = user.role
    except (AttributeError, ValueError, TypeError) as e:
        logger.error("Invalid user data", error=str(e))
        raise FileUploadError(
            "Invalid user data provided", status.HTTP_401_UNAUTHORIZED
        )

    if not book_id:
        raise FileUploadError("Book ID is required", status.HTTP_400_BAD_REQUEST)

    try:
        file_extension = pathlib.Path(file.filename).suffix.lower()
        if not file_extension:
            raise FileUploadError(
                "File must have an extension", status.HTTP_400_BAD_REQUEST
            )
    except ValueError as e:
        raise FileUploadError(str(e), status.HTTP_400_BAD_REQUEST)

    return user_id, user_role, file_extension


async def process_file_upload(
    file: UploadFile,
    user_id: UUID,
    book_id: str,
    file_extension: str,
    storage_client: SupabaseStorageClient,
) -> str:
    """
    Process and upload the file to storage.

    Returns:
        str: The final file path where the file was stored
    """
    try:
        logger.debug("Reading file content...")
        file_content = await file.read()
        file_size = len(file_content)
        logger.info("File read complete", size=file_size)
    except Exception as e:
        logger.exception("Failed to read file", error=str(e))
        raise FileUploadError(
            "Failed to read file", status.HTTP_500_INTERNAL_SERVER_ERROR
        )

    try:
        object_name = f"{book_id}{file_extension}"
        storage_path = f"users/{user_id}/{object_name}"
        logger.info("Uploading to storage", path=storage_path)

        await storage_client.upload_file(
            object_name=object_name,
            file_bytes=file_content,
            user_id=str(user_id),
        )
        logger.info("File upload successful", path=storage_path)
        return storage_path

    except Exception as e:
        logger.exception("Storage upload failed", error=str(e))
        raise FileUploadError(
            "Failed to upload file", status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@router.post("/", status_code=status.HTTP_201_CREATED, response_model=UploadResponse)
async def upload_file(
    background_tasks: BackgroundTasks,
    file: UploadFile,
    user: Annotated[TokenData, Depends(get_current_user)],
    book_id: str,
    storage_client: SupabaseStorageClient = Depends(get_storage_client),
):
    """
    Upload a file to storage.

    Args:
        file: The file to upload
        user: Current authenticated user
        book_id: ID of the book to associate with the upload
        storage_client: Storage client for file operations

    Returns:
        UploadResponse: Details about the uploaded file
    """
    try:
        # Validate input
        user_id, user_role, file_extension = await validate_file_upload(
            file, book_id, user
        )
        logger.info(
            "Processing upload request",
            user_id=user_id,
            user_role=user_role,
            filename=file.filename,
        )

        # Process and upload file
        final_file_path = await process_file_upload(
            file, user_id, book_id, file_extension, storage_client
        )

        # Return success response
        return UploadResponse(
            file_path=final_file_path,
            book_id=book_id,
        )

    except FileUploadError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)
    except Exception as e:
        logger.exception("Unexpected error during file upload", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred",
        )
