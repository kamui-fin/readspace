"""URL handling and normalization for feeds."""

from urllib.parse import urlparse, urlunparse

import structlog
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings
from app.core.redis_cache import get_redis_cache
from app.models import Feed
from app.services.feeds.search.meilisearch_service import get_meilisearch_service
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
    from app.crud.feed.core import get_feed_by_url

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

                # Sync to Meilisearch after URL migration (fire-and-forget)
                try:
                    settings = Settings()
                    meili_service = get_meilisearch_service(settings)
                    await meili_service.update_feed(old_feed)
                except Exception as e:
                    logger.warning("meilisearch_sync_failed_migration", feed_id=old_feed.id, error=str(e))

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
