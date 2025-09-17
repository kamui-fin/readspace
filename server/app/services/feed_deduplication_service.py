"""Feed deduplication service to prevent duplicate feeds."""

import urllib.parse

import feedparser  # type: ignore[import-untyped]
import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.custom_exceptions import FeedSubscriptionError
from app.models.rss_models import Feed

logger = structlog.get_logger(__name__)


class FeedDeduplicationService:
    """Service for detecting and preventing duplicate RSS feeds."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def check_for_duplicates(self, url: str, parsed_feed: feedparser.FeedParserDict | None = None) -> Feed | None:
        """
        Check if a feed already exists using RSS URL normalization only.

        Note: We now allow multiple RSS feeds for the same website since different
        feeds may serve different purposes (e.g., blog posts vs announcements).
        Only RSS URL duplicates are checked since the database has a unique constraint.

        Args:
            url: The RSS feed URL to check
            parsed_feed: Optional pre-parsed feed data (unused but kept for compatibility)

        Returns:
            Existing Feed if duplicate found, None otherwise

        Raises:
            FeedSubscriptionError: If a duplicate is detected
        """
        logger.info("Starting RSS URL duplicate detection", url=url)

        # Only check RSS URL duplicates - database unique constraint handles this
        normalized_url = self._normalize_url(url)
        duplicate = await self._check_url_duplicate(normalized_url)
        if duplicate:
            raise FeedSubscriptionError(f"RSS feed already exists with identical URL: {duplicate.url}")

        logger.info("No RSS URL duplicates detected", url=url)
        return None

    def _normalize_url(self, url: str) -> str:
        """Normalize URL for consistent comparison."""
        if not url:
            return url

        try:
            parsed = urllib.parse.urlparse(url.lower().strip())

            # Force HTTPS if no scheme
            if not parsed.scheme:
                parsed = urllib.parse.urlparse(f"https://{url}")

            # Remove www prefix
            netloc = parsed.netloc
            if netloc.startswith("www."):
                netloc = netloc[4:]

            # Remove trailing slash from path
            path = parsed.path.rstrip("/") or "/"

            # Remove common tracking parameters
            if parsed.query:
                query_params = urllib.parse.parse_qs(parsed.query)
                # Keep only essential RSS parameters
                essential_params = {}
                for key, values in query_params.items():
                    if key.lower() in ["format", "type", "feed", "rss", "atom"]:
                        essential_params[key] = values

                query = urllib.parse.urlencode(essential_params, doseq=True) if essential_params else ""
            else:
                query = ""

            normalized = urllib.parse.urlunparse(
                (
                    "https",  # Always use HTTPS
                    netloc,
                    path,
                    "",  # params
                    query,
                    "",  # fragment
                )
            )

            return normalized

        except Exception as e:
            logger.warning("URL normalization failed", url=url, error=str(e))
            return url.lower().strip()

    async def _check_url_duplicate(self, normalized_url: str) -> Feed | None:
        """Check for exact URL duplicates."""
        try:
            result = await self.db.execute(select(Feed).where(Feed.url == normalized_url))
            return result.scalar_one_or_none()
        except Exception as e:
            logger.warning("URL duplicate check failed", error=str(e))
            return None
