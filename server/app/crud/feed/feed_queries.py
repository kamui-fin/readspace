"""Basic CRUD queries for feeds."""

from urllib.parse import urlparse, urlunparse
from uuid import UUID

import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.core.redis_cache import get_redis_cache
from app.models import Feed, FeedSubscription
from app.schemas import FeedBase
from app.utils.url_validator import validate_feed_url

logger = structlog.get_logger(__name__)

# Cache TTL for feed URL lookups (1 hour)
FEED_URL_CACHE_TTL = 3600


def normalize_feed_url(url: str) -> str:
    """Normalize feed URL to canonical form to prevent duplicate feeds.

    This function ensures consistent URL storage by:
    - Always using https for http/https URLs
    - Converting domain to lowercase
    - Removing trailing slashes from path

    Args:
        url: The feed URL to normalize

    Returns:
        The normalized URL string
    """
    try:
        parsed = urlparse(url)
        # Always use https if it's an http/https URL
        scheme = "https" if parsed.scheme in ("http", "https") else parsed.scheme
        # Lowercase domain for consistency
        netloc = parsed.netloc.lower()
        # Remove trailing slashes from path
        path = parsed.path.rstrip("/") if parsed.path else ""

        return urlunparse((scheme, netloc, path, parsed.params, parsed.query, parsed.fragment))
    except Exception:
        # If parsing fails, return the original URL
        return url


async def get_feed_by_id(db: AsyncSession, *, feed_id: UUID) -> Feed | None:
    """Get a feed by ID from the global feeds table."""
    result = await db.execute(select(Feed).filter(Feed.id == feed_id))
    return result.scalars().first()


async def get_feed_by_url(db: AsyncSession, *, url: str) -> Feed | None:
    """Get a feed by URL from the global feeds table.

    URLs are normalized before lookup to ensure consistent matching
    regardless of protocol (http vs https) or trailing slashes.

    Uses Redis cache to store normalized URL → feed_id mapping to reduce
    database queries for frequently accessed feeds.
    """
    normalized_url = normalize_feed_url(url)
    cache_key = f"feed_url:{normalized_url}"

    # Try to get feed_id from cache first
    redis_cache = get_redis_cache()
    cached_feed_id = await redis_cache.get(cache_key)

    if cached_feed_id:
        logger.debug("Feed URL lookup cache hit", normalized_url=normalized_url, feed_id=cached_feed_id)
        # Get feed by cached ID
        return await get_feed_by_id(db, feed_id=UUID(cached_feed_id))

    # Cache miss - query database
    logger.debug("Feed URL lookup cache miss", normalized_url=normalized_url)
    result = await db.execute(select(Feed).filter(Feed.url == normalized_url))
    feed = result.scalars().first()

    # Cache the feed_id for future lookups
    if feed:
        await redis_cache.set(cache_key, str(feed.id), FEED_URL_CACHE_TTL)
        logger.debug("Cached feed URL mapping", normalized_url=normalized_url, feed_id=feed.id)

    return feed


async def get_or_migrate_feed(db: AsyncSession, *, original_url: str, resolved_url: str) -> Feed | None:
    """Get a feed by URL, handling URL migrations (redirects).

    This function handles the case where a feed has moved to a new URL via redirects.
    If the resolved URL doesn't exist but the original URL does, it updates the
    old feed's URL to the new one.

    Args:
        db: Database session
        original_url: The URL that was requested (before redirect resolution)
        resolved_url: The URL after following redirects

    Returns:
        Feed object if found or migrated, None if not found

    Raises:
        ValueError: If the resolved URL fails security validation
    """
    # SECURITY: Validate resolved URL against allowed schemes and domains
    # This prevents redirects to malicious sites (file://, localhost, private IPs, etc.)
    is_valid, error_message = validate_feed_url(resolved_url, allow_rsshub=True)
    if not is_valid:
        logger.warning(
            "Resolved URL failed security validation",
            original_url=original_url,
            resolved_url=resolved_url,
            error=error_message,
        )
        raise ValueError(f"Invalid resolved URL: {error_message}")

    # First try to find feed by resolved URL (may include protocol variations)
    feed = await get_feed_by_url(db, url=resolved_url)
    if feed:
        return feed

    # If not found and URLs differ (redirect happened), check if old URL exists
    if original_url != resolved_url:
        old_feed = await get_feed_by_url(db, url=original_url)
        if old_feed:
            logger.info(
                "Feed URL has changed (redirect detected), updating existing feed",
                old_url=original_url,
                new_url=resolved_url,
                feed_id=old_feed.id,
            )
            try:
                # Update the old feed's URL to the new resolved URL
                old_feed.url = resolved_url
                db.add(old_feed)
                await db.flush()
                await db.refresh(old_feed)

                # Invalidate old cache entry and cache new URL mapping
                redis_cache = get_redis_cache()
                old_cache_key = f"feed_url:{normalize_feed_url(original_url)}"
                new_cache_key = f"feed_url:{normalize_feed_url(resolved_url)}"
                await redis_cache.delete(old_cache_key)
                await redis_cache.set(new_cache_key, str(old_feed.id), FEED_URL_CACHE_TTL)

                return old_feed
            except Exception as e:
                logger.error(
                    "Failed to update feed URL during migration",
                    old_url=original_url,
                    new_url=resolved_url,
                    feed_id=old_feed.id,
                    error=str(e),
                    exc_info=True,
                )
                raise

    return None


async def create_feed(db: AsyncSession, *, feed_data: FeedBase) -> Feed:
    """Create a new global feed or get existing one by URL."""
    # Check if feed already exists
    existing_feed = await get_feed_by_url(db, url=str(feed_data.url))
    if existing_feed:
        # Update subscriber count and return existing feed
        db.add(existing_feed)
        await db.flush()
        await db.refresh(existing_feed)
        return existing_feed

    # Create new feed
    feed_dict = feed_data.model_dump(exclude_unset=True)
    # Ensure URL fields are strings and normalize feed URL
    for key in ["url", "link", "image_url"]:
        if key in feed_dict and feed_dict[key] is not None:
            feed_dict[key] = str(feed_dict[key])

    # Normalize the feed URL to prevent duplicates
    if "url" in feed_dict:
        feed_dict["url"] = normalize_feed_url(feed_dict["url"])

    db_feed = Feed(**feed_dict)

    db.add(db_feed)
    await db.flush()
    await db.refresh(db_feed)
    return db_feed


async def get_feeds_by_user(
    db: AsyncSession,
    *,
    user_id: UUID,
    folder_id: UUID | None = None,
    tag_names: list[str] | None = None,
    is_favorite: bool | None = None,
    skip: int = 0,
    limit: int | None = None,
) -> list[tuple[Feed, FeedSubscription]]:
    """Get feeds for a specific user with extensive filtering.

    Args:
        db: Database session
        user_id: User ID to filter feeds for
        folder_id: Optional folder ID to filter by
        tag_names: Optional list of tag names to filter by
        is_favorite: Optional boolean to filter favorites
        skip: Number of items to skip for pagination
        limit: Optional maximum number of items to return. If None, returns all feeds.

    Returns:
        List of tuples containing (Feed, FeedSubscription) pairs
    """

    # Use joinedload for folder to load it in the main query (single query)
    # This is more efficient than selectinload which issues a separate query per subscription
    stmt = (
        select(Feed, FeedSubscription)
        .join(FeedSubscription, Feed.id == FeedSubscription.feed_id)
        .filter(FeedSubscription.user_id == user_id)
        .options(joinedload(FeedSubscription.folder))  # Load folder in the same query
    )

    if folder_id:
        stmt = stmt.filter(FeedSubscription.folder_id == folder_id)

    if is_favorite is not None:
        stmt = stmt.filter(FeedSubscription.is_favorite == is_favorite)

    # Tag filtering removed - feeds now use tags as ARRAY field
    # tag filtering would need to be adapted for ARRAY contains operations

    stmt = stmt.order_by(Feed.title).offset(skip)

    # Only apply limit if provided
    if limit is not None:
        stmt = stmt.limit(limit)

    result = await db.execute(stmt)
    rows = result.unique().all()
    return [(row[0], row[1]) for row in rows]
