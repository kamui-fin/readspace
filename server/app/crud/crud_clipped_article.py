"""
CRUD operations for ClippedArticle model
"""

from uuid import UUID

from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.crud.base import CRUDBase
from app.models.rss_models import ClippedArticle
from app.schemas.rss_schemas import ClippedArticleCreate, ClippedArticleUpdate


class CRUDClippedArticle(CRUDBase[ClippedArticle, ClippedArticleCreate, ClippedArticleUpdate]):
    """CRUD operations for manually saved web articles"""

    async def get_by_user_and_content(
        self, db: AsyncSession, *, user_id: UUID, content_id: UUID
    ) -> ClippedArticle | None:
        """Check if user already has this content clipped"""
        result = await db.execute(
            select(ClippedArticle)
            .options(selectinload(ClippedArticle.content))
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
            select(ClippedArticle).options(selectinload(ClippedArticle.content)).where(ClippedArticle.id == article_id)
        )
        return result.scalar_one_or_none()


# Create instance
crud_clipped_article = CRUDClippedArticle(ClippedArticle)
