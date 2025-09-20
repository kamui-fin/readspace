"""CRUD operations for the new global feeds (feeds_new) table."""

from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import UUID

import structlog
from sqlalchemy import case, func, literal_column, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.rss_models import Feed, FeedCategory, FeedSubscription
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
            logger.warning("Invalid skip_hours", skip_hours=skip_hours, feed_id=feed_db.id)
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
    feed_db.fetch_error_count = 0
    feed_db.last_error_message = None

    db.add(feed_db)
    await db.commit()
    await db.refresh(feed_db)
    return feed_db


async def get_feeds_needing_refresh(db: AsyncSession, *, limit: int = 100) -> list[Feed]:
    """Get global feeds that need refreshing, prioritized by subscriber count."""
    logger.info(
        "get_feeds_needing_refresh called (filtering feeds with 0 subscribers)",
        limit=limit,
    )
    now = datetime.now(timezone.utc)
    current_utc_hour = now.hour
    current_utc_weekday = now.weekday()

    # Never fetched feeds (top priority) - only refresh feeds with subscribers
    never_fetched_stmt = (
        select(Feed)
        .filter(Feed.last_fetched_at.is_(None))
        .filter(Feed.subscriber_count > 0)
        .filter((Feed.skip_hours.is_(None)) | (~Feed.skip_hours.contains([current_utc_hour])))
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

        next_fetch_time = Feed.last_fetched_at + (effective_delay * text("INTERVAL '1 minute'"))

        due_feeds_stmt = (
            select(Feed)
            .filter(Feed.last_fetched_at.is_not(None))
            .filter(Feed.subscriber_count > 0)
            .filter(Feed.last_fetched_at < min_interval_ago)
            .filter((Feed.skip_hours.is_(None)) | (~Feed.skip_hours.contains([current_utc_hour])))
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
                # Prioritize feeds with more subscribers, then by last fetch time
                Feed.subscriber_count.desc(),
                Feed.last_fetched_at.asc(),
            )
            .limit(remaining_limit)
        )

        due_result = await db.execute(due_feeds_stmt)
        due_feeds = list(due_result.scalars().all())

        logger.info("Found due feeds", count=len(due_feeds))
        feeds_needing_refresh.extend(due_feeds)

    # Add statistics about feeds filtered out
    total_feeds_result = await db.execute(select(func.count(Feed.id)))
    total_feeds = total_feeds_result.scalar()

    zero_subscriber_feeds_result = await db.execute(select(func.count(Feed.id)).filter(Feed.subscriber_count == 0))
    zero_subscriber_feeds = zero_subscriber_feeds_result.scalar()

    logger.info(
        "get_feeds_needing_refresh returning",
        total_count=len(feeds_needing_refresh),
        total_feeds_in_db=total_feeds,
        feeds_with_zero_subscribers=zero_subscriber_feeds,
        feeds_skipped_due_to_no_subscribers=zero_subscriber_feeds,
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

    # Tag filtering removed - feeds now use tags as ARRAY field
    # tag filtering would need to be adapted for ARRAY contains operations

    if search_query:
        stmt = stmt.filter(Feed.title.ilike(f"%{search_query}%"))

    stmt = stmt.order_by(Feed.title).offset(skip).limit(limit)

    result = await db.execute(stmt)
    rows = result.unique().all()
    return [(row[0], row[1]) for row in rows]


async def update_feed_error(db: AsyncSession, *, feed_db: Feed, error_message: str) -> Feed:
    """Update feed error count and message after a failed fetch."""
    feed_db.fetch_error_count += 1
    feed_db.last_error_message = error_message
    feed_db.updated_at = datetime.now(timezone.utc)

    db.add(feed_db)
    await db.commit()
    await db.refresh(feed_db)

    logger.warning(
        "Feed error count updated",
        feed_id=feed_db.id,
        error_count=feed_db.fetch_error_count,
        error_message=error_message,
    )

    return feed_db


async def update_feed_enrichment(db: AsyncSession, feed: Feed, enrichment_data: dict[str, Any]) -> Feed:
    """Update feed with enrichment data from background processing."""
    try:
        # Update basic feed metadata
        if "title" in enrichment_data and enrichment_data["title"]:
            feed.title = enrichment_data["title"]

        if "description" in enrichment_data and enrichment_data["description"]:
            feed.description = enrichment_data["description"]

        if "link" in enrichment_data and enrichment_data["link"]:
            feed.link = enrichment_data["link"]

        if "image_url" in enrichment_data and enrichment_data["image_url"]:
            feed.image_url = enrichment_data["image_url"]

        if "language" in enrichment_data and enrichment_data["language"]:
            feed.language = enrichment_data["language"]

        # Update RSS dataset fields
        if "tags" in enrichment_data and isinstance(enrichment_data["tags"], list):
            feed.tags = enrichment_data["tags"]

        if "top_level_category" in enrichment_data:
            category_str = enrichment_data["top_level_category"]
            try:
                # Convert string to enum value for assignment
                category_enum = FeedCategory(category_str)
                feed.top_level_category = category_enum.value
            except ValueError:
                logger.warning("Invalid category", category=category_str, feed_id=feed.id)
                feed.top_level_category = FeedCategory.MISCELLANEOUS.value

        if "popularity_score" in enrichment_data:
            feed.popularity_score = float(enrichment_data["popularity_score"])

        # Update embedding if present
        if "embedding" in enrichment_data and enrichment_data["embedding"]:
            # Embedding is handled as a vector column by SQLAlchemy
            # The pgvector extension handles the conversion
            from sqlalchemy import text

            embedding_list = enrichment_data["embedding"]
            if isinstance(embedding_list, list) and len(embedding_list) == 768:
                # Update using raw SQL for vector type
                await db.execute(
                    text("UPDATE feeds SET embedding = :embedding WHERE id = :feed_id"),
                    {"embedding": str(embedding_list), "feed_id": feed.id},
                )

        # Update the feed timestamp
        feed.updated_at = datetime.now(timezone.utc)

        db.add(feed)
        await db.commit()
        await db.refresh(feed)

        logger.info(
            "Feed enrichment data updated successfully",
            feed_id=feed.id,
            updated_fields=list(enrichment_data.keys()),
        )

        return feed

    except Exception as e:
        logger.error(
            "Failed to update feed with enrichment data",
            feed_id=feed.id,
            error=str(e),
            exc_info=True,
        )
        await db.rollback()
        raise
