"""CRUD operations for user feed subscriptions."""

from datetime import datetime
from uuid import UUID

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.core.constants import INITIAL_UNREAD_COUNT
from app.core.custom_exceptions import FeedSubscriptionError
from app.crud.feed.core import create_feed, get_feed_by_url, normalize_url
from app.models.article import ArticleContent, FeedArticle
from app.models.feed import Feed, FeedSubscription
from app.typing.feeds import FeedBase
from app.typing.subscriptions import SubscriptionCreate

# Minimal columns for list views
SUBSCRIPTION_FEED_COLUMNS = [
    Feed.id,
    Feed.url,
    Feed.title,
    Feed.image_url,
    Feed.last_fetched_at,
    Feed.last_article_published_at,
]


async def get_initial_cutoff(db: AsyncSession, feed_id: UUID) -> datetime | None:
    """Get the Nth most recent article timestamp."""
    result = await db.execute(
        select(FeedArticle.published_at)
        .where(FeedArticle.feed_id == feed_id)
        .order_by(FeedArticle.published_at.desc())
        .offset(INITIAL_UNREAD_COUNT)
        .limit(1)
    )
    return result.scalar_one_or_none()


async def create_subscription(
    db: AsyncSession, *, user_id: UUID, subscription_in: SubscriptionCreate, feed_db: Feed | None = None
) -> FeedSubscription:
    # 1. Resolve Feed (using core.py logic or provided feed_db)
    if feed_db:
        feed = feed_db
    else:
        normalized_url = normalize_url(str(subscription_in.url))
        feed = await get_feed_by_url(db, url=normalized_url)

        if not feed:
            feed = await create_feed(db, feed_data=FeedBase(url=normalized_url, title=str(subscription_in.url)))

    # 2. Check Duplicates
    existing = await db.execute(select(FeedSubscription).filter_by(user_id=user_id, feed_id=feed.id))
    if existing.scalar_one_or_none():
        raise FeedSubscriptionError("Already subscribed to this feed")

    # 3. Handle Folder
    folder_id = subscription_in.folder_id
    if isinstance(folder_id, str) and folder_id == "default":
        # TODO: Add logic to fetch user's default folder
        raise ValueError("Default folder resolution required")

    # 4. Create Subscription
    cutoff = await get_initial_cutoff(db, feed.id)

    sub = FeedSubscription(
        user_id=user_id,
        feed_id=feed.id,
        folder_id=UUID(str(folder_id)),
        is_favorite=subscription_in.is_favorite,
        custom_title=subscription_in.custom_title,
        last_read_cutoff=cutoff,
    )

    db.add(sub)

    # 5. Increment Feed Counter
    # (SQLAlchemy might handle this via trigger, but explicit is fine in functional CRUD)
    await db.execute(update(Feed).where(Feed.id == feed.id).values(subscriber_count=Feed.subscriber_count + 1))

    await db.flush()
    await db.refresh(sub, ["feed", "folder"])
    return sub


async def get_subscription_by_feed_id(db: AsyncSession, *, feed_id: UUID, user_id: UUID) -> FeedSubscription | None:
    """Get subscription by feed_id and user_id."""
    stmt = (
        select(FeedSubscription)
        .options(
            joinedload(FeedSubscription.feed).load_only(*SUBSCRIPTION_FEED_COLUMNS),
            joinedload(FeedSubscription.folder),
        )
        .filter(FeedSubscription.feed_id == feed_id, FeedSubscription.user_id == user_id)
    )
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def get_subscriptions_by_user(
    db: AsyncSession, *, user_id: UUID, folder_id: UUID | None = None, skip: int = 0, limit: int = 100
) -> list[FeedSubscription]:
    stmt = (
        select(FeedSubscription)
        .options(
            joinedload(FeedSubscription.feed).load_only(*SUBSCRIPTION_FEED_COLUMNS),
            joinedload(FeedSubscription.folder),
        )
        .filter(FeedSubscription.user_id == user_id)
    )
    if folder_id is not None:
        stmt = stmt.filter(FeedSubscription.folder_id == folder_id)
    stmt = stmt.order_by(FeedSubscription.custom_title.asc().nulls_last(), FeedSubscription.created_at.desc())
    stmt = stmt.offset(skip).limit(limit)
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def delete_subscription(db: AsyncSession, *, subscription_id: UUID, user_id: UUID):
    sub = await db.get(FeedSubscription, subscription_id)
    if not sub or sub.user_id != user_id:
        return None

    await db.delete(sub)

    # Decrement counter
    await db.execute(
        update(Feed)
        .where(Feed.id == sub.feed_id, Feed.subscriber_count > 0)
        .values(subscriber_count=Feed.subscriber_count - 1)
    )
    return sub


async def update_subscription(
    db: AsyncSession,
    *,
    subscription: FeedSubscription,
    custom_title: str | None = None,
    folder_id: UUID | None = None,
    is_favorite: bool | None = None,
) -> FeedSubscription:
    """Update subscription fields."""
    if custom_title is not None:
        subscription.custom_title = custom_title
    if folder_id is not None:
        subscription.folder_id = folder_id
    if is_favorite is not None:
        subscription.is_favorite = is_favorite

    await db.flush()
    await db.refresh(subscription)
    return subscription


async def bulk_update_subscriptions_folder(
    db: AsyncSession, *, feed_ids: list[UUID], user_id: UUID, folder_id: UUID
) -> int:
    """
    Bulk update folder_id for multiple subscriptions.

    Returns the number of subscriptions updated.
    """
    stmt = (
        update(FeedSubscription)
        .where(
            FeedSubscription.feed_id.in_(feed_ids),
            FeedSubscription.user_id == user_id,
        )
        .values(folder_id=folder_id)
    )
    result = await db.execute(stmt)
    await db.flush()
    return result.rowcount


async def compact_unread_subscriptions(db: AsyncSession, *, cutoff_date: datetime) -> int:
    """
    Update last_read_cutoff for all subscriptions to compact unread articles.

    Sets last_read_cutoff to the maximum of its current value and the provided cutoff_date.
    This marks articles older than cutoff_date as read for all users.

    Args:
        db: Database session
        cutoff_date: Date threshold - articles older than this will be marked as read

    Returns:
        Number of subscriptions updated
    """
    import structlog
    logger = structlog.get_logger(__name__)
    
    # First, let's see what subscriptions match our criteria
    debug_stmt = select(FeedSubscription.id, FeedSubscription.last_read_cutoff).where(
        (FeedSubscription.last_read_cutoff.is_(None)) | (FeedSubscription.last_read_cutoff < cutoff_date)
    )
    debug_result = await db.execute(debug_stmt)
    matching_subs = debug_result.fetchall()
    logger.info(f"Subscriptions matching compaction criteria", count=len(matching_subs), cutoff_date=cutoff_date)
    
    stmt = (
        update(FeedSubscription)
        .where(
            # Only update subscriptions where cutoff is NULL or older than the new cutoff
            (FeedSubscription.last_read_cutoff.is_(None)) | (FeedSubscription.last_read_cutoff < cutoff_date)
        )
        .values(last_read_cutoff=cutoff_date)
        .execution_options(synchronize_session=False)
    )

    result = await db.execute(stmt)
    await db.flush()
    logger.info(f"Updated subscriptions", rowcount=result.rowcount)
    return result.rowcount
