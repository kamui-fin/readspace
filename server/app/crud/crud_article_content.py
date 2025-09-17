"""
CRUD operations for ArticleContent model
"""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud.base import CRUDBase
from app.models.rss_models import ArticleContent
from app.schemas.rss_schemas import ArticleContentCreate


class CRUDArticleContent(CRUDBase[ArticleContent, ArticleContentCreate, ArticleContentCreate]):
    """CRUD operations for ArticleContent."""

    async def create(self, db: AsyncSession, *, obj_in: ArticleContentCreate) -> ArticleContent:
        obj_in_data = obj_in.model_dump()
        # Manually convert HttpUrl to string for link and image_url
        if obj_in_data.get("link"):
            obj_in_data["link"] = str(obj_in_data["link"])
        if obj_in_data.get("image_url"):
            obj_in_data["image_url"] = str(obj_in_data["image_url"])

        db_obj = self.model(**obj_in_data)
        db.add(db_obj)
        await db.commit()
        await db.refresh(db_obj)
        return db_obj

    async def get_by_link(self, db: AsyncSession, *, link: str) -> ArticleContent | None:
        """Get an article content by its original URL."""
        result = await db.execute(select(self.model).filter(self.model.link == link))
        return result.scalars().first()

    async def get_by_link_extracted_by_extension(self, db: AsyncSession, *, link: str) -> ArticleContent | None:
        """Get article content by URL that was extracted by chrome extension."""
        # First get all content records with this URL
        result = await db.execute(select(self.model).filter(self.model.link == link))
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
crud_article_content = CRUDArticleContent(ArticleContent)
