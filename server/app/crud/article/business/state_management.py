"""Complex business logic for article state management."""

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import and_, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import ArticleContent, ClippedArticle, FeedArticle, FeedSubscription, UserArticleState
from app.schemas import ArticleUpdate


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
                selectinload(ClippedArticle.content).undefer(ArticleContent.description).undefer(ArticleContent.content)
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
                selectinload(FeedArticle.content).undefer(ArticleContent.description).undefer(ArticleContent.content),
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
        stmt = insert(UserArticleState).values(user_id=user_id, article_id=article_id, **update_data)

        # On conflict, update the existing row with new values
        stmt = stmt.on_conflict_do_update(index_elements=["user_id", "article_id"], set_=update_data)

        await db.execute(stmt)

        # Note: Commit is handled by the dependency injection layer (get_db)
        await db.flush()  # Ensure changes are persisted

        # Refresh with eager loading and get the updated user state
        refreshed_result = await db.execute(
            select(FeedArticle, UserArticleState)
            .options(
                selectinload(FeedArticle.content).undefer(ArticleContent.description).undefer(ArticleContent.content),
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
