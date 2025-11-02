"""
CRUD operations for ClippedArticle model
"""

from uuid import UUID

from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.crud.base import CRUDBase
from app.models import ArticleContent, ClippedArticle
from app.schemas import ClippedArticleCreate, ClippedArticleUpdate


class CRUDClippedArticle(CRUDBase[ClippedArticle, ClippedArticleCreate, ClippedArticleUpdate]):
    """CRUD operations for manually saved web articles"""

    async def get_by_user_and_content(
        self, db: AsyncSession, *, user_id: UUID, content_id: UUID
    ) -> ClippedArticle | None:
        """Check if user already has this content clipped"""
        result = await db.execute(
            select(ClippedArticle)
            .options(selectinload(ClippedArticle.content).undefer(ArticleContent.description).undefer(ArticleContent.content))
            .where(
                and_(
                    ClippedArticle.user_id == user_id,
                    ClippedArticle.content_id == content_id,
                )
            )
        )
        return result.scalar_one_or_none()

    async def get_with_content(self, db: AsyncSession, *, article_id: UUID) -> ClippedArticle | None:
        """Get clipped article with content"""
        result = await db.execute(
            select(ClippedArticle).options(selectinload(ClippedArticle.content).undefer(ArticleContent.description).undefer(ArticleContent.content)).where(ClippedArticle.id == article_id)
        )
        return result.scalar_one_or_none()

    async def get_by_user_and_url(self, db: AsyncSession, *, user_id: UUID, url: str) -> ClippedArticle | None:
        """
        Get clipped article by user ID and article URL.

        Joins clipped_articles and article_contents tables on content_id
        to find article by its URL.

        Args:
            db: Database session
            user_id: User ID to filter by
            url: Article URL to search for

        Returns:
            ClippedArticle with content loaded, or None if not found
        """
        result = await db.execute(
            select(ClippedArticle)
            .options(selectinload(ClippedArticle.content).undefer(ArticleContent.description).undefer(ArticleContent.content))
            .join(ArticleContent, ClippedArticle.content_id == ArticleContent.id)
            .where(and_(ClippedArticle.user_id == user_id, ArticleContent.link == url))
        )
        return result.scalar_one_or_none()


# Create instance
crud_clipped_article = CRUDClippedArticle(ClippedArticle)
