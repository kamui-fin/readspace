"""Article count queries"""

from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.article import FeedArticle, UserEntry
from app.models.feed import FeedSubscription


async def get_unread_counts_per_feed(
    db: AsyncSession,
    *,
    user_id: UUID,
    published_until: datetime | None = None,
) -> dict[UUID, int]:
    """
    Get unread article counts for each feed subscription.

    Returns a dict mapping feed_id -> unread_count.
    Uses cutoff-based logic: articles after cutoff that aren't explicitly marked read.
    """
    stmt = (
        select(
            FeedArticle.feed_id,
            func.count(FeedArticle.id).label("unread_count"),
        )
        .join(FeedSubscription, FeedArticle.feed_id == FeedSubscription.feed_id)
        .outerjoin(
            UserEntry,
            and_(
                # Match on either content_id or feed_article_id to be safe
                or_(
                    UserEntry.content_id == FeedArticle.content_id,
                    UserEntry.feed_article_id == FeedArticle.id,
                ),
                UserEntry.user_id == user_id,
            ),
        )
        .where(
            FeedSubscription.user_id == user_id,
            or_(
                FeedSubscription.last_read_cutoff.is_(None),
                FeedArticle.published_at > FeedSubscription.last_read_cutoff,
            ),
            or_(
                UserEntry.is_read.is_(None),  # Not marked at all
                ~UserEntry.is_read,  # Explicitly marked unread
            ),
        )
    )

    if published_until:
        stmt = stmt.where(FeedArticle.published_at <= published_until)

    stmt = stmt.group_by(FeedArticle.feed_id)

    result = await db.execute(stmt)
    return {row.feed_id: row.unread_count for row in result.all()}


async def count_read_later_articles(
    db: AsyncSession,
    *,
    user_id: UUID,
) -> int:
    """Count read later articles - uses partial index."""
    stmt = select(func.count(UserEntry.id)).filter(
        UserEntry.user_id == user_id,
        UserEntry.is_saved,
    )

    result = await db.execute(stmt)
    return result.scalar() or 0


async def count_today_articles(
    db: AsyncSession,
    *,
    user_id: UUID,
    published_until: datetime | None = None,
) -> int:
    """Count articles published today in user's feeds."""
    today_start = datetime.now(timezone.utc) - timedelta(hours=24)

    stmt = (
        select(func.count(FeedArticle.id))
        .join(FeedSubscription, FeedArticle.feed_id == FeedSubscription.feed_id)
        .outerjoin(
            UserEntry,
            and_(
                or_(
                    UserEntry.content_id == FeedArticle.content_id,
                    UserEntry.feed_article_id == FeedArticle.id,
                ),
                UserEntry.user_id == user_id,
            ),
        )
        .filter(
            FeedSubscription.user_id == user_id,
            FeedArticle.published_at >= today_start,
            or_(
                FeedSubscription.last_read_cutoff.is_(None),
                FeedArticle.published_at > FeedSubscription.last_read_cutoff,
            ),
            or_(
                UserEntry.is_read.is_(None),  # Not marked at all
                ~UserEntry.is_read,  # Explicitly marked unread
            ),
        )
    )

    if published_until:
        stmt = stmt.filter(FeedArticle.published_at <= published_until)

    result = await db.execute(stmt)
    return result.scalar() or 0


async def count_total_unread_articles(
    db: AsyncSession,
    *,
    user_id: UUID,
    published_until: datetime | None = None,
) -> int:
    """
    Count total unread articles across all feeds.
    """
    # Total articles in subscribed feeds after last_read_cutoff (or all if cutoff is None)
    total_stmt = (
        select(func.count(FeedArticle.id))
        .join(FeedSubscription, FeedArticle.feed_id == FeedSubscription.feed_id)
        .filter(
            FeedSubscription.user_id == user_id,
            or_(
                FeedSubscription.last_read_cutoff.is_(None),
                FeedArticle.published_at > FeedSubscription.last_read_cutoff,
            ),
        )
    )

    if published_until:
        total_stmt = total_stmt.filter(FeedArticle.published_at <= published_until)

    # Articles explicitly marked as read
    read_stmt = select(func.count(UserEntry.id)).filter(
        UserEntry.user_id == user_id,
        UserEntry.is_read,
        UserEntry.feed_article_id.isnot(None),
    )

    if published_until:
        read_stmt = read_stmt.join(FeedArticle, UserEntry.feed_article_id == FeedArticle.id).filter(
            FeedArticle.published_at <= published_until
        )

    total_result = await db.execute(total_stmt)
    read_result = await db.execute(read_stmt)

    total = total_result.scalar() or 0
    read = read_result.scalar() or 0

    return max(0, total - read)
