"""CRUD operations for ArticleContent model."""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud.article.operations.base import CRUDBase
from app.models import ArticleContent
from app.schemas import ArticleContentCreate
from app.utils.content_hash import get_content_hash


class CRUDArticleContent(CRUDBase[ArticleContent, ArticleContentCreate, ArticleContentCreate]):
    """CRUD operations for ArticleContent."""

    async def create(self, db: AsyncSession, *, obj_in: ArticleContentCreate) -> ArticleContent:
        """
        Create a new ArticleContent record.

        Note: Does not commit. Caller is responsible for transaction management.
        This allows batching multiple operations in a single transaction.
        """
        obj_in_data = obj_in.model_dump()
        # Manually convert HttpUrl to string for link and image_url
        if obj_in_data.get("link"):
            obj_in_data["link"] = str(obj_in_data["link"])
        if obj_in_data.get("image_url"):
            obj_in_data["image_url"] = str(obj_in_data["image_url"])

        # Generate content hash
        obj_in_data["content_hash"] = get_content_hash(obj_in_data["link"])

        db_obj = self.model(**obj_in_data)
        db.add(db_obj)
        await db.flush()  # Flush to get ID but don't commit
        await db.refresh(db_obj)
        return db_obj

    async def get_by_link(self, db: AsyncSession, *, link: str) -> ArticleContent | None:
        """Get an article content by its original URL (using hash for performance)."""
        content_hash = get_content_hash(link)
        result = await db.execute(select(self.model).filter(self.model.content_hash == content_hash))
        return result.scalars().first()

    async def get_by_link_extracted_by_extension(self, db: AsyncSession, *, link: str) -> ArticleContent | None:
        """Get article content by URL that was extracted by chrome extension."""
        from sqlalchemy.orm import undefer

        # Load all columns including deferred ones to avoid lazy loading in Python loop
        result = await db.execute(
            select(self.model)
            .options(undefer(self.model.description), undefer(self.model.content))
            .filter(self.model.link == link)
        )
        all_content_with_url = result.scalars().all()

        # Filter in Python to find the one extracted by chrome extension
        for content in all_content_with_url:
            if (
                content.custom_metadata
                and isinstance(content.custom_metadata, dict)
                and content.custom_metadata.get("extracted_by") == "chrome_extension"
            ):
                return content

        return None


# Create instance
article_content = CRUDArticleContent(ArticleContent)
