"""CRUD operations for user feed subscriptions."""

from datetime import datetime
from uuid import UUID

import structlog
from sqlalchemy import delete, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.core.constants import INITIAL_UNREAD_COUNT
from app.core.custom_exceptions import FeedSubscriptionError
from app.crud.feed.core import create_feed, get_feed_by_url, normalize_url
from app.crud.folder import upsert_batch
from app.models.article import FeedArticle
from app.models.feed import Feed, FeedSubscription
from app.typing.feeds import FeedBase
from app.typing.subscriptions import SubscriptionCreate

logger = structlog.get_logger(__name__)

# Minimal columns for list views
SUBSCRIPTION_FEED_COLUMNS = [
    Feed.id,
    Feed.url,
    Feed.title,
    Feed.image_url,
    Feed.last_fetched_at,
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
    db: AsyncSession,
    *,
    user_id: UUID,
    subscription_in: SubscriptionCreate,
    feed_db: Feed | None = None,
) -> FeedSubscription:
    # 1. Resolve Feed (using core.py logic or provided feed_db)
    if feed_db:
        feed = feed_db
    else:
        normalized_url = normalize_url(str(subscription_in.url))
        feed = await get_feed_by_url(db, url=normalized_url)

        if not feed:
            feed = await create_feed(
                db,
                feed_data=FeedBase(url=normalized_url, title=str(subscription_in.url)),
            )

    # 2. Check Duplicates
    existing = await db.execute(select(FeedSubscription).filter_by(user_id=user_id, feed_id=feed.id))
    if existing.scalar_one_or_none():
        raise FeedSubscriptionError("Already subscribed to this feed")

    # 3. Handle Folder
    folder_id = subscription_in.folder_id
    if isinstance(folder_id, str) and folder_id == "default":
        # Ensure "My Feeds" folder exists using centralized CRUD
        folder_map = await upsert_batch(db, folder_names=["My Feeds"], user_id=user_id)
        folder_id = folder_map["My Feeds"]

    # 4. Create Subscription
    cutoff = await get_initial_cutoff(db, feed.id)

    sub = FeedSubscription(
        user_id=user_id,
        feed_id=feed.id,
        folder_id=UUID(str(folder_id)),
        is_favorite=False,  # Default to False, can be updated later
        custom_title=subscription_in.custom_title,
        last_read_cutoff=cutoff,
    )

    db.add(sub)

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
    db: AsyncSession,
    *,
    user_id: UUID,
    folder_id: UUID | None = None,
    extended: bool = False,
    skip: int = 0,
    limit: int = 100,
) -> list[FeedSubscription]:
    stmt = select(FeedSubscription).filter(FeedSubscription.user_id == user_id)
    
    # Load feed with appropriate detail level
    if extended:
        # Load all feed fields for extended response
        stmt = stmt.options(
            joinedload(FeedSubscription.feed),
            joinedload(FeedSubscription.folder),
        )
    else:
        # Load only minimal feed fields for list view
        stmt = stmt.options(
            joinedload(FeedSubscription.feed).load_only(*SUBSCRIPTION_FEED_COLUMNS),
            joinedload(FeedSubscription.folder),
        )
    
    if folder_id is not None:
        stmt = stmt.filter(FeedSubscription.folder_id == folder_id)
    stmt = stmt.order_by(
        FeedSubscription.custom_title.asc().nulls_last(),
        FeedSubscription.created_at.desc(),
    )
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


async def bulk_delete_subscriptions(db: AsyncSession, *, feed_ids: list[UUID], user_id: UUID) -> list[UUID]:
    """
    Bulk delete subscriptions by feed IDs.
    Returns the list of feed IDs that were actually deleted.
    """
    # 1. Find existing subscriptions to verify ownership and get valid feed IDs
    stmt = select(FeedSubscription.feed_id).where(
        FeedSubscription.feed_id.in_(feed_ids),
        FeedSubscription.user_id == user_id,
    )
    result = await db.execute(stmt)
    valid_feed_ids = list(result.scalars().all())

    if not valid_feed_ids:
        return []

    # 2. Delete subscriptions
    delete_stmt = delete(FeedSubscription).where(
        FeedSubscription.feed_id.in_(valid_feed_ids),
        FeedSubscription.user_id == user_id,
    )
    await db.execute(delete_stmt)

    # 3. Decrement subscriber counts
    update_stmt = (
        update(Feed)
        .where(Feed.id.in_(valid_feed_ids), Feed.subscriber_count > 0)
        .values(subscriber_count=Feed.subscriber_count - 1)
    )
    await db.execute(update_stmt)

    await db.flush()
    return valid_feed_ids


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

    # First, let's see what subscriptions match our criteria
    debug_stmt = select(FeedSubscription.id, FeedSubscription.last_read_cutoff).where(
        (FeedSubscription.last_read_cutoff.is_(None)) | (FeedSubscription.last_read_cutoff < cutoff_date)
    )
    debug_result = await db.execute(debug_stmt)
    matching_subs = debug_result.fetchall()
    logger.info(
        "Subscriptions matching compaction criteria",
        count=len(matching_subs),
        cutoff_date=cutoff_date,
    )

    # Use CASE statement to set cutoff_date properly
    # If cutoff is NULL or less than cutoff_date, set it to cutoff_date
    # Otherwise keep the existing value
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
    await db.commit()  # Commit the changes so tests can see them
    logger.info("Updated subscriptions", rowcount=result.rowcount)
    return result.rowcount
