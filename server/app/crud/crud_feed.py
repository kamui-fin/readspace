"""CRUD operations for the new global feeds (feeds_new) table."""

from datetime import datetime, timedelta, timezone
from uuid import UUID

import structlog
from sqlalchemy import case, func, literal_column, select, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased, selectinload

from app.models.rss_models import Feed, FeedSubscription, Tag
from app.schemas.rss_schemas import FeedBase

# Constants for refresh logic (in minutes)
MIN_REFRESH_INTERVAL_MINUTES = 1
DEFAULT_REFRESH_INTERVAL_MINUTES = 35
MAX_REFRESH_INTERVAL_MINUTES = 24 * 60  # 1 day
ERROR_BACKOFF_BASE_MINUTES = 35
MAX_ERROR_BACKOFF_MINUTES = 12 * 60

logger = structlog.get_logger(__name__)


async def get_feed_by_id(db: AsyncSession, *, feed_id: UUID) -> Feed | None:
    """Get a feed by ID from the global feeds table."""
    result = await db.execute(select(Feed).filter(Feed.id == feed_id))
    return result.scalars().first()


async def get_feed_by_url(db: AsyncSession, *, url: str) -> Feed | None:
    """Get a feed by URL from the global feeds table."""
    result = await db.execute(select(Feed).filter(Feed.url == url))
    return result.scalars().first()


async def create_feed(db: AsyncSession, *, feed_data: FeedBase) -> Feed:
    """Create a new global feed or get existing one by URL."""
    # Check if feed already exists
    existing_feed = await get_feed_by_url(db, url=str(feed_data.url))
    if existing_feed:
        # Update subscriber count and return existing feed
        # Note: subscriber_count column removed from model
        db.add(existing_feed)
        await db.commit()
        await db.refresh(existing_feed)
        return existing_feed

    # Create new feed
    feed_dict = feed_data.model_dump(exclude_unset=True)
    # Ensure URL fields are strings
    for key in ["url", "link", "image_url"]:
        if key in feed_dict and feed_dict[key] is not None:
            feed_dict[key] = str(feed_dict[key])

    # Note: subscriber_count column removed from model
    db_feed = Feed(**feed_dict)

    db.add(db_feed)
    await db.commit()
    await db.refresh(db_feed)
    return db_feed


async def update_feed_metadata(
    db: AsyncSession,
    *,
    feed_db: Feed,
    title: str | None = None,
    description: str | None = None,
    link: str | None = None,
    language: str | None = None,
    image_url: str | None = None,
    ttl: int | None = None,
    skip_hours: list[int] | None = None,
    skip_days: list[str] | None = None,
    last_modified: str | None = None,
    etag: str | None = None,
    last_fetched_at: datetime | None = None,
    last_article_published_at: datetime | None = None,
) -> Feed:
    """Update feed metadata after successful fetch."""
    if title is not None:
        feed_db.title = title
    if description is not None:
        feed_db.description = description
    if link is not None:
        feed_db.link = str(link)
    if language is not None:
        feed_db.language = language
    if image_url is not None:
        feed_db.image_url = str(image_url)

    if ttl is not None:
        try:
            feed_db.ttl = int(ttl) if ttl is not None else None
        except (ValueError, TypeError):
            logger.warning("Invalid TTL value", ttl=ttl, feed_id=feed_db.id)
            feed_db.ttl = None

    if skip_hours is not None:
        try:
            validated_hours = []
            for hour in skip_hours:
                hour_int = int(hour)
                if 0 <= hour_int <= 23:
                    validated_hours.append(hour_int)
            feed_db.skip_hours = validated_hours
        except (ValueError, TypeError):
            logger.warning(
                "Invalid skip_hours", skip_hours=skip_hours, feed_id=feed_db.id
            )
            feed_db.skip_hours = []

    if skip_days is not None:
        try:
            feed_db.skip_days = [str(day) for day in skip_days]
        except (ValueError, TypeError):
            logger.warning("Invalid skip_days", skip_days=skip_days, feed_id=feed_db.id)
            feed_db.skip_days = []

    if last_modified is not None:
        feed_db.last_modified_header = last_modified
    if etag is not None:
        feed_db.etag_header = etag
    if last_fetched_at is not None:
        feed_db.last_fetched_at = last_fetched_at
    if last_article_published_at is not None:
        feed_db.last_article_published_at = last_article_published_at

    # Reset error state on successful fetch
    # Note: Error tracking columns removed from model
    db.add(feed_db)
    await db.commit()
    await db.refresh(feed_db)
    return feed_db



async def get_feeds_needing_refresh(
    db: AsyncSession, *, limit: int = 100
) -> list[Feed]:
    """Get global feeds that need refreshing, prioritized by subscriber count."""
    logger.info("get_feeds_needing_refresh called (new version)", limit=limit)
    now = datetime.now(timezone.utc)
    current_utc_hour = now.hour
    current_utc_weekday = now.weekday()

    # Never fetched feeds (top priority)
    never_fetched_stmt = (
        select(Feed)
        .filter(Feed.last_fetched_at.is_(None))
        .filter(
            (Feed.skip_hours.is_(None))
            | (~Feed.skip_hours.contains([current_utc_hour]))
        )
        .filter(
            (Feed.skip_days.is_(None))
            | (
                ~Feed.skip_days.contains(
                    [
                        [
                            "Monday",
                            "Tuesday",
                            "Wednesday",
                            "Thursday",
                            "Friday",
                            "Saturday",
                            "Sunday",
                        ][current_utc_weekday]
                    ]
                )
            )
        )
        .order_by(Feed.created_at.asc())
        .limit(limit)
    )

    never_fetched_result = await db.execute(never_fetched_stmt)
    feeds_needing_refresh = list(never_fetched_result.scalars().all())
    logger.info("Found never_fetched feeds", count=len(feeds_needing_refresh))

    remaining_limit = limit - len(feeds_needing_refresh)

    if remaining_limit > 0:
        min_interval_ago = now - timedelta(minutes=MIN_REFRESH_INTERVAL_MINUTES)

        # Calculate effective delay using SQL
        effective_delay = case(
            (
                Feed.ttl.is_not(None),
                func.greatest(
                    MIN_REFRESH_INTERVAL_MINUTES,
                    func.least(Feed.ttl, MAX_REFRESH_INTERVAL_MINUTES),
                ),
            ),
            else_=DEFAULT_REFRESH_INTERVAL_MINUTES,
        )

        next_fetch_time = Feed.last_fetched_at + (
            effective_delay * text("INTERVAL '1 minute'")
        )

        due_feeds_stmt = (
            select(Feed)
            .filter(Feed.last_fetched_at.is_not(None))
            .filter(Feed.last_fetched_at < min_interval_ago)
            .filter(
                (Feed.skip_hours.is_(None))
                | (~Feed.skip_hours.contains([current_utc_hour]))
            )
            .filter(
                (Feed.skip_days.is_(None))
                | (
                    ~Feed.skip_days.contains(
                        [
                            [
                                "Monday",
                                "Tuesday",
                                "Wednesday",
                                "Thursday",
                                "Friday",
                                "Saturday",
                                "Sunday",
                            ][current_utc_weekday]
                        ]
                    )
                )
            )
            .filter(literal_column("NOW()") >= next_fetch_time)
            .order_by(
                # Note: columns removed from model - using creation time as fallback
                Feed.last_fetched_at.asc()
            )
            .limit(remaining_limit)
        )

        due_result = await db.execute(due_feeds_stmt)
        due_feeds = list(due_result.scalars().all())

        logger.info("Found due feeds", count=len(due_feeds))
        feeds_needing_refresh.extend(due_feeds)

    logger.info(
        "get_feeds_needing_refresh returning", total_count=len(feeds_needing_refresh)
    )
    return feeds_needing_refresh[:limit]


async def get_feeds_by_user(
    db: AsyncSession,
    *,
    user_id: UUID,
    folder_id: UUID | None = None,
    tag_names: list[str] | None = None,
    is_favorite: bool | None = None,
    search_query: str | None = None,
    skip: int = 0,
    limit: int = 100,
) -> list[tuple[Feed, FeedSubscription]]:
    """Get feeds for a specific user with extensive filtering."""
    stmt = (
        select(Feed, FeedSubscription)
        .join(FeedSubscription, Feed.id == FeedSubscription.feed_id)
        .filter(FeedSubscription.user_id == user_id)
        # Removed selectinload(Feed.tags) to prevent N+1 - tags not used in feed list
    )

    if folder_id:
        stmt = stmt.filter(FeedSubscription.folder_id == folder_id)

    if is_favorite is not None:
        stmt = stmt.filter(FeedSubscription.is_favorite == is_favorite)

    if tag_names:
        for i, tag_name in enumerate(tag_names):
            tag_alias = aliased(Tag, name=f"tag_{i}")
            stmt = stmt.join(tag_alias, Feed.tags).filter(
                tag_alias.name.ilike(f"%{tag_name}%")
            )

    if search_query:
        stmt = stmt.filter(Feed.title.ilike(f"%{search_query}%"))

    stmt = stmt.order_by(Feed.title).offset(skip).limit(limit)

    result = await db.execute(stmt)
    return result.unique().all()
