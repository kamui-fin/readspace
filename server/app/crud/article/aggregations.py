"""Simplified aggregation queries."""

from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import FeedArticle, FeedSubscription, Folder, UserEntry


async def get_all_unread_counts(db: AsyncSession, *, user_id: UUID) -> dict[str, int]:
    """
    Get unread counts for all folders - SIMPLIFIED!

    No more complex CTEs with COALESCE logic.
    """
    # Get total articles per folder after cutoff
    total_stmt = (
        select(
            Folder.id.label("folder_id"),
            Folder.name.label("folder_name"),
            func.count(FeedArticle.id).label("total"),
        )
        .join(FeedSubscription, Folder.id == FeedSubscription.folder_id)
        .join(FeedArticle, FeedSubscription.feed_id == FeedArticle.feed_id)
        .filter(
            Folder.user_id == user_id,
            FeedArticle.published_at > FeedSubscription.last_read_cutoff,
        )
        .group_by(Folder.id, Folder.name)
    )

    # Get read articles per folder
    read_stmt = (
        select(
            Folder.id.label("folder_id"),
            func.count(UserEntry.id).label("read_count"),
        )
        .join(FeedSubscription, Folder.id == FeedSubscription.folder_id)
        .join(FeedArticle, FeedSubscription.feed_id == FeedArticle.feed_id)
        .join(UserEntry, UserEntry.feed_article_id == FeedArticle.id)
        .filter(
            Folder.user_id == user_id,
            UserEntry.user_id == user_id,
            UserEntry.is_read == True,
        )
        .group_by(Folder.id)
    )

    total_result = await db.execute(total_stmt)
    read_result = await db.execute(read_stmt)

    # Build totals map
    totals = {row.folder_id: {"name": row.folder_name, "total": row.total} for row in total_result.all()}

    # Build read map
    read_counts = {row.folder_id: row.read_count for row in read_result.all()}

    # Calculate unread
    unread_by_folder = {}
    for folder_id, data in totals.items():
        read = read_counts.get(folder_id, 0)
        unread = max(0, data["total"] - read)
        unread_by_folder[data["name"]] = unread

    return unread_by_folder


async def get_unread_counts_by_folder(db: AsyncSession, *, user_id: UUID) -> list[dict]:
    """Get unread counts grouped by folder with folder details."""
    # Same as above but returns list format
    counts = await get_all_unread_counts(db, user_id=user_id)
    return [{"folder_name": name, "unread_count": count} for name, count in counts.items()]
