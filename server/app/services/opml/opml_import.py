"""Service for OPML import operations."""

from typing import Any
from uuid import UUID

import structlog
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud.profile import get_profile_by_id
from app.services.feeds.management import FeedManagementService
from app.services.folder import FolderService
from app.services.opml.opml_processor import OpmlProcessor
from app.workers.opml_tasks import import_single_feed_task
from app.services.user.resource_limits import ResourceLimitService
from app.routers.opml.utils import check_import_cancellation_flag

logger = structlog.get_logger(__name__)


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

    async def _dispatch_feed_tasks(
        self, feeds_data: list[dict[str, Any]], parent_task_id: str | None
    ) -> dict[str, Any]:
        """Dispatch individual Taskiq tasks for each feed.

        Args:
            feeds_data: List of feed data dictionaries
            parent_task_id: Parent orchestration task ID for cancellation checking

        Returns:
            Dict with total_feeds, task_ids, and status
        """

        total_feeds = len(feeds_data)
        task_ids = []

        logger.info(
            "Dispatching individual feed import tasks",
            total_feeds=total_feeds,
            user_id=self.user_id,
            parent_task_id=parent_task_id,
        )

        # Check for cancellation before dispatching
        if parent_task_id:

            is_cancelled = await check_import_cancellation_flag(parent_task_id)
            if is_cancelled:
                logger.info(
                    "OPML import cancelled before dispatching tasks",
                    parent_task_id=parent_task_id,
                    user_id=self.user_id,
                )
                return {
                    "total_feeds": total_feeds,
                    "task_ids": [],
                    "status": "cancelled",
                    "message": "Import was cancelled before tasks were dispatched",
                }

        # Dispatch a Taskiq task for each feed
        for feed_data in feeds_data:
            try:
                task = await import_single_feed_task.kiq(
                    user_id=str(self.user_id),
                    feed_url=feed_data["url"],
                    folder_id=str(feed_data["folder_id"]) if feed_data["folder_id"] else None,
                    tag_names=feed_data["tag_names"],
                    feed_title=feed_data["title"],
                    update_existing=True,
                    parent_task_id=parent_task_id,  # Pass parent for cancellation checks
                )
                task_ids.append(task.task_id)

                logger.debug(
                    "Dispatched feed import task",
                    feed_url=feed_data["url"],
                    task_id=task.task_id,
                    parent_task_id=parent_task_id,
                )
            except Exception as e:
                logger.error(
                    "Failed to dispatch feed import task",
                    feed_url=feed_data["url"],
                    error=str(e),
                    exc_info=True,
                )
                # Continue dispatching other tasks even if one fails

        logger.info(
            "Feed import tasks dispatched",
            total_dispatched=len(task_ids),
            total_feeds=total_feeds,
            user_id=self.user_id,
            parent_task_id=parent_task_id,
        )

        return {
            "total_feeds": total_feeds,
            "task_ids": task_ids,
            "status": "dispatched",
            "message": f"Dispatched {len(task_ids)} feed import tasks to queue",
        }

    async def process_opml_import(
        self,
        opml_content: str,
        default_folder_name: str = "Imported Feeds",
        task_id: str | None = None,
    ) -> dict[str, Any]:
        """Process OPML import by dispatching individual Taskiq tasks for each feed.

        Args:
            opml_content: OPML file content
            default_folder_name: Default folder for feeds without a folder
            task_id: Optional task ID for cancellation checking

        Returns:
            Dict with total_feeds, task_ids, and status
        """
        # Extract feeds from OPML
        feeds_data = await self.extract_feeds_from_opml(
            opml_content=opml_content, default_folder_name=default_folder_name
        )

        if not feeds_data:
            return {
                "total_feeds": 0,
                "task_ids": [],
                "status": "completed",
            }

        # Dispatch individual Taskiq tasks for each feed
        return await self._dispatch_feed_tasks(feeds_data, task_id)

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
            # Check subscription limit before attempting to add feed
            profile = await get_profile_by_id(self.db, user_id=self.user_id)
            if profile:
                resource_service = ResourceLimitService(self.db)
                can_proceed = await resource_service.check_limit(
                    self.user_id, "max_subscriptions", str(profile.role), lock=False
                )

                if not can_proceed:
                    limits = resource_service.get_user_limits(str(profile.role))
                    current_usage = await resource_service.get_current_usage(
                        self.user_id, "max_subscriptions", lock=False
                    )

                    logger.warning(
                        "Subscription limit reached during OPML import, skipping feed",
                        feed_url=feed_url,
                        user_id=str(self.user_id),
                        current_usage=current_usage,
                        limit=limits.get("max_subscriptions", 0),
                    )

                    return {
                        "success": False,
                        "url": feed_url,
                        "title": feed_title or "Unknown",
                        "status": "limit_exceeded",
                        "error": f"Subscription limit reached ({current_usage}/{limits.get('max_subscriptions', 0)})",
                    }

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
