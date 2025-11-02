"""CRUD operations for feed subscriptions."""

from uuid import UUID

from sqlalchemy import and_, delete, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.crud import crud_feed, crud_folder
from app.models.rss_models import Feed, FeedSubscription
from app.schemas.subscription_schemas import SubscriptionCreate, SubscriptionUpdate
from app.utils.url_normalizer import resolve_feed_url


async def get_subscription_by_id(db: AsyncSession, *, subscription_id: UUID, user_id: UUID) -> FeedSubscription | None:
    """Get a subscription by ID for a specific user."""
    result = await db.execute(
        select(FeedSubscription)
        .options(selectinload(FeedSubscription.feed), selectinload(FeedSubscription.folder))
        .filter(FeedSubscription.id == subscription_id, FeedSubscription.user_id == user_id)
    )
    return result.scalars().first()


async def get_subscription_by_feed_url(db: AsyncSession, *, url: str, user_id: UUID) -> FeedSubscription | None:
    """Get a user's subscription to a feed by the feed's URL.

    Checks both the exact URL and protocol variations (http vs https) to handle
    legacy feeds stored with different protocols.
    """
    # Try exact match first
    result = await db.execute(
        select(FeedSubscription)
        .options(selectinload(FeedSubscription.feed), selectinload(FeedSubscription.folder))
        .join(Feed)
        .filter(Feed.url == url, FeedSubscription.user_id == user_id)
    )
    subscription = result.scalars().first()
    if subscription:
        return subscription

    # If not found, try protocol variation (http <-> https)
    from urllib.parse import urlparse, urlunparse

    try:
        parsed = urlparse(url)
        if parsed.scheme in ("http", "https"):
            # Try the opposite protocol
            alt_scheme = "https" if parsed.scheme == "http" else "http"
            alt_url = urlunparse((alt_scheme, parsed.netloc, parsed.path, parsed.params, parsed.query, parsed.fragment))

            result = await db.execute(
                select(FeedSubscription)
                .options(selectinload(FeedSubscription.feed), selectinload(FeedSubscription.folder))
                .join(Feed)
                .filter(Feed.url == alt_url, FeedSubscription.user_id == user_id)
            )
            subscription = result.scalars().first()
            if subscription:
                return subscription
    except Exception:
        pass

    return None


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
    # Handle folder_id conversion (string UUID or 'default' should be handled by service layer)
    folder_id = subscription_in.folder_id
    if isinstance(folder_id, str):
        if folder_id == "default":
            raise ValueError("'default' folder_id should be resolved by the service layer")
        # Convert string UUID to UUID object
        try:
            folder_id = UUID(folder_id)
        except ValueError as e:
            raise ValueError(f"Invalid folder_id format: {folder_id}") from e

    folder = await crud_folder.get_folder(db, folder_id=folder_id, user_id=user_id)
    if not folder:
        raise ValueError(f"Folder with id {subscription_in.folder_id} not found for this user.")

    # Resolve URL to get canonical URL by following redirects
    resolved_url = await resolve_feed_url(str(subscription_in.url))
    original_url = str(subscription_in.url)

    # Check if subscription already exists using resolved URL
    existing_subscription = await get_subscription_by_feed_url(db, url=resolved_url, user_id=user_id)
    if existing_subscription:
        raise IntegrityError(
            statement=f"Subscription to feed '{subscription_in.url}' already exists for this user.",
            params=None,
            orig=Exception("Duplicate subscription"),
        )

    # Get or create global feed using resolved URL (handles URL migrations)
    feed_db = await crud_feed.get_or_migrate_feed(db, original_url=original_url, resolved_url=resolved_url)
    if not feed_db:
        if not feed_data:
            raise ValueError("Feed data required to create new feed.")

        from app.schemas.rss_schemas import FeedBase

        # Update feed_data URL to use resolved URL
        feed_data["url"] = resolved_url
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


async def delete_subscriptions_bulk(db: AsyncSession, *, feed_ids: list[UUID], user_id: UUID) -> dict[str, list[UUID]]:
    """Delete multiple subscriptions in a single query.

    Args:
        db: Database session
        feed_ids: List of feed IDs to unsubscribe from
        user_id: User ID who owns the subscriptions

    Returns:
        Dictionary with 'deleted_ids' list of successfully deleted feed IDs
    """
    stmt = (
        delete(FeedSubscription)
        .where(and_(FeedSubscription.user_id == user_id, FeedSubscription.feed_id.in_(feed_ids)))
        .returning(FeedSubscription.feed_id)
    )

    result = await db.execute(stmt)
    deleted_feed_ids = [row[0] for row in result.fetchall()]

    await db.commit()

    return {"deleted_ids": deleted_feed_ids}


async def update_subscriptions_folder_bulk(
    db: AsyncSession, *, feed_ids: list[UUID], folder_id: UUID, user_id: UUID
) -> dict[str, list[UUID]]:
    """Update folder for multiple subscriptions in a single query.

    Args:
        db: Database session
        feed_ids: List of feed IDs to move
        folder_id: Target folder ID
        user_id: User ID who owns the subscriptions

    Returns:
        Dictionary with 'updated_ids' list of successfully updated feed IDs
    """
    stmt = (
        update(FeedSubscription)
        .where(and_(FeedSubscription.user_id == user_id, FeedSubscription.feed_id.in_(feed_ids)))
        .values(folder_id=folder_id)
        .returning(FeedSubscription.feed_id)
    )

    result = await db.execute(stmt)
    updated_feed_ids = [row[0] for row in result.fetchall()]

    await db.commit()

    return {"updated_ids": updated_feed_ids}
