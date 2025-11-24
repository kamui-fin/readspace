"""Service for OPML import operations."""

from typing import TYPE_CHECKING, Any, Callable
from uuid import UUID

import structlog

from app.crud.profile import get_profile_by_id
from app.services.folder import FolderService
from app.services.opml.opml_processor import OpmlProcessor
from app.services.user.resource_limits import ResourceLimitService
from app.workers.opml.progress import check_import_cancellation_flag, update_import_progress

if TYPE_CHECKING:
    from app.workers.opml_tasks import import_single_feed_task

logger = structlog.get_logger(__name__)

# Type alias for session factory
SessionFactory = Callable[[], Any]  # Returns async context manager


class OpmlImportService:
    """Service for handling OPML import operations.

    Uses session factory pattern for consistent database access.
    """

    def __init__(self, user_id: UUID):
        self.user_id = user_id
        self.opml_processor = OpmlProcessor()

    async def extract_feeds_from_opml(
        self,
        session_factory: SessionFactory,
        opml_content: str,
        default_folder_name: str | None = None,
    ) -> list[dict[str, Any]]:
        """Extract feeds from OPML content and transform to worker task format.

        This method:
        1. Parses OPML (CPU-bound, no DB)
        2. Creates folders in a single transaction
        3. Returns feed data with folder IDs
        """
        # Step 1: Parse OPML (no DB connection needed)
        raw_feeds_data = await self.opml_processor.extract_feeds_from_opml(
            opml_content, default_folder_name or "Imported Feeds"
        )

        # Step 2: Extract all unique folder names upfront
        unique_folder_names = set()
        for feed_data in raw_feeds_data:
            folder_name = feed_data.get("folder_name")
            if folder_name and folder_name.strip():
                unique_folder_names.add(folder_name.strip())

        # Step 3: Bulk create/get folders in single transaction
        async with session_factory() as db:
            folder_cache = await self._bulk_create_folders_db(db, unique_folder_names)

        # Step 4: Transform feeds with pre-resolved folder IDs (no DB)
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

    async def _check_subscription_limit_db(self, db, feed_url: str, feed_title: str | None) -> dict[str, Any] | None:
        """Check subscription limit. Returns error dict if limit exceeded, None otherwise.

        Pure DB function - caller manages session.
        """
        profile = await get_profile_by_id(db, user_id=self.user_id)
        if not profile:
            return None

        resource_service = ResourceLimitService(db)
        can_proceed = await resource_service.check_limit(
            self.user_id, "max_subscriptions", str(profile.role), lock=False
        )

        if not can_proceed:
            limits = resource_service.get_user_limits(str(profile.role))
            current_usage = await resource_service.get_current_usage(self.user_id, "max_subscriptions", lock=False)

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

        return None

    async def _get_default_folder_db(self, db) -> UUID:
        """Get default folder ID. Raises ValueError if not found.

        Pure DB function - caller manages session.
        """
        folder_service = FolderService(db, self.user_id)
        default_folder = await folder_service.get_default_folder()
        if not default_folder:
            raise ValueError("Could not find or create default folder")
        return default_folder.id

    async def _bulk_create_folders_db(self, db, folder_names: set[str]) -> dict[str, UUID]:
        """Bulk create folders and return name->id mapping.

        Pure DB function - caller manages session.
        """
        if not folder_names:
            return {}

        folder_service = FolderService(db, self.user_id)

        # Get existing folders
        existing_folders = await folder_service.list_folders()
        folder_cache: dict[str, UUID] = {folder.name: folder.id for folder in existing_folders}

        # Identify folders that need to be created
        folders_to_create = [name for name in folder_names if name not in folder_cache]

        # Bulk create new folders using atomic batch operation
        if folders_to_create:
            try:
                created_folders = await folder_service.create_folders_batch(folders_to_create)
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

        return folder_cache

    async def _dispatch_feed_tasks(
        self, feeds_data: list[dict[str, Any]], parent_task_id: str | None
    ) -> dict[str, Any]:
        """Dispatch individual Taskiq tasks for each feed."""
        from app.workers.opml_tasks import import_single_feed_task

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

        # Dispatch all tasks to RabbitMQ queue
        for feed_data in feeds_data:
            try:
                task = await import_single_feed_task.kiq(
                    user_id=str(self.user_id),
                    feed_url=feed_data["url"],
                    folder_id=(str(feed_data["folder_id"]) if feed_data["folder_id"] else None),
                    tag_names=feed_data["tag_names"],
                    feed_title=feed_data["title"],
                    update_existing=True,
                    parent_task_id=parent_task_id,
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
                # Update progress to count this as a failed import
                if parent_task_id:
                    from app.schemas import FeedImportError

                    await update_import_progress(
                        task_id=parent_task_id,
                        error=FeedImportError(
                            url=feed_data["url"],
                            title=feed_data.get("title", "Unknown"),
                            error=f"Failed to dispatch task: {str(e)}",
                            status="dispatch_failed",
                        ),
                    )

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
        session_factory: SessionFactory,
        opml_content: str,
        default_folder_name: str = "Imported Feeds",
        task_id: str | None = None,
    ) -> dict[str, Any]:
        """Process OPML import by dispatching individual Taskiq tasks for each feed."""
        # Extract feeds from OPML
        feeds_data = await self.extract_feeds_from_opml(
            session_factory,
            opml_content=opml_content,
            default_folder_name=default_folder_name,
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
        session_factory: SessionFactory,
        feed_url: str,
        folder_id: str | None = None,
        tag_names: list[str] | None = None,
        feed_title: str | None = None,
        update_existing: bool = False,
    ) -> dict[str, Any]:
        """Import a single feed with proper error handling.

        Uses multiple surgical database sessions via session factory.
        """
        from app.services.feeds.creation import FeedCreationService

        try:
            # Phase 1: Check limit + get folder
            async with session_factory() as db:
                limit_check = await self._check_subscription_limit_db(db, feed_url, feed_title)
                if limit_check:
                    return limit_check

                # Get folder in same session
                if folder_id:
                    folder_uuid = UUID(folder_id)
                else:
                    folder_uuid = await self._get_default_folder_db(db)

            # Phase 2 & 3: Call FeedCreationService with session factory
            feed_creation_service = FeedCreationService(user_id=self.user_id)
            feed_response = await feed_creation_service.add_new_feed(
                session_factory,
                url=feed_url,
                folder_id=folder_uuid,
                tag_names=tag_names or [],
                update_existing=update_existing,
            )

            # Determine import status
            if feed_response.already_existed:
                status = "already_exists"
            elif update_existing:
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
            if "already exists" in error_msg or "already subscribed" in error_msg:
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
            logger.error(
                "Feed import failed with exception",
                feed_url=feed_url,
                error=str(e),
                error_type=type(e).__name__,
                exc_info=True,
            )

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
