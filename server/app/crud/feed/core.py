"""
Global Feed CRUD and Management.

Handles:
1. Basic CRUD (Get/Create)
2. URL Normalization
3. Worker Scheduling (calculating next_fetch_at)
4. Metadata/Enrichment Updates
"""

from datetime import datetime, timedelta, timezone
from typing import Any
from urllib.parse import urlparse, urlunparse
from uuid import UUID

import structlog
from sqlalchemy import desc, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.article import FeedArticle
from app.models.feed import Feed, FeedCategory
from app.typing.feeds import FeedBase

logger = structlog.get_logger(__name__)

# Constants for Scheduling
MIN_REFRESH_MINUTES = 15
MAX_REFRESH_MINUTES = 1440  # 24 hours
MAX_BACKOFF_MINUTES = 720  # 12 hours

# ==========================================
# Pure Python Helpers (Logic)
# ==========================================


def normalize_url(url: str) -> str:
    """Canonicalize URL to prevent duplicates (functional version)."""
    try:
        parsed = urlparse(url)
        scheme = "https" if parsed.scheme in ("http", "https") else parsed.scheme
        netloc = parsed.netloc.lower()
        path = parsed.path.rstrip("/") if parsed.path else ""
        return urlunparse((scheme, netloc, path, parsed.params, parsed.query, parsed.fragment))
    except Exception:
        return url


def calculate_next_fetch(feed: Feed, ttl: int | None = None) -> datetime:
    """
    Determines the next fetch time based on errors, adaptive history, and server hints.
    Uses HTTP conditional GET (ETag/Last-Modified) for bandwidth efficiency.
    Respects Cache-Control max-age and Expires headers from HTTP responses.
    """
    import random

    now = datetime.now(timezone.utc)

    # 1. Exponential Backoff for Errors (with jitter to prevent thundering herd)
    if feed.fetch_error_count > 0:
        # 2^error_count * 60 minutes, capped at 12 hours
        base_backoff = min(pow(2, feed.fetch_error_count) * 60, MAX_BACKOFF_MINUTES)
        # Add ±25% jitter
        jitter = random.uniform(0.75, 1.25)  # noqa: S311
        backoff = int(base_backoff * jitter)
        return now + timedelta(minutes=backoff)

    # 2. Determine base interval
    # Priority: adaptive_fetch_interval > ttl (from Cache-Control/Expires) > default
    if feed.adaptive_fetch_interval_minutes:
        interval = feed.adaptive_fetch_interval_minutes
    elif ttl:
        interval = ttl
    else:
        interval = MIN_REFRESH_MINUTES

    # Enforce bounds
    interval = max(MIN_REFRESH_MINUTES, min(interval, MAX_REFRESH_MINUTES))

    return now + timedelta(minutes=interval)


# ==========================================
# Database Operations (Async)
# ==========================================


async def get_feed_by_url(db: AsyncSession, *, url: str) -> Feed | None:
    """Get feed by normalized URL."""
    normalized = normalize_url(url)
    result = await db.execute(select(Feed).filter(Feed.url == normalized))
    return result.scalars().first()


async def get_feed_by_id(db: AsyncSession, *, feed_id: UUID) -> Feed | None:
    result = await db.execute(select(Feed).filter(Feed.id == feed_id))
    return result.scalars().first()


async def create_feed(db: AsyncSession, *, feed_data: FeedBase) -> Feed:
    """Create a new global feed."""
    normalized = normalize_url(str(feed_data.url))

    # Check existence to avoid IntegrityError if caller didn't check
    existing = await get_feed_by_url(db, url=normalized)
    if existing:
        return existing

    feed_dict = feed_data.model_dump(exclude_unset=True)
    feed_dict["url"] = normalized

    # Initialize scheduling
    now = datetime.now(timezone.utc)
    db_feed = Feed(**feed_dict)
    db_feed.last_fetched_at = None
    db_feed.next_fetch_at = now  # Fetch immediately

    db.add(db_feed)
    await db.flush()
    await db.refresh(db_feed)
    return db_feed


async def get_recent_article_publication_times(db: AsyncSession, *, feed_id: UUID, limit: int = 30) -> list[datetime]:
    """
    Get recent article publication times for a feed.

    Args:
        db: Database session
        feed_id: Feed ID to query
        limit: Maximum number of articles to return (default: 30)

    Returns:
        List of publication datetimes, ordered by most recent first
    """
    stmt = (
        select(FeedArticle.published_at)
        .where(FeedArticle.feed_id == feed_id)
        .where(FeedArticle.published_at.is_not(None))
        .order_by(desc(FeedArticle.published_at))
        .limit(limit)
    )

    result = await db.execute(stmt)
    return [row[0] for row in result.all()]


async def get_feeds_for_worker(db: AsyncSession, *, limit: int = 100) -> list[Feed]:
    """
    Get feeds due for update.

    Optimized: Uses a simple index scan on `next_fetch_at` instead of
    calculating logic at read-time.
    """
    now = datetime.now(timezone.utc)

    stmt = (
        select(Feed)
        .where(Feed.next_fetch_at <= now)
        .where(Feed.subscriber_count > 0)  # Don't refresh ghost feeds
        .order_by(Feed.subscriber_count.desc())  # Prioritize popular feeds
        .limit(limit)
        .with_for_update(skip_locked=True)  # Concurrency safety
    )

    result = await db.execute(stmt)
    return list(result.scalars().all())


async def update_feed_after_fetch(
    db: AsyncSession,
    *,
    feed: Feed,
    success: bool,
    metadata: dict | None = None,
    error_msg: str | None = None,
    ttl: int | None = None,
) -> Feed:
    """
    Unified handler for post-fetch state updates.
    Updates metadata AND recalculates the next schedule.
    """
    if success:
        feed.fetch_error_count = 0
        feed.last_error_message = None
        feed.last_fetched_at = datetime.now(timezone.utc)

        if metadata:
            # Update standard fields
            for key in ["title", "description", "link", "language", "image_url"]:
                if val := metadata.get(key):
                    setattr(feed, key, str(val))

            # Update HTTP caching headers
            if "etag" in metadata:
                feed.etag_header = metadata["etag"]
            if "last_modified" in metadata:
                feed.last_modified_header = metadata["last_modified"]

    else:
        feed.fetch_error_count += 1
        feed.last_error_message = error_msg or "Unknown error"

    # CRITICAL: Calculate next fetch time immediately and save it
    # This keeps the "get_feeds_for_worker" query fast
    feed.next_fetch_at = calculate_next_fetch(feed, ttl=ttl)

    db.add(feed)
    # Note: Commit is left to the caller/worker
    return feed


async def update_feed(db: AsyncSession, *, feed: Feed, update_data: dict) -> Feed:
    """Update feed with provided data dictionary."""
    for key, value in update_data.items():
        if hasattr(feed, key):
            setattr(feed, key, value)

    db.add(feed)
    await db.flush()
    await db.refresh(feed)
    return feed


async def update_enrichment_data(db: AsyncSession, *, feed: Feed, enrichment: dict) -> Feed:
    """Update AI-derived metadata (Categories, Tags)."""
    if "top_level_category" in enrichment:
        try:
            feed.top_level_category = FeedCategory(enrichment["top_level_category"]).value
        except ValueError:
            pass

    if "tags" in enrichment and isinstance(enrichment["tags"], list):
        feed.tags = enrichment["tags"]

    if "popularity_score" in enrichment:
        feed.popularity_score = float(enrichment["popularity_score"])

    db.add(feed)
    return feed


async def admin_update_feed(
    db: AsyncSession,
    *,
    feed: Feed,
    title: str | None = None,
    description: str | None = None,
    link: str | None = None,
    language: str | None = None,
    image_url: str | None = None,
    url: str | None = None,
    top_level_category: str | FeedCategory | None = None,
    popularity_score: float | None = None,
    tags: list[str] | None = None,
    author: str | None = None,
) -> Feed:
    """
    Admin-only function to update global feed properties.

    Updates feed metadata that affects all users subscribed to the feed.
    Handles all fields including category enums and URL normalization.
    """
    # Update basic metadata fields
    if title is not None:
        feed.title = title
    if description is not None:
        feed.description = description
    if link is not None:
        feed.link = link
    if language is not None:
        feed.language = language
    if image_url is not None:
        feed.image_url = image_url

    # Handle URL update with normalization
    if url is not None:
        feed.url = normalize_url(url)

    # Handle top_level_category (must be string, converted to enum)
    if top_level_category is not None:
        try:
            feed.top_level_category = FeedCategory(top_level_category).value
        except ValueError as err:
            raise ValueError(f"Invalid category: {top_level_category}") from err

    # Handle popularity_score
    if popularity_score is not None:
        feed.popularity_score = popularity_score

    # Handle tags
    if tags is not None:
        feed.tags = tags

    # Handle author
    if author is not None:
        feed.author = author

    db.add(feed)
    await db.flush()
    await db.refresh(feed)
    return feed


async def delete_feed(db: AsyncSession, *, feed_id: UUID) -> bool:
    """
    Delete a global feed (admin only).

    Database CASCADE will handle related records (articles, subscriptions).
    Returns True if feed was deleted, False if not found.
    """
    feed = await get_feed_by_id(db, feed_id=feed_id)
    if not feed:
        return False

    await db.delete(feed)
    await db.flush()
    return True


async def get_feeds_needing_enrichment(db: AsyncSession, *, limit: int) -> list[Feed]:
    """
    Query feeds that need enrichment (no tags set).

    Args:
        db: Database session
        limit: Maximum number of feeds to return

    Returns:
        List of Feed ORM objects needing enrichment
    """
    stmt = select(Feed).where(Feed.tags.is_(None)).limit(limit)
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def bulk_update_feeds_enrichment(db: AsyncSession, *, update_mappings: list[dict[str, Any]]) -> int:
    """
    Apply bulk updates to feeds for enrichment data.

    Args:
        db: Database session
        update_mappings: List of dictionaries with feed updates. Each dict must contain 'id' key.

    Returns:
        Number of feeds updated
    """
    if not update_mappings:
        return 0

    await db.execute(update(Feed), update_mappings)
    await db.flush()
    return len(update_mappings)
