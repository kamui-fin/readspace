"""CRUD operations for feed subscriptions."""

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased, selectinload

from app.crud import crud_feed, crud_folder, crud_tag
from app.models.rss_models import Feed, FeedSubscription, Tag
from app.schemas.subscription_schemas import SubscriptionCreate, SubscriptionUpdate


async def get_subscription_by_id(
    db: AsyncSession, *, subscription_id: UUID, user_id: UUID
) -> FeedSubscription | None:
    """Get a subscription by ID for a specific user."""
    result = await db.execute(
        select(FeedSubscription)
        .options(
            selectinload(FeedSubscription.feed), selectinload(FeedSubscription.folder)
        )
        .filter(
            FeedSubscription.id == subscription_id, FeedSubscription.user_id == user_id
        )
    )
    return result.scalars().first()


async def get_subscription_by_feed_url(
    db: AsyncSession, *, url: str, user_id: UUID
) -> FeedSubscription | None:
    """Get a user's subscription to a feed by the feed's URL."""
    result = await db.execute(
        select(FeedSubscription)
        .options(
            selectinload(FeedSubscription.feed), selectinload(FeedSubscription.folder)
        )
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
        .options(
            selectinload(FeedSubscription.feed), selectinload(FeedSubscription.folder)
        )
        .join(Feed)
        .filter(FeedSubscription.user_id == user_id)
    )

    if folder_id:
        stmt = stmt.filter(FeedSubscription.folder_id == folder_id)

    if is_favorite is not None:
        stmt = stmt.filter(FeedSubscription.is_favorite == is_favorite)

    if tag_names:
        # Join with tags through the feed's tag associations
        for i, tag_name in enumerate(tag_names):
            tag_alias = aliased(Tag, name=f"tag_{i}")
            stmt = stmt.join(tag_alias, Feed.tags).filter(
                tag_alias.name.ilike(tag_name)
            )

    if search_query:
        stmt = stmt.filter(
            (Feed.title.ilike(f"%{search_query}%"))
            | (FeedSubscription.custom_title.ilike(f"%{search_query}%"))
        )

    # Order by custom title if set, otherwise by feed title
    stmt = (
        stmt.order_by(
            FeedSubscription.custom_title.asc().nulls_last(), Feed.title.asc()
        )
        .offset(skip)
        .limit(limit)
    )

    result = await db.execute(stmt)
    return result.scalars().all()


async def create_subscription(
    db: AsyncSession,
    *,
    subscription_in: SubscriptionCreate,
    user_id: UUID,
    feed_data: dict | None = None,
) -> FeedSubscription:
    """Create a new feed subscription for a user."""
    # Validate folder exists
    folder = await crud_folder.get_folder(
        db, folder_id=subscription_in.folder_id, user_id=user_id
    )
    if not folder:
        raise ValueError(
            f"Folder with id {subscription_in.folder_id} not found for this user."
        )

    # Check if subscription already exists
    existing_subscription = await get_subscription_by_feed_url(
        db, url=str(subscription_in.url), user_id=user_id
    )
    if existing_subscription:
        raise IntegrityError(
            f"Subscription to feed '{subscription_in.url}' already exists for this user.",
            params=None,
            orig=None,
        )

    # Get or create global feed
    feed_db = await crud_feed.get_feed_by_url(db, url=str(subscription_in.url))
    if not feed_db:
        if not feed_data:
            raise ValueError("Feed data required to create new feed.")

        from app.schemas.rss_schemas import FeedBase

        feed_base = FeedBase(**feed_data)
        feed_db = await crud_feed.create_feed(db, feed_data=feed_base)
    else:
        # Increment subscriber count
        await crud_feed.update_subscriber_count(db, feed_id=feed_db.id, delta=1)

    # Create subscription
    subscription_data = {
        "user_id": user_id,
        "feed_id": feed_db.id,
        "folder_id": subscription_in.folder_id,
        "is_favorite": subscription_in.is_favorite or False,
        "custom_title": subscription_in.custom_title,
    }

    db_subscription = FeedSubscription(**subscription_data)

    # Handle tags if provided
    if subscription_in.tag_ids:
        # Tags are associated with the global feed, not the subscription
        # We need to update the feed's tags if they don't exist
        for tag_id in subscription_in.tag_ids:
            tag = await crud_tag.get_tag(db, tag_id=tag_id, user_id=user_id)
            if tag:
                # Check if tag is already associated with the feed
                if tag not in feed_db.tags:
                    feed_db.tags.append(tag)
            else:
                raise ValueError(f"Tag with id {tag_id} not found for this user.")

        db.add(feed_db)  # Add updated feed with new tags

    db.add(db_subscription)
    await db.commit()
    await db.refresh(db_subscription)

    # Reload with relationships
    return await get_subscription_by_id(
        db, subscription_id=db_subscription.id, user_id=user_id
    )


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
    if (
        "folder_id" in update_data
        and update_data["folder_id"] != subscription_db.folder_id
    ):
        new_folder_id = update_data["folder_id"]
        new_folder = await crud_folder.get_folder(
            db, folder_id=new_folder_id, user_id=user_id
        )
        if not new_folder:
            raise ValueError(f"Folder with id {new_folder_id} not found for this user.")
        subscription_db.folder_id = new_folder.id

    # Handle tag updates (these affect the global feed)
    if "tag_ids" in update_data:
        feed_db = subscription_db.feed
        feed_db.tags.clear()
        if update_data["tag_ids"]:
            for tag_id in update_data["tag_ids"]:
                tag = await crud_tag.get_tag(db, tag_id=tag_id, user_id=user_id)
                if tag:
                    feed_db.tags.append(tag)
                else:
                    raise ValueError(f"Tag with id {tag_id} not found for this user.")
        db.add(feed_db)

    # Update subscription-specific fields
    for field in ["is_favorite", "custom_title", "is_paused"]:
        if field in update_data:
            setattr(subscription_db, field, update_data[field])

    db.add(subscription_db)
    await db.commit()
    await db.refresh(subscription_db)

    return subscription_db


async def delete_subscription(
    db: AsyncSession, *, subscription_id: UUID, user_id: UUID
) -> FeedSubscription | None:
    """Delete a subscription and decrement the feed's subscriber count."""
    subscription = await get_subscription_by_id(
        db, subscription_id=subscription_id, user_id=user_id
    )
    if not subscription:
        return None

    feed_id = subscription.feed_id

    # Delete the subscription
    await db.delete(subscription)

    # Decrement subscriber count
    await crud_feed.update_subscriber_count(db, feed_id=feed_id, delta=-1)

    await db.commit()
    return subscription


async def get_subscription_by_feed_id(
    db: AsyncSession, *, feed_id: UUID, user_id: UUID
) -> FeedSubscription | None:
    """Get a user's subscription to a feed by the feed's ID."""
    result = await db.execute(
        select(FeedSubscription)
        .options(
            selectinload(FeedSubscription.feed).selectinload(Feed.tags),
            selectinload(FeedSubscription.folder),
        )
        .filter(
            FeedSubscription.feed_id == feed_id, FeedSubscription.user_id == user_id
        )
    )
    return result.scalars().first()


async def get_all_subscriptions_for_user(
    db: AsyncSession, *, user_id: UUID
) -> list[FeedSubscription]:
    """Get all subscriptions for a user (for OPML export, etc.)."""
    stmt = (
        select(FeedSubscription)
        .options(
            selectinload(FeedSubscription.feed), selectinload(FeedSubscription.folder)
        )
        .filter(FeedSubscription.user_id == user_id)
        .order_by(FeedSubscription.subscribed_at.asc())
    )

    result = await db.execute(stmt)
    return result.scalars().all()
