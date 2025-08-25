"""Service for tag operations."""

from uuid import UUID

import structlog
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud import crud_tag
from app.models.rss_models import Tag
from app.schemas.rss_schemas import TagCreate, TagResponse, TagUpdate

logger = structlog.get_logger(__name__)


class TagService:
    """Service for managing RSS tags."""

    def __init__(self, db: AsyncSession, user_id: UUID):
        self.db = db
        self.user_id = user_id

    async def create_tag(self, tag_in: TagCreate) -> TagResponse:
        """Create a new tag for the user."""
        logger.info("Creating new tag", user_id=self.user_id, name=tag_in.name)

        # Check if tag already exists for user (case-insensitive)
        existing_tag = await crud_tag.get_tag_by_name(
            db=self.db, name=tag_in.name, user_id=self.user_id
        )
        if existing_tag:
            logger.info(
                "Tag already exists, returning existing", tag_id=existing_tag.id
            )
            return TagResponse.model_validate(existing_tag)

        tag_db = await crud_tag.create_tag(db=self.db, tag=tag_in, user_id=self.user_id)
        return TagResponse.model_validate(tag_db)

    async def get_tag(self, tag_id: UUID) -> TagResponse | None:
        """Get tag by ID for the current user."""
        tag_db = await crud_tag.get_tag(db=self.db, tag_id=tag_id, user_id=self.user_id)
        return TagResponse.model_validate(tag_db) if tag_db else None

    async def list_tags(self, skip: int = 0, limit: int = 100) -> list[TagResponse]:
        """List all tags for the current user."""
        tags_db = await crud_tag.get_tags_by_user(
            db=self.db, user_id=self.user_id, skip=skip, limit=limit
        )
        return [TagResponse.model_validate(tag) for tag in tags_db]

    async def update_tag(self, tag_id: UUID, tag_in: TagUpdate) -> TagResponse | None:
        """Update tag name or other editable attributes."""
        logger.info("Updating tag", tag_id=tag_id, user_id=self.user_id)

        # Check for name conflicts if name is being changed
        if tag_in.name:
            existing_tag = await crud_tag.get_tag_by_name(
                db=self.db, name=tag_in.name, user_id=self.user_id
            )
            if existing_tag and existing_tag.id != tag_id:
                raise ValueError(f"Tag with name '{tag_in.name}' already exists")

        updated_tag = await crud_tag.update_tag(
            db=self.db, tag_id=tag_id, tag_in=tag_in, user_id=self.user_id
        )
        if updated_tag:
            return TagResponse.model_validate(updated_tag)
        return None

    async def delete_tag(self, tag_id: UUID) -> bool:
        """Delete a tag. Associated feed-tag relationships will also be deleted."""
        logger.info("Deleting tag", tag_id=tag_id, user_id=self.user_id)
        result = await crud_tag.delete_tag(
            db=self.db, tag_id=tag_id, user_id=self.user_id
        )
        if result:
            logger.info("Tag deleted successfully", tag_id=tag_id)
        else:
            logger.warning("Tag not found or couldn't be deleted", tag_id=tag_id)
        return result

    async def get_or_create_tags_by_names(self, tag_names: list[str]) -> list[Tag]:
        """Get existing tags or create new ones for the given names."""
        tags = []
        for name in tag_names:
            existing_tag = await crud_tag.get_tag_by_name(
                db=self.db, name=name, user_id=self.user_id
            )
            if existing_tag:
                tags.append(existing_tag)
            else:
                # Create new tag
                tag_create = TagCreate(name=name)
                new_tag = await crud_tag.create_tag(
                    db=self.db, tag=tag_create, user_id=self.user_id
                )
                tags.append(new_tag)
        return tags
