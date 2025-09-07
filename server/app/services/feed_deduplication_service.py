"""Feed deduplication service to prevent duplicate feeds."""

import urllib.parse

import feedparser
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
        Check if a feed already exists using URL normalization and canonical link matching.
        
        Args:
            url: The RSS feed URL to check
            parsed_feed: Optional pre-parsed feed data
            
        Returns:
            Existing Feed if duplicate found, None otherwise
            
        Raises:
            FeedSubscriptionError: If a duplicate is detected
        """
        logger.info("Starting duplicate detection", url=url)

        # Strategy 1: Exact URL match (normalized)
        normalized_url = self._normalize_url(url)
        duplicate = await self._check_url_duplicate(normalized_url)
        if duplicate:
            raise FeedSubscriptionError(
                f"Feed already exists with identical URL: {duplicate.url}"
            )

        # Strategy 2: Canonical link resolution
        if parsed_feed:
            canonical_link = self._extract_canonical_link(parsed_feed)
            if canonical_link:
                duplicate = await self._check_canonical_duplicate(canonical_link)
                if duplicate:
                    raise FeedSubscriptionError(
                        f"Feed already exists for website: {canonical_link} (existing feed: {duplicate.url})"
                    )

        logger.info("No duplicates detected", url=url)
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
            if netloc.startswith('www.'):
                netloc = netloc[4:]

            # Remove trailing slash from path
            path = parsed.path.rstrip('/') or '/'

            # Remove common tracking parameters
            if parsed.query:
                query_params = urllib.parse.parse_qs(parsed.query)
                # Keep only essential RSS parameters
                essential_params = {}
                for key, values in query_params.items():
                    if key.lower() in ['format', 'type', 'feed', 'rss', 'atom']:
                        essential_params[key] = values

                query = urllib.parse.urlencode(essential_params, doseq=True) if essential_params else ''
            else:
                query = ''

            normalized = urllib.parse.urlunparse((
                'https',  # Always use HTTPS
                netloc,
                path,
                '',  # params
                query,
                ''   # fragment
            ))

            return normalized

        except Exception as e:
            logger.warning("URL normalization failed", url=url, error=str(e))
            return url.lower().strip()

    def _extract_canonical_link(self, parsed_feed: feedparser.FeedParserDict) -> str | None:
        """Extract canonical website link from feed metadata."""
        try:
            if hasattr(parsed_feed, 'feed') and parsed_feed.feed:
                link = parsed_feed.feed.get('link')
                if link:
                    return self._normalize_url(link)
        except Exception as e:
            logger.warning("Failed to extract canonical link", error=str(e))

        return None

    async def _check_url_duplicate(self, normalized_url: str) -> Feed | None:
        """Check for exact URL duplicates."""
        try:
            result = await self.db.execute(
                select(Feed).where(Feed.url == normalized_url)
            )
            return result.scalar_one_or_none()
        except Exception as e:
            logger.warning("URL duplicate check failed", error=str(e))
            return None

    async def _check_canonical_duplicate(self, canonical_link: str) -> Feed | None:
        """Check for feeds with the same canonical website link."""
        try:
            normalized_link = self._normalize_url(canonical_link)
            result = await self.db.execute(
                select(Feed).where(Feed.link == normalized_link)
            )
            return result.scalar_one_or_none()
        except Exception as e:
            logger.warning("Canonical duplicate check failed", error=str(e))
            return None
