"""Core article CRUD operations - FIXED VERSION."""

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import and_, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.crud.article_query_builder import ArticleQueryBuilder
from app.models.rss_models import (
    Article,
    ArticleContent,
    ClippedArticle,
    FeedArticle,
    FeedSubscription,
    UserArticleState,
)
from app.schemas.rss_schemas import ArticleCreate, ArticleUpdate


class ArticleCrudOperations:
    """Core CRUD operations for articles."""

    @staticmethod
    async def get_article_by_id(
        db: AsyncSession, *, article_id: UUID, user_id: UUID
    ) -> tuple[FeedArticle, UserArticleState] | ClippedArticle | None:
        """Get a specific article by its ID, ensuring it belongs to the user."""
        # First try to get from feed_articles (RSS articles) with user state
        # Need to join with FeedSubscription to ensure user has access to this feed
        result = await db.execute(
            select(FeedArticle, UserArticleState)
            .options(selectinload(FeedArticle.feed), selectinload(FeedArticle.content))
            .join(FeedSubscription, FeedSubscription.feed_id == FeedArticle.feed_id)
            .outerjoin(
                UserArticleState,
                (UserArticleState.article_id == FeedArticle.id)
                & (UserArticleState.user_id == user_id),
            )
            .filter(FeedArticle.id == article_id, FeedSubscription.user_id == user_id)
        )
        row = result.first()
        if row:
            return (row[0], row[1])  # (FeedArticle, UserArticleState)

        # If not found, try clipped_articles (manually saved articles)
        result = await db.execute(
            select(ClippedArticle)
            .options(selectinload(ClippedArticle.content))
            .filter(ClippedArticle.id == article_id, ClippedArticle.user_id == user_id)
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
    ) -> tuple[list[tuple[FeedArticle, UserArticleState]], int]:
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
        rows = articles_result.all()  # Get all rows
        # Extract the FeedArticle and UserArticleState objects from each row
        articles = [
            (row[0], row[1]) for row in rows
        ]  # row[0] is FeedArticle, row[1] is UserArticleState
        return articles, total_count

    @staticmethod
    async def create_articles_batch(
        db: AsyncSession, *, articles_data: list[ArticleCreate], user_id: UUID
    ) -> list[Article]:
        """Create multiple articles in batch for better performance."""
        if not articles_data:
            return []

        try:
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

            # Bulk insert content with RETURNING to get IDs directly
            content_insert_stmt = insert(ArticleContent).values(content_mappings)
            content_result = await db.execute(
                content_insert_stmt.returning(ArticleContent.id, ArticleContent.link)
            )
            content_rows = content_result.fetchall()
            await db.flush()

            # Step 5: Bulk create articles and user article states
            article_mappings = []
            user_article_state_mappings = []
            created_articles_list = []  # To store the actual Article objects created

            for article_in, content_row in zip(new_articles, content_rows, strict=False):
                # Data for the Article table (global article info)
                article_map = {
                    "feed_id": article_in.feed_id,
                    "content_id": content_row.id,
                    "guid": article_in.guid,
                    "created_at": current_time,
                }
                article_mappings.append(article_map)

            # Bulk insert articles with ON CONFLICT DO NOTHING for safety
            # Use insert().returning() to get the IDs of the newly created articles
            article_insert_stmt = insert(Article).values(article_mappings)
            article_insert_stmt = article_insert_stmt.on_conflict_do_nothing(
                index_elements=["feed_id", "guid"]
            ).returning(
                Article.id,
                Article.feed_id,
                Article.guid,
                Article.content_id,
                Article.created_at,
            )  # Include all columns needed to reconstruct Article object

            result = await db.execute(article_insert_stmt)
            newly_inserted_articles_data = result.fetchall()

            # Create UserArticleState entries for each newly inserted article
            for article_data_tuple in newly_inserted_articles_data:
                # Reconstruct a temporary Article object from the returned data
                # This is a simplified reconstruction, assuming the order of returning() matches Article constructor
                temp_article = Article(
                    id=article_data_tuple[0],
                    feed_id=article_data_tuple[1],
                    guid=article_data_tuple[2],
                    content_id=article_data_tuple[3],
                    created_at=article_data_tuple[4],
                    # Add other fields if necessary, or fetch full objects later
                )
                created_articles_list.append(temp_article)

                user_article_state_mappings.append(
                    {
                        "user_id": user_id,
                        "article_id": temp_article.id,
                        "is_read": False,
                        "is_read_later": False,
                        "is_favorite": False,
                        "created_at": current_time,
                        "updated_at": current_time,
                    }
                )

            if user_article_state_mappings:
                # Bulk insert UserArticleState entries
                user_state_insert_stmt = insert(UserArticleState).values(
                    user_article_state_mappings
                )
                # On conflict, do nothing for user states as well
                user_state_insert_stmt = user_state_insert_stmt.on_conflict_do_nothing(
                    index_elements=["user_id", "article_id"]
                )
                await db.execute(user_state_insert_stmt)

            # Commit all changes atomically
            await db.commit()

            # Return the created articles list (not count)
            return created_articles_list

        except Exception as e:
            # Rollback all changes on any error to prevent partial data corruption
            await db.rollback()
            raise e

    @staticmethod
    async def update_article_status(
        db: AsyncSession,
        *,
        article_id: UUID,
        article_in: ArticleUpdate,
        user_id: UUID,
    ) -> Article | None:
        """Update article status (read, favorite, etc.)."""
        # Combined query: get FeedArticle, verify subscription, and get existing UserArticleState in one query
        combined_result = await db.execute(
            select(FeedArticle, FeedSubscription, UserArticleState)
            .join(FeedSubscription, FeedSubscription.feed_id == FeedArticle.feed_id)
            .outerjoin(
                UserArticleState,
                and_(
                    UserArticleState.user_id == user_id,
                    UserArticleState.article_id == article_id,
                )
            )
            .options(
                selectinload(FeedArticle.content), 
                selectinload(FeedArticle.feed)
            )
            .where(
                and_(
                    FeedArticle.id == article_id,
                    FeedSubscription.user_id == user_id,
                )
            )
        )
        result_tuple = combined_result.first()
        
        if not result_tuple:
            # Either article doesn't exist or user doesn't have access to the feed
            return None
            
        feed_article, subscription, user_state = result_tuple

        update_data = article_in.model_dump(exclude_unset=True)

        # Handle read_at timestamp
        if update_data.get("is_read"):
            update_data["read_at"] = datetime.now(timezone.utc)
        elif "is_read" in update_data and not update_data["is_read"]:
            update_data["read_at"] = None

        if user_state:
            # Update existing state
            for field, value in update_data.items():
                if hasattr(user_state, field):
                    setattr(user_state, field, value)
        else:
            # Create new state
            user_state = UserArticleState(
                user_id=user_id, article_id=article_id, **update_data
            )
            db.add(user_state)

        # Commit the changes
        await db.commit()

        # Refresh both objects
        await db.refresh(feed_article)
        await db.refresh(user_state)

        # Return the feed article (maintaining compatibility)
        return feed_article

        # If not found in feed articles, try clipped articles
        clipped_article_result = await db.execute(
            select(ClippedArticle)
            .options(selectinload(ClippedArticle.content))
            .where(
                and_(ClippedArticle.id == article_id, ClippedArticle.user_id == user_id)
            )
        )
        clipped_article = clipped_article_result.scalar_one_or_none()

        if clipped_article:
            update_data = article_in.model_dump(exclude_unset=True)

            # Handle read_at timestamp
            if update_data.get("is_read"):
                update_data["read_at"] = datetime.now(timezone.utc)
            elif "is_read" in update_data and not update_data["is_read"]:
                update_data["read_at"] = None

            # Update clipped article directly (it stores its own state)
            for field, value in update_data.items():
                if hasattr(clipped_article, field):
                    setattr(clipped_article, field, value)

            # Commit the changes
            await db.commit()

            # Refresh the object
            await db.refresh(clipped_article)

            # Return the clipped article
            return clipped_article

        # Article not found or user doesn't have access
        return None
