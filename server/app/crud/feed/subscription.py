"""CRUD operations for user feed subscriptions."""

from datetime import datetime
from uuid import UUID

from sqlalchemy import select, delete, and_, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload, load_only

from app.core.constants import INITIAL_UNREAD_COUNT
from app.crud.feed.core import get_feed_by_url, create_feed, normalize_url
from app.crud.folder import get_folder
from app.models.article import ArticleContent, FeedArticle
from app.models.feed import Feed, FeedSubscription
from app.schemas.subscriptions import SubscriptionCreate, SubscriptionUpdate

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
        select(ArticleContent.published_at)
        .join(FeedArticle, FeedArticle.content_id == ArticleContent.id)
        .where(FeedArticle.feed_id == feed_id)
        .order_by(ArticleContent.published_at.desc())
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
        # Functional call to create the global feed if it doesn't exist
        from app.schemas.feeds import FeedBase

        # We use the URL as a temp title; the worker will correct it on first fetch
        feed_base = FeedBase(url=normalized_url, title=str(subscription_in.url))
        feed = await create_feed(db, feed_data=feed_base)

    # 2. Check Duplicates
    existing = await db.execute(select(FeedSubscription).filter_by(user_id=user_id, feed_id=feed.id))
    if existing.scalar_one_or_none():
        raise IntegrityError("Already subscribed", params=None, orig=None)

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
    await db.refresh(sub)
    return sub


async def get_subscription_by_feed_id(
    db: AsyncSession, *, feed_id: UUID, user_id: UUID
) -> FeedSubscription | None:
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
