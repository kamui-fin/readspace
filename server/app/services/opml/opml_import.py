"""Service for OPML import operations."""

import asyncio
from typing import Any
from uuid import UUID

import structlog
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.feeds.feed_management import FeedManagementService
from app.services.folder import FolderService
from app.services.opml.opml_processor import OpmlProcessor

logger = structlog.get_logger(__name__)

# Maximum number of concurrent feed imports to prevent overwhelming the system
MAX_CONCURRENT_FEED_IMPORTS = 100


class OpmlImportService:
    """Service for handling OPML import operations."""

    def __init__(self, db: AsyncSession, user_id: UUID):
        self.db = db
        self.user_id = user_id
        self.feed_service = FeedManagementService(db, user_id)
        self.folder_service = FolderService(db, user_id)
        self.opml_processor = OpmlProcessor()

    async def extract_feeds_from_opml(
        self, opml_content: str, default_folder_name: str | None = None
    ) -> list[dict[str, Any]]:
        """Extract feeds from OPML content and transform to worker task format."""
        raw_feeds_data = await self.opml_processor.extract_feeds_from_opml(
            opml_content, default_folder_name or "Imported Feeds"
        )

        # Step 1: Extract all unique folder names upfront
        unique_folder_names = set()
        for feed_data in raw_feeds_data:
            folder_name = feed_data.get("folder_name")
            if folder_name and folder_name.strip():
                unique_folder_names.add(folder_name.strip())

        # Step 2: Bulk create/get folders in single operation
        folder_cache = await self._bulk_create_folders(unique_folder_names)

        # Step 3: Transform feeds with pre-resolved folder IDs
        transformed_feeds = []
        for feed_data in raw_feeds_data:
            folder_name = feed_data.get("folder_name")
            folder_id = None

            if folder_name and folder_name.strip():
                folder_id = folder_cache.get(folder_name.strip())

            # Transform to expected format
            transformed_feed = {
                "url": feed_data["xml_url"],
                "folder_id": folder_id,
                "tag_names": [],  # OPML doesn't typically contain tag information
                "title": feed_data["title"],
            }
            transformed_feeds.append(transformed_feed)

        return transformed_feeds

    async def _bulk_create_folders(self, folder_names: set[str]) -> dict[str, UUID]:
        """Bulk create folders and return name->id mapping."""
        if not folder_names:
            return {}

        # Get existing folders first
        existing_folders = await self.folder_service.list_folders()
        folder_cache: dict[str, UUID] = {folder.name: folder.id for folder in existing_folders}

        # Identify folders that need to be created
        folders_to_create = [name for name in folder_names if name not in folder_cache]

        # Bulk create new folders using atomic batch operation to prevent race conditions
        if folders_to_create:
            try:
                created_folders = await self.folder_service.create_folders_batch(folders_to_create)
                folder_cache.update(created_folders)

                logger.info(
                    "Batch folder creation completed",
                    created_count=len(created_folders),
                    requested_count=len(folders_to_create),
                    user_id=self.user_id,
                )
            except Exception as e:
                logger.error(
                    "Failed to batch create folders, proceeding without folder assignment",
                    error=str(e),
                    folder_names=folders_to_create,
                    user_id=self.user_id,
                )
                # Continue gracefully without folder assignment
                # folder_cache already contains existing folders, new ones will be None

        return folder_cache

    async def process_opml_import(
        self, opml_content: str, default_folder_name: str = "Imported Feeds", test_mode: bool = False
    ) -> dict[str, Any]:
        """Process OPML import and return feed import results.

        This method now processes all feeds directly using asyncio.gather() with concurrency
        limiting, leveraging gevent's greenlets for efficient I/O handling.

        Args:
            opml_content: OPML file content
            default_folder_name: Default folder for feeds without a folder
            test_mode: Legacy parameter, no longer used (kept for compatibility)

        Returns:
            Dict with total_feeds, imported_count, results, and import status
        """
        # Extract feeds from OPML
        feeds_data = await self.extract_feeds_from_opml(
            opml_content=opml_content, default_folder_name=default_folder_name
        )

        total_feeds = len(feeds_data)

        if not feeds_data:
            return {
                "total_feeds": 0,
                "imported_count": 0,
                "results": [],
                "status": "completed",
            }

        logger.info(
            "Starting OPML feed imports with concurrency limit",
            total_feeds=total_feeds,
            max_concurrent=MAX_CONCURRENT_FEED_IMPORTS,
            user_id=self.user_id,
        )

        # Process feeds with concurrency limiting using semaphore
        semaphore = asyncio.Semaphore(MAX_CONCURRENT_FEED_IMPORTS)

        async def import_with_semaphore(feed_data: dict[str, Any]) -> dict[str, Any]:
            """Import a single feed with semaphore limiting."""
            async with semaphore:
                return await self.import_single_feed(
                    feed_url=feed_data["url"],
                    folder_id=str(feed_data["folder_id"]) if feed_data["folder_id"] else None,
                    tag_names=feed_data["tag_names"],
                    feed_title=feed_data["title"],
                    update_existing=True,
                )

        # Process all feeds concurrently with gather
        import_results = await asyncio.gather(
            *[import_with_semaphore(feed_data) for feed_data in feeds_data],
            return_exceptions=True,  # Don't fail entire import if one feed fails
        )

        # Convert exceptions to error results
        processed_results = []
        for i, result in enumerate(import_results):
            if isinstance(result, Exception):
                feed_data = feeds_data[i]
                processed_results.append(
                    {
                        "success": False,
                        "url": feed_data["url"],
                        "title": feed_data["title"] or "Unknown",
                        "status": "unknown_error",
                        "error": str(result),
                    }
                )
            else:
                processed_results.append(result)

        imported_count = sum(1 for r in processed_results if r.get("success"))

        logger.info(
            "OPML feed imports completed",
            total_feeds=total_feeds,
            imported_count=imported_count,
            failed_count=total_feeds - imported_count,
            user_id=self.user_id,
        )

        return {
            "total_feeds": total_feeds,
            "imported_count": imported_count,
            "results": processed_results,
            "status": "completed",
        }

    async def import_single_feed(
        self,
        feed_url: str,
        folder_id: str | None = None,
        tag_names: list[str] | None = None,
        feed_title: str | None = None,
        update_existing: bool = False,
    ) -> dict[str, Any]:
        """Import a single feed with proper error handling.

        This method encapsulates the business logic for individual feed import,
        making it easier to test without Celery task complexity.

        Returns:
            Dict with success status, error details, and feed information
        """
        try:
            if folder_id:
                folder_uuid = UUID(folder_id)
            else:
                # Get or create default folder if none provided
                default_folder = await self.folder_service.get_default_folder()
                if not default_folder:
                    raise ValueError("Could not find or create default folder")
                folder_uuid = default_folder.id

            feed_response = await self.feed_service.add_new_feed(
                url=feed_url,
                folder_id=folder_uuid,
                tag_names=tag_names or [],
                update_existing=update_existing,
            )

            # Determine import status
            if update_existing:
                status = "imported_or_updated"
            else:
                status = "imported"

            return {
                "success": True,
                "url": feed_url,
                "title": feed_response.custom_title or feed_response.feed.title or feed_title,
                "status": status,
                "feed_id": str(feed_response.id),
            }

        except ValueError as e:
            # Feed already exists or other validation error
            error_msg = str(e).lower()
            if "already exists" in error_msg:
                return {
                    "success": True,
                    "url": feed_url,
                    "title": feed_title or "Unknown",
                    "status": "already_exists",
                }
            elif any(
                phrase in error_msg
                for phrase in [
                    "no valid articles",
                    "appears to be broken",
                    "no articles found",
                ]
            ):
                return {
                    "success": False,
                    "url": feed_url,
                    "title": feed_title or "Unknown",
                    "status": "broken_feed",
                    "error": "Feed has no valid articles",
                }
            else:
                return {
                    "success": False,
                    "url": feed_url,
                    "title": feed_title or "Unknown",
                    "status": "validation_error",
                    "error": str(e),
                }

        except Exception as e:
            error_str = str(e).lower()

            # Categorize errors
            if any(code in error_str for code in ["404", "410"]):
                status = "broken_feed"
            elif any(code in error_str for code in ["403", "401", "429"]):
                status = "broken_feed"
            elif any(term in error_str for term in ["timeout", "timed out"]):
                status = "timeout"
            elif any(
                term in error_str
                for term in [
                    "connection",
                    "network",
                    "dns",
                    "name resolution",
                    "no address",
                ]
            ):
                status = "network_error"
            elif any(term in error_str for term in ["parse", "xml", "encoding", "not well-formed"]):
                status = "broken_feed"
            elif "greenlet" in error_str:
                status = "unknown_error"
            else:
                status = "unknown_error"

            return {
                "success": False,
                "url": feed_url,
                "title": feed_title or "Unknown",
                "status": status,
                "error": str(e),
            }
