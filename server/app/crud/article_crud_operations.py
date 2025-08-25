"""Core article CRUD operations."""

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import and_, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.crud.article_query_builder import ArticleQueryBuilder
from app.models.rss_models import Article, ArticleContent
from app.schemas.rss_schemas import ArticleCreate, ArticleUpdate


class ArticleCrudOperations:
    """Core CRUD operations for articles."""

    @staticmethod
    async def get_article_by_id(
        db: AsyncSession, *, article_id: UUID, user_id: UUID
    ) -> Article | None:
        """Get a specific article by its ID, ensuring it belongs to the user."""
        result = await db.execute(
            select(Article)
            .options(selectinload(Article.feed), selectinload(Article.content))
            .filter(Article.id == article_id, Article.user_id == user_id)
        )
        return result.scalars().first()

    @staticmethod
    async def get_article_by_guid(
        db: AsyncSession, *, feed_id: UUID, guid: str
    ) -> Article | None:
        """Get a specific article by its GUID for a given feed_id to check for existence."""
        result = await db.execute(
            select(Article).filter(Article.feed_id == feed_id, Article.guid == guid)
        )
        return result.scalars().first()

    @staticmethod
    async def get_articles_filtered(
        db: AsyncSession,
        *,
        user_id: UUID,
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
        skip: int = 0,
        limit: int = 100,
    ) -> tuple[list[Article], int]:
        """Get articles for a user with comprehensive filtering and sorting."""
        query_builder = ArticleQueryBuilder(user_id)

        stmt, count_stmt = query_builder.build_filtered_query(
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
            skip=skip,
            limit=limit,
        )

        total_count_result = await db.execute(count_stmt)
        total_count = total_count_result.scalar_one_or_none() or 0

        articles_result = await db.execute(stmt)
        articles = articles_result.scalars().all()
        return articles, total_count

    @staticmethod
    async def create_articles_batch(
        db: AsyncSession, *, articles_data: list[ArticleCreate], user_id: UUID
    ) -> list[Article]:
        """Create multiple articles in batch for better performance."""
        if not articles_data:
            return []

        # Step 1: Bulk duplicate check - collect all (feed_id, guid) pairs
        feed_guid_pairs = [(article.feed_id, article.guid) for article in articles_data]

        # Single query to check for existing articles
        existing_result = await db.execute(
            select(Article.feed_id, Article.guid).filter(
                and_(
                    Article.feed_id.in_([pair[0] for pair in feed_guid_pairs]),
                    Article.guid.in_([pair[1] for pair in feed_guid_pairs]),
                )
            )
        )
        existing_pairs = {(row[0], row[1]) for row in existing_result.fetchall()}

        # Step 2: Filter out duplicates
        new_articles = [
            article
            for article in articles_data
            if (article.feed_id, article.guid) not in existing_pairs
        ]

        if not new_articles:
            return []

        # Step 3: Bulk create article contents
        content_mappings = []
        current_time = datetime.now(timezone.utc)

        for article_in in new_articles:
            content_mappings.append(
                {
                    "title": article_in.title,
                    "link": str(article_in.link),
                    "description": article_in.content,
                    "content": article_in.content,
                    "author": article_in.author,
                    "published_at": article_in.published_at,
                    "estimated_read_time_minutes": getattr(
                        article_in, "estimated_read_time_minutes", None
                    ),
                    "created_at": current_time,
                    "updated_at": current_time,
                }
            )

        # Bulk insert content
        await db.execute(ArticleContent.__table__.insert(), content_mappings)
        await db.flush()

        # Step 4: Get the inserted content IDs (we need to query them back)
        content_result = await db.execute(
            select(ArticleContent.id, ArticleContent.title, ArticleContent.link)
            .filter(ArticleContent.created_at == current_time)
            .order_by(ArticleContent.id)
        )
        content_rows = content_result.fetchall()

        # Step 5: Bulk create articles
        article_mappings = []
        created_articles = []

        for i, (article_in, content_row) in enumerate(
            zip(new_articles, content_rows, strict=False)
        ):
            article_data = {
                "feed_id": article_in.feed_id,
                "user_id": user_id,
                "content_id": content_row.id,
                "guid": article_in.guid,
                "is_read": False,
                "is_read_later": False,
                "is_favorite": False,
                "created_at": current_time,
            }
            article_mappings.append(article_data)

        # Bulk insert articles
        result = await db.execute(Article.__table__.insert(), article_mappings)

        await db.commit()

        # Return the created articles by querying them back
        article_ids = []
        if hasattr(result, "inserted_primary_key_rows"):
            article_ids = [row[0] for row in result.inserted_primary_key_rows]
        else:
            # Fallback: query by creation time and user_id
            result_articles = await db.execute(
                select(Article.id)
                .filter(Article.user_id == user_id, Article.created_at == current_time)
                .order_by(Article.id)
            )
            article_ids = [row[0] for row in result_articles.fetchall()]

        # Get the full article objects
        if article_ids:
            final_result = await db.execute(
                select(Article)
                .options(selectinload(Article.content))
                .filter(Article.id.in_(article_ids))
            )
            created_articles = final_result.scalars().all()

        return created_articles

    @staticmethod
    async def update_article_status(
        db: AsyncSession,
        *,
        article_id: UUID,
        article_in: ArticleUpdate,
        user_id: UUID,
    ) -> Article | None:
        """Update article status (read, favorite, etc.)."""
        from app.models.rss_models import FeedArticle

        # Try to find as FeedArticle first (new architecture)
        feed_article_result = await db.execute(
            select(FeedArticle)
            .options(selectinload(FeedArticle.content), selectinload(FeedArticle.feed))
            .where(and_(FeedArticle.id == article_id, FeedArticle.user_id == user_id))
        )
        feed_article = feed_article_result.scalar_one_or_none()

        if feed_article:
            update_data = article_in.model_dump(exclude_unset=True)

            # Handle read_at timestamp
            if update_data.get("is_read"):
                update_data["read_at"] = datetime.now(timezone.utc)
            elif "is_read" in update_data and not update_data["is_read"]:
                update_data["read_at"] = None

            # Update the feed article directly on the object
            for field, value in update_data.items():
                if hasattr(feed_article, field):
                    setattr(feed_article, field, value)

            # Commit the changes
            await db.commit()

            # Refresh the object to get the latest state from DB
            await db.refresh(feed_article)
            return feed_article

        # Fall back to legacy Article model
        article = await ArticleCrudOperations.get_article_by_id(
            db, article_id=article_id, user_id=user_id
        )
        if not article:
            return None

        update_data = article_in.model_dump(exclude_unset=True)

        # Handle read_at timestamp
        if update_data.get("is_read"):
            update_data["read_at"] = datetime.now(timezone.utc)
        elif "is_read" in update_data and not update_data["is_read"]:
            update_data["read_at"] = None

        # Update the article
        await db.execute(
            update(Article)
            .where(and_(Article.id == article_id, Article.user_id == user_id))
            .values(**update_data)
        )
        await db.commit()

        # Return the updated article
        return await ArticleCrudOperations.get_article_by_id(
            db, article_id=article_id, user_id=user_id
        )
