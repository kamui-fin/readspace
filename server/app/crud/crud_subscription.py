"""CRUD operations for feed subscriptions."""

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.crud import crud_feed, crud_folder
from app.models.rss_models import Feed, FeedSubscription
from app.schemas.subscription_schemas import SubscriptionCreate, SubscriptionUpdate


async def get_subscription_by_id(db: AsyncSession, *, subscription_id: UUID, user_id: UUID) -> FeedSubscription | None:
    """Get a subscription by ID for a specific user."""
    result = await db.execute(
        select(FeedSubscription)
        .options(selectinload(FeedSubscription.feed), selectinload(FeedSubscription.folder))
        .filter(FeedSubscription.id == subscription_id, FeedSubscription.user_id == user_id)
    )
    return result.scalars().first()


async def get_subscription_by_feed_url(db: AsyncSession, *, url: str, user_id: UUID) -> FeedSubscription | None:
    """Get a user's subscription to a feed by the feed's URL."""
    result = await db.execute(
        select(FeedSubscription)
        .options(selectinload(FeedSubscription.feed), selectinload(FeedSubscription.folder))
        .join(Feed)
        .filter(Feed.url == url, FeedSubscription.user_id == user_id)
    )
    return result.scalars().first()


async def get_subscriptions_by_user(
    db: AsyncSession,
    *,
    user_id: UUID,
    skip: int = 0,
    limit: int = 100,
    folder_id: UUID | None = None,
    tag_names: list[str] | None = None,
    is_favorite: bool | None = None,
    search_query: str | None = None,
) -> list[FeedSubscription]:
    """Get subscriptions for a user with filtering options."""
    stmt = (
        select(FeedSubscription)
        .options(selectinload(FeedSubscription.feed), selectinload(FeedSubscription.folder))
        .join(Feed)
        .filter(FeedSubscription.user_id == user_id)
    )

    if folder_id:
        stmt = stmt.filter(FeedSubscription.folder_id == folder_id)

    if is_favorite is not None:
        stmt = stmt.filter(FeedSubscription.is_favorite == is_favorite)

    # Tag filtering removed - feeds now use tags as ARRAY field
    # tag filtering would need to be adapted for ARRAY contains operations

    if search_query:
        stmt = stmt.filter(
            (Feed.title.ilike(f"%{search_query}%")) | (FeedSubscription.custom_title.ilike(f"%{search_query}%"))
        )

    # Order by custom title if set, otherwise by feed title
    stmt = stmt.order_by(FeedSubscription.custom_title.asc().nulls_last(), Feed.title.asc()).offset(skip).limit(limit)

    result = await db.execute(stmt)
    return list(result.scalars().all())


async def create_subscription(
    db: AsyncSession,
    *,
    subscription_in: SubscriptionCreate,
    user_id: UUID,
    feed_data: dict | None = None,
) -> FeedSubscription:
    """Create a new feed subscription for a user."""
    # Validate folder exists (handle string case for default folder)
    folder_id = subscription_in.folder_id
    if isinstance(folder_id, str):
        # This handles the 'default' case - convert to actual UUID
        # For now, let's assume we need to resolve this elsewhere
        raise ValueError("String folder_id not yet supported in this method")

    folder = await crud_folder.get_folder(db, folder_id=folder_id, user_id=user_id)
    if not folder:
        raise ValueError(f"Folder with id {subscription_in.folder_id} not found for this user.")

    # Check if subscription already exists
    existing_subscription = await get_subscription_by_feed_url(db, url=str(subscription_in.url), user_id=user_id)
    if existing_subscription:
        raise IntegrityError(
            statement=f"Subscription to feed '{subscription_in.url}' already exists for this user.",
            params=None,
            orig=Exception("Duplicate subscription"),
        )

    # Get or create global feed
    feed_db = await crud_feed.get_feed_by_url(db, url=str(subscription_in.url))
    if not feed_db:
        if not feed_data:
            raise ValueError("Feed data required to create new feed.")

        from app.schemas.rss_schemas import FeedBase

        feed_base = FeedBase(**feed_data)
        feed_db = await crud_feed.create_feed(db, feed_data=feed_base)
    # Feed exists, subscriber_count will be incremented automatically by database trigger

    # Create subscription
    subscription_data = {
        "user_id": user_id,
        "feed_id": feed_db.id,
        "folder_id": subscription_in.folder_id,
        "is_favorite": subscription_in.is_favorite or False,
        "custom_title": subscription_in.custom_title,
    }

    db_subscription = FeedSubscription(**subscription_data)

    # Tags are now handled as ARRAY field on feeds - no longer using tag_ids

    db.add(db_subscription)
    await db.commit()
    await db.refresh(db_subscription)

    # Reload with relationships
    reloaded_subscription = await get_subscription_by_id(db, subscription_id=db_subscription.id, user_id=user_id)
    if not reloaded_subscription:
        raise RuntimeError("Failed to reload created subscription")
    return reloaded_subscription


async def update_subscription(
    db: AsyncSession,
    *,
    subscription_db: FeedSubscription,
    subscription_in: SubscriptionUpdate,
) -> FeedSubscription:
    """Update an existing subscription."""
    update_data = subscription_in.model_dump(exclude_unset=True)
    user_id = subscription_db.user_id

    # Handle folder change
    if "folder_id" in update_data and update_data["folder_id"] != subscription_db.folder_id:
        new_folder_id = update_data["folder_id"]
        new_folder = await crud_folder.get_folder(db, folder_id=new_folder_id, user_id=user_id)
        if not new_folder:
            raise ValueError(f"Folder with id {new_folder_id} not found for this user.")
        subscription_db.folder_id = new_folder.id

    # Tags are now handled as ARRAY field on feeds - no longer using tag_ids

    # Update subscription-specific fields
    for field in ["is_favorite", "custom_title", "is_paused"]:
        if field in update_data:
            setattr(subscription_db, field, update_data[field])

    db.add(subscription_db)
    await db.commit()
    await db.refresh(subscription_db)

    return subscription_db


async def delete_subscription(db: AsyncSession, *, subscription_id: UUID, user_id: UUID) -> FeedSubscription | None:
    """Delete a subscription and decrement the feed's subscriber count."""
    subscription = await get_subscription_by_id(db, subscription_id=subscription_id, user_id=user_id)
    if not subscription:
        return None

    # Delete the subscription
    await db.delete(subscription)

    await db.commit()
    return subscription


async def get_subscription_by_feed_id(db: AsyncSession, *, feed_id: UUID, user_id: UUID) -> FeedSubscription | None:
    """Get a user's subscription to a feed by the feed's ID."""
    result = await db.execute(
        select(FeedSubscription)
        .options(
            selectinload(FeedSubscription.feed),
            selectinload(FeedSubscription.folder),
        )
        .filter(FeedSubscription.feed_id == feed_id, FeedSubscription.user_id == user_id)
    )
    return result.scalars().first()


async def get_all_subscriptions_for_user(db: AsyncSession, *, user_id: UUID) -> list[FeedSubscription]:
    """Get all subscriptions for a user (for OPML export, etc.)."""
    stmt = (
        select(FeedSubscription)
        .options(selectinload(FeedSubscription.feed), selectinload(FeedSubscription.folder))
        .filter(FeedSubscription.user_id == user_id)
        .order_by(FeedSubscription.subscribed_at.asc())
    )

    result = await db.execute(stmt)
    return list(result.scalars().all())
