"""URL handling and normalization for feeds."""

from urllib.parse import urlparse, urlunparse

import structlog
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.feed import Feed
from app.utils.url.url_validator import validate_feed_url

logger = structlog.get_logger(__name__)


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
    from app.services.feeds.feed_cache_service import FeedCacheService

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

    # Use service layer for caching and search syncing
    feed_service = FeedCacheService(db)
    
    # First try to find feed by resolved URL (includes protocol variations and caching)
    feed = await feed_service.get_feed_by_url(resolved_url)
    if feed:
        return feed

    # If not found and URLs differ (redirect happened), check if old URL exists
    if original_url != resolved_url:
        old_feed = await feed_service.get_feed_by_url(original_url)
        if old_feed:
            logger.info(
                "Feed URL has changed (redirect detected), updating existing feed",
                old_url=original_url,
                new_url=resolved_url,
                feed_id=old_feed.id,
            )
            try:
                # Update feed URL with cache invalidation and search syncing
                updated_feed = await feed_service.update_feed_url(old_feed, resolved_url)
                return updated_feed
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
