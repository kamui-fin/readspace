"""CRUD operations for feed subscriptions."""

from datetime import datetime
from uuid import UUID

from sqlalchemy import and_, delete, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.crud import folder as crud_folder
from app.crud.feed import feed as crud_feed
from app.models import ArticleContent, Feed, FeedArticle, FeedSubscription
from app.schemas.subscriptions import SubscriptionCreate, SubscriptionUpdate
from app.utils.url_normalizer import get_protocol_variation, resolve_feed_url

# Define minimal feed columns for subscription responses to prevent over-fetching
# Excludes only heavy fields: embedding (~3KB)
# Includes all other fields needed by FeedResponse schema
SUBSCRIPTION_FEED_COLUMNS = [
    Feed.id,
    Feed.url,
    Feed.title,
    Feed.description,
    Feed.link,
    Feed.language,
    Feed.image_url,
    Feed.tags,
    Feed.top_level_category,
    Feed.popularity_score,
    Feed.ttl,
    Feed.skip_hours,
    Feed.skip_days,
    Feed.last_fetched_at,
    Feed.last_modified_header,
    Feed.etag_header,
    Feed.last_article_published_at,
    Feed.created_at,
    Feed.updated_at,
]


async def get_initial_cutoff_timestamp(
    db: AsyncSession, *, feed_id: UUID, initial_unread_count: int = 10
) -> datetime | None:
    """Get the cutoff timestamp for initial subscription to limit unread articles.

    Returns the published_at timestamp of the (N+1)th most recent article.
    Articles with published_at > cutoff will be shown as unread.

    This approach handles feeds where multiple articles share timestamps by using
    strict greater-than (>) comparison and setting cutoff to the (N+1)th article.

    Args:
        db: Database session
        feed_id: ID of the feed to get cutoff for
        initial_unread_count: Number of recent articles to show as unread (default: 10)

    Returns:
        Datetime of the (N+1)th most recent article's published_at, or None if feed has <= N articles
    """
    # Query for the (N+1)th most recent article to get its timestamp
    # Using > for comparison, so articles 1-N will have published_at > cutoff
    # Example: For initial_unread_count=10, OFFSET 10 gets the 11th item
    # Articles 1-10 will have published_at > cutoff (11th article's timestamp)
    #
    # Note: For feeds where many articles share the same timestamp,
    # this may result in fewer than N unread articles if the Nth and (N+1)th
    # articles have the same timestamp. This is acceptable to avoid showing
    # too many unread articles (e.g., 16 instead of 10).
    result = await db.execute(
        select(ArticleContent.published_at)
        .join(FeedArticle, FeedArticle.content_id == ArticleContent.id)
        .where(FeedArticle.feed_id == feed_id)
        .where(ArticleContent.published_at.is_not(None))
        .order_by(ArticleContent.published_at.desc())
        .offset(initial_unread_count)  # Get the (N+1)th article (0-indexed)
        .limit(1)
    )
    cutoff_timestamp = result.scalar_one_or_none()
    return cutoff_timestamp


async def get_subscription_by_id(db: AsyncSession, *, subscription_id: UUID, user_id: UUID) -> FeedSubscription | None:
    """Get a subscription by ID for a specific user.

    Uses load_only to fetch minimal feed fields, excluding heavy columns like
    embedding (~3KB) and description to reduce payload size.
    """
    result = await db.execute(
        select(FeedSubscription)
        .options(
            joinedload(FeedSubscription.feed).load_only(*SUBSCRIPTION_FEED_COLUMNS),
            joinedload(FeedSubscription.folder),
        )
        .filter(FeedSubscription.id == subscription_id, FeedSubscription.user_id == user_id)
    )
    return result.scalars().first()


async def get_subscription_by_feed_url(db: AsyncSession, *, url: str, user_id: UUID) -> FeedSubscription | None:
    """Get a user's subscription to a feed by the feed's URL.

    Checks both the exact URL and protocol variations (http vs https) to handle
    feeds that may have been stored with different protocols before normalization.

    Uses load_only to fetch minimal feed fields, excluding heavy columns like
    embedding (~3KB) and description to reduce payload size.
    """
    # Try exact match first
    result = await db.execute(
        select(FeedSubscription)
        .options(
            joinedload(FeedSubscription.feed).load_only(*SUBSCRIPTION_FEED_COLUMNS),
            joinedload(FeedSubscription.folder),
        )
        .join(Feed)
        .filter(Feed.url == url, FeedSubscription.user_id == user_id)
    )
    subscription = result.scalars().first()
    if subscription:
        return subscription

    # If not found, try protocol variation (http <-> https)
    alt_url = get_protocol_variation(url)
    if alt_url:
        result = await db.execute(
            select(FeedSubscription)
            .options(
                joinedload(FeedSubscription.feed).load_only(*SUBSCRIPTION_FEED_COLUMNS),
                joinedload(FeedSubscription.folder),
            )
            .join(Feed)
            .filter(Feed.url == alt_url, FeedSubscription.user_id == user_id)
        )
        subscription = result.scalars().first()
        if subscription:
            return subscription

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
    """Get subscriptions for a user with filtering options.

    Uses load_only to fetch minimal feed fields, excluding heavy columns like
    embedding (~3KB) and description to reduce payload size.
    """
    stmt = (
        select(FeedSubscription)
        .options(
            joinedload(FeedSubscription.feed).load_only(*SUBSCRIPTION_FEED_COLUMNS),
            joinedload(FeedSubscription.folder),
        )
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
    feed_db: Feed | None = None,
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

    # Use provided feed_db if available, otherwise get or create global feed
    if feed_db is None:
        # Get or create global feed using resolved URL (handles URL normalization and redirects)
        feed_db = await crud_feed.get_or_migrate_feed(db, original_url=original_url, resolved_url=resolved_url)
        if not feed_db:
            if not feed_data:
                raise ValueError("Feed data required to create new feed.")

            from app.schemas import FeedBase

            # Update feed_data URL to use resolved URL
            feed_data["url"] = resolved_url
            feed_base = FeedBase(**feed_data)
            feed_db = await crud_feed.create_feed(db, feed_data=feed_base)
    # Feed exists, subscriber_count will be incremented automatically by database trigger

    # Get initial cutoff timestamp to limit unread articles
    # This ensures new subscriptions only show the N most recent articles as unread
    from app.core.constants import INITIAL_UNREAD_COUNT

    initial_cutoff = await get_initial_cutoff_timestamp(
        db, feed_id=feed_db.id, initial_unread_count=INITIAL_UNREAD_COUNT
    )

    # Create subscription
    subscription_data = {
        "user_id": user_id,
        "feed_id": feed_db.id,
        "folder_id": subscription_in.folder_id,
        "is_favorite": subscription_in.is_favorite or False,
        "custom_title": subscription_in.custom_title,
        "last_read_cutoff": initial_cutoff,
    }

    db_subscription = FeedSubscription(**subscription_data)

    # Tags are now handled as ARRAY field on feeds - no longer using tag_ids

    db.add(db_subscription)
    await db.flush()

    # Fetch with relationships in a single query using eager loading
    # This is more efficient than refresh + separate fetch
    stmt = (
        select(FeedSubscription)
        .options(
            joinedload(FeedSubscription.feed).load_only(*SUBSCRIPTION_FEED_COLUMNS),
            joinedload(FeedSubscription.folder),
        )
        .where(FeedSubscription.id == db_subscription.id)
    )
    result = await db.execute(stmt)
    reloaded_subscription = result.scalar_one_or_none()
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
    for field in ["is_favorite", "custom_title", "is_paused", "last_read_cutoff"]:
        if field in update_data:
            setattr(subscription_db, field, update_data[field])

    db.add(subscription_db)
    await db.flush()
    await db.refresh(subscription_db)

    return subscription_db


async def delete_subscription(db: AsyncSession, *, subscription_id: UUID, user_id: UUID) -> FeedSubscription | None:
    """Delete a subscription and decrement the feed's subscriber count."""
    subscription = await get_subscription_by_id(db, subscription_id=subscription_id, user_id=user_id)
    if not subscription:
        return None

    # Delete the subscription
    await db.delete(subscription)

    return subscription


async def get_subscription_by_feed_id(db: AsyncSession, *, feed_id: UUID, user_id: UUID) -> FeedSubscription | None:
    """Get a user's subscription to a feed by the feed's ID.

    Uses load_only to fetch minimal feed fields, excluding heavy columns like
    embedding (~3KB) and description to reduce payload size.
    """
    result = await db.execute(
        select(FeedSubscription)
        .options(
            joinedload(FeedSubscription.feed).load_only(*SUBSCRIPTION_FEED_COLUMNS),
            joinedload(FeedSubscription.folder),
        )
        .filter(FeedSubscription.feed_id == feed_id, FeedSubscription.user_id == user_id)
    )
    return result.scalars().first()


async def get_all_subscriptions_for_user(db: AsyncSession, *, user_id: UUID) -> list[FeedSubscription]:
    """Get all subscriptions for a user (for OPML export, etc.).

    Uses load_only to fetch minimal feed fields, excluding heavy columns like
    embedding (~3KB) and description to reduce payload size.
    """
    stmt = (
        select(FeedSubscription)
        .options(
            joinedload(FeedSubscription.feed).load_only(*SUBSCRIPTION_FEED_COLUMNS),
            joinedload(FeedSubscription.folder),
        )
        .filter(FeedSubscription.user_id == user_id)
        .order_by(FeedSubscription.created_at.asc())
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

    return {"updated_ids": updated_feed_ids}
