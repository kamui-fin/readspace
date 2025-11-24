"""Simplified state management using UserEntry."""

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import ArticleContent, FeedArticle, UserEntry
from app.schemas import ArticleUpdate


async def update_article_status(
    db: AsyncSession,
    *,
    article_id: UUID,
    article_in: ArticleUpdate,
    user_id: UUID,
) -> tuple[FeedArticle, UserEntry] | None:
    """
    Update article status - SIMPLIFIED!

    Single table (user_entries) for all user state.
    """
    # Get the feed article
    feed_article_result = await db.execute(
        select(FeedArticle)
        .options(
            selectinload(FeedArticle.content).undefer(ArticleContent.description).undefer(ArticleContent.content),
            selectinload(FeedArticle.feed),
        )
        .filter(FeedArticle.id == article_id)
    )
    feed_article = feed_article_result.scalar_one_or_none()

    if not feed_article:
        return None

    # Get or create user entry
    user_entry_result = await db.execute(
        select(UserEntry).filter(
            UserEntry.user_id == user_id,
            UserEntry.content_id == feed_article.content_id,
        )
    )
    user_entry = user_entry_result.scalar_one_or_none()

    update_data = article_in.model_dump(exclude_unset=True)

    # Handle read_at timestamp
    if update_data.get("is_read") and not update_data.get("read_at"):
        update_data["read_at"] = datetime.now(timezone.utc)

    if user_entry:
        # Update existing entry
        for key, value in update_data.items():
            setattr(user_entry, key, value)
        user_entry.updated_at = datetime.now(timezone.utc)
    else:
        # Create new entry
        user_entry = UserEntry(
            user_id=user_id,
            content_id=feed_article.content_id,
            feed_article_id=article_id,
            **update_data,
        )
        db.add(user_entry)

    await db.flush()
    await db.refresh(user_entry)

    return feed_article, user_entry


async def mark_all_as_read(
    db: AsyncSession,
    *,
    user_id: UUID,
    feed_id: UUID | None = None,
    folder_id: UUID | None = None,
) -> int:
    """
    Mark all articles as read by updating last_read_cutoff.

    This is the efficient way - no need to create individual user_entries.
    """
    from app.models import FeedSubscription

    stmt = select(FeedSubscription).filter(FeedSubscription.user_id == user_id)

    if feed_id:
        stmt = stmt.filter(FeedSubscription.feed_id == feed_id)
    if folder_id:
        stmt = stmt.filter(FeedSubscription.folder_id == folder_id)

    result = await db.execute(stmt)
    subscriptions = result.scalars().all()

    cutoff_time = datetime.now(timezone.utc)
    count = 0

    for subscription in subscriptions:
        subscription.last_read_cutoff = cutoff_time
        count += 1

    await db.flush()
    return count
