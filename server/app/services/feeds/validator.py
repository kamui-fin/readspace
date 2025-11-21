"""Feed validation service for RSS/Atom feeds."""

from typing import Any

import structlog

from app.core.custom_exceptions import FeedValidationError
from app.utils.language_normalizer import normalize_language_code
from app.utils.url.url_normalizer import extract_domain_from_url

logger = structlog.get_logger(__name__)

MIN_ARTICLE_COUNT = 1  # Minimum number of articles required for a feed to be considered valid


class FeedValidator:
    """Validates RSS/Atom feed structure and content."""

    def validate_feed_structure(self, parsed_feed: Any) -> None:
        """Validate the basic structure of a parsed feed.

        Args:
            parsed_feed: feedparser.FeedParserDict object

        Raises:
            FeedValidationError: If the feed structure is invalid
        """
        if not parsed_feed or not parsed_feed.get("feed"):
            raise FeedValidationError("Invalid feed format: No feed data found")

        feed_info = parsed_feed.feed

        # Note: Title is no longer required here since we have domain fallback logic
        # The title will be automatically generated from the domain if missing

        # Check for entries
        entries = parsed_feed.get("entries", [])
        if not entries:
            raise FeedValidationError("Invalid feed format: No articles found in feed")

        if len(entries) < MIN_ARTICLE_COUNT:
            raise FeedValidationError(
                f"Feed has insufficient content: Found {len(entries)} articles, minimum {MIN_ARTICLE_COUNT} required"
            )

        logger.info(
            "Feed structure validation passed",
            title=feed_info.get("title", "No title (will use domain fallback)"),
            entry_count=len(entries),
        )

    def validate_feed_articles(self, entries: list[Any]) -> bool:
        """Validate that feed articles have required content.

        Args:
            entries: List of feedparser entry objects

        Returns:
            bool: True if articles are valid, False otherwise
        """
        if not entries:
            return False

        valid_entries = 0

        for entry in entries:
            if self._validate_single_article(entry):
                valid_entries += 1

        # Require at least half the entries to be valid
        min_valid = max(1, len(entries) // 2)
        is_valid = valid_entries >= min_valid

        logger.info(
            "Article validation completed",
            total_entries=len(entries),
            valid_entries=valid_entries,
            min_required=min_valid,
            is_valid=is_valid,
        )

        return is_valid

    def _validate_single_article(self, entry: Any) -> bool:
        """Validate a single article entry.

        Args:
            entry: feedparser entry object

        Returns:
            bool: True if the article is valid
        """
        # Check for required fields
        if not entry.get("title") and not entry.get("summary"):
            return False

        # Check for content or link
        has_content = bool(entry.get("summary") or entry.get("content"))
        has_link = bool(entry.get("link"))

        if not (has_content or has_link):
            return False

        return True

    def validate_feed_url(self, url: str) -> None:
        """Validate feed URL format.

        Args:
            url: Feed URL to validate

        Raises:
            FeedValidationError: If URL is invalid
        """
        if not url or not url.strip():
            raise FeedValidationError("Feed URL cannot be empty")

        url = url.strip()

        if not url.startswith(("http://", "https://")):
            raise FeedValidationError("Feed URL must start with http:// or https://")

        # Basic URL format validation
        if len(url) > 2000:
            raise FeedValidationError("Feed URL is too long (max 2000 characters)")

        # Check for common invalid characters
        invalid_chars = [" ", "\n", "\r", "\t"]
        if any(char in url for char in invalid_chars):
            raise FeedValidationError("Feed URL contains invalid characters")

    def extract_feed_metadata(self, parsed_feed: Any, feed_url: str | None = None) -> dict:
        """Extract and validate feed metadata.

        Args:
            parsed_feed: feedparser.FeedParserDict object
            feed_url: Optional feed URL to use for domain fallback when title is missing

        Returns:
            dict: Cleaned feed metadata
        """
        feed_info = parsed_feed.feed

        # Extract title with domain fallback if missing
        title = feed_info.get("title", "").strip()
        if not title and feed_url:
            # Try to use the website link's domain first, fallback to feed URL domain
            link = feed_info.get("link")
            fallback_url = link if link else feed_url
            title = extract_domain_from_url(fallback_url)
            logger.info(
                "Feed has no title, using domain fallback in validator",
                feed_url=feed_url,
                fallback_title=title,
                fallback_source="link" if link else "feed_url",
            )
        elif not title:
            # No feed_url provided, use generic fallback
            title = "Untitled Feed"

        title = title[:500]  # Limit length

        description = feed_info.get("description", "").strip()[:1000]  # Limit length
        link = feed_info.get("link", "").strip()[:2000]  # Limit length

        # Extract and normalize language
        raw_language = feed_info.get("language", "en").strip()
        language = normalize_language_code(raw_language) or "en"

        return {
            "title": title,
            "description": description,
            "link": link,
            "language": language,
        }
