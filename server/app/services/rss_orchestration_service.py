"""Main orchestration service for RSS operations."""

from datetime import datetime
from uuid import UUID

import structlog
from celery import group
from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas.rss_schemas import (
    ArticleResponse,
    ArticleUpdate,
    FeedResponse,
    FeedUpdate,
    FolderCreate,
    FolderResponse,
    FolderUpdate,
    PaginatedResponse,
    TagCreate,
    TagResponse,
    TagUpdate,
)
from app.services.article_management_service import ArticleManagementService
from app.services.feed_management_service import FeedManagementService
from app.services.folder_service import FolderService
from app.services.opml_processor import OpmlProcessor
from app.services.tag_service import TagService

logger = structlog.get_logger(__name__)


class RssOrchestrationService:
    """Main service that orchestrates RSS operations using specialized services."""

    def __init__(self, db: AsyncSession, user_id: UUID):
        self.db = db
        self.user_id = user_id

        # Initialize specialized services
        self.feed_service = FeedManagementService(db, user_id)
        self.folder_service = FolderService(db, user_id)
        self.tag_service = TagService(db, user_id)
        self.article_service = ArticleManagementService(db, user_id)
        self.opml_processor = OpmlProcessor()

    # Feed operations
    async def add_new_feed(
        self,
        url: str,
        folder_id: UUID,
        tag_names: list[str] | None = None,
        update_existing: bool = False,
    ) -> FeedResponse:
        """Add a new RSS feed."""
        return await self.feed_service.add_new_feed(
            url=url,
            folder_id=folder_id,
            tag_names=tag_names,
            update_existing=update_existing,
        )

    async def get_feed(self, feed_id: UUID) -> FeedResponse | None:
        """Get a specific feed."""
        return await self.feed_service.get_feed(feed_id)

    async def list_feeds(
        self,
        folder_id: UUID | None = None,
        tag_names: list[str] | None = None,
        is_favorite: bool | None = None,
        search_query: str | None = None,
        skip: int = 0,
        limit: int = 100,
    ) -> list[FeedResponse]:
        """List feeds with filtering."""
        return await self.feed_service.list_feeds(
            folder_id=folder_id,
            tag_names=tag_names,
            is_favorite=is_favorite,
            search_query=search_query,
            skip=skip,
            limit=limit,
        )

    async def update_feed_user_settings(
        self, feed_id: UUID, feed_in: FeedUpdate
    ) -> FeedResponse | None:
        """Update feed settings."""
        return await self.feed_service.update_feed_user_settings(feed_id, feed_in)

    async def delete_feed(self, feed_id: UUID) -> bool:
        """Delete a feed."""
        return await self.feed_service.delete_feed(feed_id)

    async def refresh_feed(
        self, feed_id: UUID, force_refetch: bool = False
    ) -> FeedResponse | None:
        """Refresh a feed."""
        return await self.feed_service.refresh_feed(feed_id, force_refetch)

    # Folder operations
    async def create_folder(self, folder_in: FolderCreate) -> FolderResponse:
        """Create a new folder."""
        return await self.folder_service.create_folder(folder_in=folder_in)

    async def get_folder(self, folder_id: UUID) -> FolderResponse | None:
        """Get a folder."""
        return await self.folder_service.get_folder(folder_id)

    async def list_folders(
        self, skip: int = 0, limit: int = 100
    ) -> list[FolderResponse]:
        """List folders."""
        return await self.folder_service.list_folders(skip=skip, limit=limit)

    async def update_folder(
        self, folder_id: UUID, folder_in: FolderUpdate
    ) -> FolderResponse | None:
        """Update a folder."""
        return await self.folder_service.update_folder(folder_id, folder_in)

    async def delete_folder(self, folder_id: UUID) -> bool:
        """Delete a folder."""
        return await self.folder_service.delete_folder(folder_id)

    # Tag operations
    async def create_tag(self, tag_in: TagCreate) -> TagResponse:
        """Create a new tag."""
        return await self.tag_service.create_tag(tag_in)

    async def get_tag(self, tag_id: UUID) -> TagResponse | None:
        """Get a tag."""
        return await self.tag_service.get_tag(tag_id)

    async def list_tags(self, skip: int = 0, limit: int = 100) -> list[TagResponse]:
        """List tags."""
        return await self.tag_service.list_tags(skip=skip, limit=limit)

    async def update_tag(self, tag_id: UUID, tag_in: TagUpdate) -> TagResponse | None:
        """Update a tag."""
        return await self.tag_service.update_tag(tag_id, tag_in)

    async def delete_tag(self, tag_id: UUID) -> bool:
        """Delete a tag."""
        return await self.tag_service.delete_tag(tag_id)

    # Article operations
    async def get_articles(
        self,
        feed_ids: list[UUID] | None = None,
        folder_id: UUID | None = None,
        is_read: bool | None = None,
        is_read_later: bool | None = None,
        is_favorite: bool | None = None,
        feed_is_favorite: bool | None = None,
        published_since: datetime | None = None,
        published_until: datetime | None = None,
        search_query: str | None = None,
        sort_by: str = "published_at",
        sort_order: str = "desc",
        page: int = 1,
        size: int = 50,
    ) -> PaginatedResponse[ArticleResponse]:
        """Get articles with filtering."""
        return await self.article_service.get_articles(
            feed_ids=feed_ids,
            folder_id=folder_id,
            is_read=is_read,
            is_read_later=is_read_later,
            is_favorite=is_favorite,
            feed_is_favorite=feed_is_favorite,
            published_since=published_since,
            published_until=published_until,
            search_query=search_query,
            sort_by=sort_by,
            sort_order=sort_order,
            page=page,
            size=size,
        )

    async def get_article(self, article_id: UUID) -> ArticleResponse | None:
        """Get a single article by its ID."""
        return await self.article_service.get_article(article_id)

    async def get_unread_articles(
        self,
        folder_id: UUID | None = None,
        feed_id: UUID | None = None,
        tag_names: list[str] | None = None,
        search_query: str | None = None,
        skip: int = 0,
        limit: int = 50,
    ) -> PaginatedResponse[ArticleResponse]:
        """Get unread articles."""
        return await self.article_service.get_unread_articles(
            folder_id=folder_id,
            feed_id=feed_id,
            tag_names=tag_names,
            search_query=search_query,
            skip=skip,
            limit=limit,
        )

    async def get_read_later_articles(
        self, skip: int = 0, limit: int = 50
    ) -> PaginatedResponse[ArticleResponse]:
        """Get read later articles."""
        return await self.article_service.get_read_later_articles(
            skip=skip, limit=limit
        )

    async def get_recently_read_articles(
        self, skip: int = 0, limit: int = 50
    ) -> PaginatedResponse[ArticleResponse]:
        """Get recently read articles."""
        return await self.article_service.get_recently_read_articles(
            skip=skip, limit=limit
        )

    async def update_article(
        self, article_id: UUID, article_in: ArticleUpdate, article_type: str = "feed"
    ) -> ArticleResponse | None:
        """Update an article."""
        return await self.article_service.update_article(article_id, article_in, article_type)

    async def get_unread_counts_by_folder(self) -> dict[str, int]:
        """Get unread counts by folder."""
        return await self.article_service.get_unread_counts_by_folder()

    async def count_unread_articles_by_folder(self, folder_id: UUID) -> int:
        """Count unread articles for a user in a specific folder."""
        return await self.article_service.count_unread_articles_by_folder(
            folder_id=folder_id
        )

    async def get_total_unread_count(self) -> int:
        """Get total unread count."""
        return await self.article_service.get_total_unread_count()

    async def get_unread_counts(
        self, folder_id_filter: UUID | None = None
    ) -> dict[str, any]:
        """Get unread article counts."""
        if folder_id_filter:
            count = await self.article_service.count_unread_articles_by_folder(
                folder_id=folder_id_filter
            )
            return {"unread_count": count}
        else:
            total_count = await self.get_total_unread_count()
            folder_counts = await self.get_unread_counts_by_folder()
            read_later_count = await self.article_service.get_read_later_count()
            today_count = await self.article_service.get_today_count()

            # Transform dict to array format expected by frontend
            unread_by_folder = [
                {"folder_id": str(folder_id), "unread_count": count}
                for folder_id, count in folder_counts.items()
            ]
            return {
                "total_unread": total_count,
                "unread_by_folder": unread_by_folder,
                "read_later_count": read_later_count,
                "today_count": today_count,
            }

    # OPML operations
    async def extract_feeds_from_opml(
        self, opml_content: str, default_folder_name: str = None
    ) -> list[dict]:
        """Extract feeds from OPML content and transform to worker task format."""
        raw_feeds_data = await self.opml_processor.extract_feeds_from_opml(
            opml_content, default_folder_name
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

    async def _bulk_create_folders(self, folder_names: set[str]) -> dict[str, str]:
        """Bulk create folders and return name->id mapping."""
        if not folder_names:
            return {}


        # Get existing folders first
        existing_folders = await self.folder_service.list_folders()
        folder_cache = {folder.name: folder.id for folder in existing_folders}

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
                    user_id=self.user_id
                )
            except Exception as e:
                logger.error(
                    "Failed to batch create folders, proceeding without folder assignment",
                    error=str(e),
                    folder_names=folders_to_create,
                    user_id=self.user_id
                )
                # Continue gracefully without folder assignment
                # folder_cache already contains existing folders, new ones will be None

        return folder_cache

    async def process_opml_import(
        self, opml_content: str, default_folder_name: str = "Imported Feeds"
    ) -> dict:
        """Process OPML import and return feed import results.

        This method encapsulates the business logic for OPML import orchestration,
        making it easier to test without Celery task complexity.

        Returns:
            Dict with total_feeds, task_ids, and import results
        """
        from app.workers.tasks import import_single_feed_task

        # Extract feeds from OPML
        feeds_data = await self.extract_feeds_from_opml(
            opml_content=opml_content, default_folder_name=default_folder_name
        )

        total_feeds = len(feeds_data)

        # Queue feed import tasks using Celery groups for better performance
        task_ids = []
        if feeds_data:
            # Use Celery group for efficient bulk task queuing
            task_group = group(
                import_single_feed_task.s(
                    user_id=str(self.user_id),
                    feed_url=feed_data["url"],
                    folder_id=str(feed_data["folder_id"])
                    if feed_data["folder_id"]
                    else None,
                    tag_names=feed_data["tag_names"],
                    feed_title=feed_data["title"],
                    update_existing=True,  # Enable seamless updating of existing feeds
                )
                for feed_data in feeds_data
            )
            group_result = task_group.apply_async()
            task_ids = [result.task_id for result in group_result.results]

        return {
            "total_feeds": total_feeds,
            "queued_tasks": len(task_ids),
            "task_ids": task_ids,
            "status": "tasks_queued",
        }

    async def import_single_feed(
        self,
        feed_url: str,
        folder_id: str = None,
        tag_names: list[str] = None,
        feed_title: str = None,
        update_existing: bool = False,
    ) -> dict:
        """Import a single feed with proper error handling.

        This method encapsulates the business logic for individual feed import,
        making it easier to test without Celery task complexity.

        Returns:
            Dict with success status, error details, and feed information
        """
        try:
            folder_uuid = UUID(folder_id) if folder_id else None
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
                "title": feed_response.title or feed_title,  # Prefer response title
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
            elif any(
                term in error_str
                for term in ["parse", "xml", "encoding", "not well-formed"]
            ):
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
