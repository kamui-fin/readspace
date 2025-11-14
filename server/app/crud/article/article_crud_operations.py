"""Core article CRUD operations - FIXED VERSION."""

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import and_, select, tuple_
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.crud.article.article_query_builder import ArticleQueryBuilder
from app.models import (
    ArticleContent,
    ClippedArticle,
    FeedArticle,
    FeedSubscription,
    UserArticleState,
)
from app.schemas import ArticleCreate, ArticleUpdate


class ArticleCrudOperations:
    """Core CRUD operations for articles."""

    @staticmethod
    async def get_article_by_id(
        db: AsyncSession,
        *,
        article_id: UUID,
        user_id: UUID,
        allow_preview: bool = False,
        load_full_content: bool = True,
    ) -> tuple[FeedArticle, UserArticleState] | ClippedArticle | None:
        """Get a specific article by its ID, ensuring it belongs to the user.

        Args:
            db: Database session
            article_id: Article UUID
            user_id: User UUID
            allow_preview: Allow access to unsubscribed feeds
            load_full_content: Load full description and content (default True for detail views)
        """
        # Build eager loading options
        content_options = [selectinload(FeedArticle.content)]
        if load_full_content:
            content_options.append(selectinload(FeedArticle.content).undefer_group("content_details"))

        # First try to get from feed_articles (RSS articles) with user state
        if allow_preview:
            # In preview mode, don't require subscription - just get the article
            result = await db.execute(
                select(FeedArticle, UserArticleState)
                .options(selectinload(FeedArticle.feed), *content_options)
                .outerjoin(
                    UserArticleState,
                    (UserArticleState.article_id == FeedArticle.id) & (UserArticleState.user_id == user_id),
                )
                .filter(FeedArticle.id == article_id)
            )
        else:
            # Normal mode - require subscription to access the feed
            result = await db.execute(
                select(FeedArticle, UserArticleState)
                .options(selectinload(FeedArticle.feed), *content_options)
                .join(FeedSubscription, FeedSubscription.feed_id == FeedArticle.feed_id)
                .outerjoin(
                    UserArticleState,
                    (UserArticleState.article_id == FeedArticle.id) & (UserArticleState.user_id == user_id),
                )
                .filter(FeedArticle.id == article_id, FeedSubscription.user_id == user_id)
            )

        row = result.first()
        if row:
            return (row[0], row[1])  # (FeedArticle, UserArticleState)

        # If not found, try clipped_articles (manually saved articles)
        # Clipped articles always require user ownership
        clipped_options = [selectinload(ClippedArticle.content)]
        if load_full_content:
            clipped_options.append(selectinload(ClippedArticle.content).undefer_group("content_details"))

        result = await db.execute(
            select(ClippedArticle)
            .options(*clipped_options)
            .filter(ClippedArticle.id == article_id, ClippedArticle.user_id == user_id)
        )
        return result.scalars().first()

    @staticmethod
    async def get_article_by_guid(db: AsyncSession, *, feed_id: UUID, guid: str) -> FeedArticle | None:
        """Get a specific article by its GUID for a given feed_id to check for existence."""
        result = await db.execute(select(FeedArticle).filter(FeedArticle.feed_id == feed_id, FeedArticle.guid == guid))
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
        allow_preview: bool = False,
        load_full_content: bool = False,
    ) -> list[tuple[FeedArticle, UserArticleState]]:
        """Get articles for a user with comprehensive filtering and sorting.

        Args:
            load_full_content: If True, loads full description and content fields.
                              Default False for list views to reduce bandwidth.
        """
        query_builder = ArticleQueryBuilder(user_id, allow_preview=allow_preview, load_full_content=load_full_content)

        stmt = query_builder.build_filtered_query(
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

        articles_result = await db.execute(stmt)
        rows = articles_result.all()  # Get all rows
        # Extract the FeedArticle and UserArticleState objects from each row
        articles = [(row[0], row[1]) for row in rows]  # row[0] is FeedArticle, row[1] is UserArticleState
        return articles

    @staticmethod
    async def count_articles_filtered(
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
        allow_preview: bool = False,
    ) -> int:
        """Count articles for a user with comprehensive filtering (for pagination total_count)."""
        query_builder = ArticleQueryBuilder(user_id, allow_preview=allow_preview)

        stmt = query_builder.build_count_query(
            feed_ids=feed_ids,
            folder_id=folder_id,
            is_read=is_read,
            is_read_later=is_read_later,
            is_favorite=is_favorite,
            feed_is_favorite=feed_is_favorite,
            published_since=published_since,
            published_until=published_until,
            search_query=search_query,
        )

        result = await db.execute(stmt)
        return result.scalar_one() or 0

    @staticmethod
    async def create_articles_batch(
        db: AsyncSession, *, articles_data: list[ArticleCreate], user_id: UUID
    ) -> list[FeedArticle]:
        """Create multiple articles in batch for better performance."""
        if not articles_data:
            return []

        try:
            # Step 1: Bulk duplicate check - collect all (feed_id, guid) pairs
            feed_guid_pairs = [(article.feed_id, article.guid) for article in articles_data]

            # Check for existing articles using IN clause
            # This approach works well for all batch sizes and avoids SQL injection concerns
            existing_result = await db.execute(
                select(FeedArticle.feed_id, FeedArticle.guid).filter(
                    tuple_(FeedArticle.feed_id, FeedArticle.guid).in_(feed_guid_pairs)
                )
            )
            existing_pairs = {(row[0], row[1]) for row in existing_result.fetchall()}

            # Step 2: Filter out duplicates
            new_articles = [
                article for article in articles_data if (article.feed_id, article.guid) not in existing_pairs
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
                        "estimated_read_time_minutes": getattr(article_in, "estimated_read_time_minutes", None),
                        "created_at": current_time,
                        "updated_at": current_time,
                    }
                )

            # Bulk insert content with RETURNING to get IDs directly
            content_insert_stmt = insert(ArticleContent).values(content_mappings)
            content_result = await db.execute(content_insert_stmt.returning(ArticleContent.id, ArticleContent.link))
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
            article_insert_stmt = insert(FeedArticle).values(article_mappings)
            article_returning_stmt = article_insert_stmt.on_conflict_do_nothing(
                index_elements=["feed_id", "guid"]
            ).returning(
                FeedArticle.id,
                FeedArticle.feed_id,
                FeedArticle.guid,
                FeedArticle.content_id,
                FeedArticle.created_at,
            )  # Include all columns needed to reconstruct Article object

            result = await db.execute(article_returning_stmt)
            newly_inserted_articles_data = result.fetchall()

            # Create UserArticleState entries for each newly inserted article
            for article_data_tuple in newly_inserted_articles_data:
                # Reconstruct a temporary Article object from the returned data
                # This is a simplified reconstruction, assuming the order of returning() matches Article constructor
                temp_article = FeedArticle(
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
                user_state_insert_stmt = insert(UserArticleState).values(user_article_state_mappings)
                # On conflict, do nothing for user states as well
                user_state_insert_stmt = user_state_insert_stmt.on_conflict_do_nothing(
                    index_elements=["user_id", "article_id"]
                )
                await db.execute(user_state_insert_stmt)

            # Note: Commit is handled by the dependency injection layer (get_db)
            # No manual commit needed here to avoid double-commit overhead
            await db.flush()  # Ensure changes are flushed to get IDs

            # Return the created articles list (not count)
            return created_articles_list

        except Exception:
            # Note: Rollback is handled automatically by get_db() dependency
            # Re-raising exception for proper error handling upstream
            raise

    @staticmethod
    async def update_article_status(
        db: AsyncSession,
        *,
        article_id: UUID,
        article_in: ArticleUpdate,
        user_id: UUID,
        article_type: str = "feed",
    ) -> tuple[FeedArticle, UserArticleState] | ClippedArticle | None:
        """Update article status (read, favorite, etc.)."""
        update_data = article_in.model_dump(exclude_unset=True)

        # Handle read_at timestamp
        if update_data.get("is_read"):
            update_data["read_at"] = datetime.now(timezone.utc)
        elif "is_read" in update_data and not update_data["is_read"]:
            update_data["read_at"] = None

        if article_type == "clipped":
            # Handle clipped articles
            clipped_article_result = await db.execute(
                select(ClippedArticle)
                .options(
                    selectinload(ClippedArticle.content)
                    .undefer(ArticleContent.description)
                    .undefer(ArticleContent.content)
                )
                .where(
                    and_(
                        ClippedArticle.id == article_id,
                        ClippedArticle.user_id == user_id,
                    )
                )
            )
            clipped_article = clipped_article_result.scalar_one_or_none()

            if not clipped_article:
                return None

            # Handle title update separately (it's stored in ArticleContent, not ClippedArticle)
            title_to_update = update_data.pop("title", None)
            if title_to_update and clipped_article.content:
                clipped_article.content.title = title_to_update

            # Update clipped article directly (it stores its own state)
            for field, value in update_data.items():
                if hasattr(clipped_article, field):
                    setattr(clipped_article, field, value)

            # Note: Commit is handled by the dependency injection layer (get_db)
            await db.flush()  # Ensure changes are persisted

            # Don't refresh - we already have the object with eager-loaded relationships
            # Refreshing can lose the eager loading and cause MissingGreenlet errors

            # Return the clipped article with already-loaded content relationship
            return clipped_article

        else:
            # Handle feed articles
            combined_result = await db.execute(
                select(FeedArticle, FeedSubscription, UserArticleState)
                .join(FeedSubscription, FeedSubscription.feed_id == FeedArticle.feed_id)
                .outerjoin(
                    UserArticleState,
                    and_(
                        UserArticleState.user_id == user_id,
                        UserArticleState.article_id == article_id,
                    ),
                )
                .options(
                    selectinload(FeedArticle.content)
                    .undefer(ArticleContent.description)
                    .undefer(ArticleContent.content),
                    selectinload(FeedArticle.feed),
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
                return None

            feed_article: FeedArticle
            feed_article, subscription, user_state = result_tuple

            # Use PostgreSQL UPSERT to handle race conditions atomically
            # This prevents duplicate key violations when concurrent requests
            # try to create the same user_article_state
            from sqlalchemy.dialects.postgresql import insert

            stmt = insert(UserArticleState).values(
                user_id=user_id,
                article_id=article_id,
                **update_data
            )

            # On conflict, update the existing row with new values
            stmt = stmt.on_conflict_do_update(
                index_elements=['user_id', 'article_id'],
                set_=update_data
            )

            await db.execute(stmt)

            # Note: Commit is handled by the dependency injection layer (get_db)
            await db.flush()  # Ensure changes are persisted

            # Refresh with eager loading and get the updated user state
            refreshed_result = await db.execute(
                select(FeedArticle, UserArticleState)
                .options(
                    selectinload(FeedArticle.content)
                    .undefer(ArticleContent.description)
                    .undefer(ArticleContent.content),
                    selectinload(FeedArticle.feed),
                )
                .outerjoin(
                    UserArticleState,
                    and_(
                        UserArticleState.user_id == user_id,
                        UserArticleState.article_id == article_id,
                    ),
                )
                .where(FeedArticle.id == article_id)
            )
            result_tuple = refreshed_result.first()

            if result_tuple:
                feed_article, updated_user_state = result_tuple
                # Return tuple for transformer compatibility
                return (feed_article, updated_user_state)

            return None
