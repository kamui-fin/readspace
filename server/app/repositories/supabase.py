import uuid
from typing import Optional

import structlog
from supabase import Client, create_client

from app.schemas.settings import Settings

logger = structlog.get_logger()
settings = Settings()


class StorageError(Exception):
    """Base exception for storage operations."""

    def __init__(self, message: str, status_code: int = 500):
        self.message = message
        self.status_code = status_code
        super().__init__(message)


def generate_id() -> str:
    """Generate a unique ID for storage objects."""
    return str(uuid.uuid4())


def get_supabase_client() -> Client:
    """Get a Supabase client instance."""
    try:
        url = settings.supabase_url
        key = settings.supabase_key.get_secret_value()
        client = create_client(url, key)
        return client
    except Exception as e:
        logger.error("Failed to create Supabase client", error=str(e))
        raise StorageError("Failed to initialize storage client")


def get_storage_client() -> "SupabaseStorageClient":
    """Get a client for working with Supabase storage."""
    return SupabaseStorageClient()


class SupabaseStorageClient:
    """Client for interacting with Supabase Storage."""

    def __init__(self):
        self.client = get_supabase_client()
        self.bucket_name = "documents"

    async def upload_file(
        self,
        object_name: str,
        file_bytes: bytes,
        user_id: Optional[str] = None,
    ) -> str:
        """
        Upload a file to Supabase storage.

        Args:
            object_name: The name to give the object in storage (typically book_id + extension)
            file_bytes: The file content as bytes
            user_id: Optional user ID to organize files by user

        Returns:
            str: The path of the uploaded file

        Raises:
            StorageError: If the upload fails
        """
        try:
            path = object_name
            if user_id:
                path = f"{user_id}/{object_name}"

            logger.info("Uploading file to storage", path=path)

            result = self.client.storage.from_(self.bucket_name).upload(
                path=path,
                file=file_bytes,
            )

            logger.info("File upload successful", path=path)
            return result

        except Exception as e:
            logger.error("Storage upload failed", error=str(e), path=path)
            raise StorageError(f"Failed to upload file: {str(e)}")

    async def download_file(self, object_name: str) -> bytes:
        """
        Download a file from Supabase storage.

        Args:
            object_name: The name of the object in storage (typically book_id + extension)

        Returns:
            bytes: The file content

        Raises:
            StorageError: If the download fails
        """
        try:
            logger.info("Downloading file from storage", path=object_name)

            result = self.client.storage.from_(self.bucket_name).download(object_name)

            logger.info("File download successful", path=object_name)
            return result

        except Exception as e:
            logger.error("Storage download failed", error=str(e), path=object_name)
            raise StorageError(f"Failed to download file: {str(e)}")

    async def delete_file(self, object_name: str) -> bool:
        """
        Delete a file from Supabase storage.

        Args:
            object_name: The name of the object in storage (typically book_id + extension)

        Returns:
            bool: True if deletion was successful

        Raises:
            StorageError: If the deletion fails
        """
        try:
            logger.info("Deleting file from storage", path=object_name)

            self.client.storage.from_(self.bucket_name).remove([object_name])

            logger.info("File deletion successful", path=object_name)
            return True

        except Exception as e:
            logger.error("Storage deletion failed", error=str(e), path=object_name)
            raise StorageError(f"Failed to delete file: {str(e)}")


def get_book_metadata(book_id: str) -> Optional[dict]:
    """
    Get metadata for a book from the database.

    Args:
        book_id: The ID of the book to look up

    Returns:
        Optional[dict]: The book metadata if found, None otherwise
    """
    try:
        supabase = get_supabase_client()
        book_data_response = (
            supabase.table("books")
            .select("*")
            .eq("id", book_id)
            .maybe_single()
            .execute()
        )
        return book_data_response.data if book_data_response.data else None

    except Exception as e:
        logger.error("Failed to get book metadata", error=str(e), book_id=book_id)
        raise StorageError(f"Failed to get book metadata: {str(e)}")
