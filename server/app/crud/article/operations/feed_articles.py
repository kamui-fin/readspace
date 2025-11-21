"""CRUD operations for FeedArticle model."""

from uuid import UUID

from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.crud.article.operations.base import CRUDBase
from app.models import FeedArticle
from app.schemas import FeedArticleCreate, FeedArticleUpdate


class CRUDFeedArticle(CRUDBase[FeedArticle, FeedArticleCreate, FeedArticleUpdate]):
    """CRUD operations for RSS feed articles."""

    async def get_by_feed_and_guid(self, db: AsyncSession, *, feed_id: UUID, guid: str) -> FeedArticle | None:
        """Get feed article by feed ID and GUID."""
        result = await db.execute(
            select(FeedArticle)
            .options(selectinload(FeedArticle.content))
            .where(and_(FeedArticle.feed_id == feed_id, FeedArticle.guid == guid))
        )
        return result.scalar_one_or_none()

    async def get_with_content(self, db: AsyncSession, *, article_id: UUID) -> FeedArticle | None:
        """Get feed article with content and feed."""
        result = await db.execute(
            select(FeedArticle)
            .options(selectinload(FeedArticle.content), selectinload(FeedArticle.feed))
            .where(FeedArticle.id == article_id)
        )
        return result.scalar_one_or_none()


# Create instance
feed_articles = CRUDFeedArticle(FeedArticle)
