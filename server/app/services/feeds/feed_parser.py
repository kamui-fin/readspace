"""
Feed parsing and metadata extraction logic - isolated for unit testing
"""

import re
from datetime import datetime, timezone
from typing import Any
from urllib.parse import urljoin, urlparse

import feedparser  # type: ignore[import-untyped]
import structlog
from bs4 import BeautifulSoup

from app.core.constants import MIN_VALID_PUBLISHED_YEAR
from app.core.custom_exceptions import FeedParsingError
from app.schemas import FeedBase
from app.utils.language_normalizer import normalize_language_code
from app.utils.reading_time import calculate_reading_time_from_html

logger = structlog.get_logger(__name__)

# Resource limits to prevent DoS attacks
MAX_FEED_CONTENT_SIZE_MB = 10
MAX_FEED_CONTENT_SIZE_BYTES = MAX_FEED_CONTENT_SIZE_MB * 1024 * 1024
MAX_ARTICLES_PER_FEED = 100


class FeedParsingService:
    """Isolated feed parsing logic that doesn't depend on database or external services"""

    def __init__(self, default_wpm: int = 230):
        self.default_wpm = default_wpm

    def parse_feed_data(self, feed_content_text: str, url: str) -> feedparser.FeedParserDict:
        """Parse RSS/Atom feed content and validate its structure

        Args:
            feed_content_text: Raw feed content
            url: Feed URL for logging

        Raises:
            FeedParsingError: If feed is too large or cannot be parsed
        """
        # Check feed size before parsing to prevent DoS
        content_size = len(feed_content_text.encode("utf-8"))
        if content_size > MAX_FEED_CONTENT_SIZE_BYTES:
            logger.warning(
                "Feed content too large, rejecting",
                url=url,
                size_mb=content_size / 1024 / 1024,
                max_mb=MAX_FEED_CONTENT_SIZE_MB,
            )
            raise FeedParsingError(
                f"Feed content too large ({content_size / 1024 / 1024:.1f}MB). "
                f"Maximum allowed size is {MAX_FEED_CONTENT_SIZE_MB}MB."
            )

        try:
            parsed_feed = feedparser.parse(feed_content_text)
        except Exception as e:
            logger.error("Failed to parse feed content", url=url, error=str(e))
            raise FeedParsingError(f"Unable to parse feed content: {e}") from e

        # Check for basic parsing issues
        if parsed_feed.bozo:
            bozo_type = type(parsed_feed.bozo_exception).__name__ if parsed_feed.bozo_exception else "Unknown"
            bozo_message = str(parsed_feed.bozo_exception) if parsed_feed.bozo_exception else "Unknown error"
            logger.warning(
                "Feed parsed with issues (bozo)",
                url=url,
                bozo_type=bozo_type,
                bozo_message=bozo_message,
            )

            # Only fail for severe parsing errors
            if parsed_feed.bozo_exception and any(
                error_type in bozo_type for error_type in ["SAXParseException", "ExpatError", "XMLSyntaxError"]
            ):
                # Still allow it if we have some basic feed structure
                if not parsed_feed.feed or not hasattr(parsed_feed, "entries"):
                    logger.error(
                        "Feed has severe parsing errors and no valid structure",
                        url=url,
                        bozo_type=bozo_type,
                    )
                    raise FeedParsingError(f"Feed has severe parsing errors: {bozo_message}")

        # Validate basic feed structure
        if not hasattr(parsed_feed, "feed") or not parsed_feed.feed:
            logger.error("Feed missing basic structure", url=url)
            raise FeedParsingError("Feed content does not contain valid feed structure")

        if not hasattr(parsed_feed, "entries"):
            logger.error("Feed missing entries structure", url=url)
            raise FeedParsingError("Feed content does not contain valid entries structure")

        # Check if feed has a title (most feeds should have this)
        feed_title = parsed_feed.feed.get("title", "").strip()
        if not feed_title:
            logger.warning("Feed has no title", url=url)

        # Validate that the feed has at least some content that looks like RSS/Atom
        if not any(key in parsed_feed.feed for key in ["title", "description", "summary", "link"]):
            logger.error("Feed lacks basic RSS/Atom elements", url=url)
            raise FeedParsingError("Content does not appear to be a valid RSS or Atom feed")

        logger.debug(
            "Feed parsed successfully",
            url=url,
            entry_count=len(parsed_feed.entries),
            has_title=bool(feed_title),
        )
        return parsed_feed

    def extract_feed_metadata(self, parsed_feed: feedparser.FeedParserDict, feed_url: str) -> FeedBase:
        """Extract relevant FeedBase data from parsed feed"""
        feed_info = parsed_feed.get("feed", {})
        title = feed_info.get("title", feed_url)  # Default to URL if no title
        description = feed_info.get("subtitle") or feed_info.get("description")
        link = feed_info.get("link")
        language = normalize_language_code(feed_info.get("language"))
        image_url = feed_info.get("image", {}).get("href") or feed_info.get("logo")

        # If no image is found and we have a link, use favicon from the link domain
        if not image_url and link:
            try:
                parsed_url = urlparse(link)
                domain = f"{parsed_url.scheme}://{parsed_url.netloc}"
                image_url = f"{domain}/favicon.ico"
                logger.info(
                    "Using favicon as fallback for feed image",
                    feed_url=feed_url,
                    favicon_url=image_url,
                )
            except Exception as e:
                logger.warning(
                    "Failed to create favicon URL",
                    feed_url=feed_url,
                    link=link,
                    error=str(e),
                )

        return FeedBase(
            url=str(feed_url),
            title=title,
            description=description,
            link=str(link) if link is not None else None,
            language=language,
            image_url=str(image_url) if image_url is not None else None,
        )

    def extract_article_data(self, entry: Any, feed_url: str | None = None) -> dict[str, Any] | None:
        """Extract article data from a single feed entry - returns dict instead of ArticleCreate"""
        guid = entry.get("id") or entry.get("guid") or entry.get("link")
        if not guid:
            logger.warning("Skipping entry with no GUID or link", entry_title=entry.get("title"))
            return None

        # Validate GUID length and content
        guid_str = str(guid)[:1024]  # Ensure GUID fits in model
        if not guid_str.strip():
            logger.warning("Skipping entry with empty GUID", entry_title=entry.get("title"))
            return None

        title = entry.get("title")
        if title:
            title = str(title).strip()
            if not title:
                title = None

        link = entry.get("link")
        if not link:
            logger.warning("Skipping entry with no link", guid=guid, entry_title=title)
            return None

        # Validate and clean the link
        link_str = str(link).strip()
        if not link_str or link_str in ["#", "javascript:void(0)"]:
            logger.warning(
                "Skipping entry with invalid link",
                guid=guid,
                entry_title=title,
                link=link_str,
            )
            return None

        description = entry.get("summary") or entry.get("description")
        if description:
            description = str(description).strip()
            if not description:
                description = None

        content = None
        if "content" in entry:
            for content_item in entry.content:
                if content_item.type == "text/html":
                    content = content_item.value
                    break
                if content_item.type == "text/plain" and not content:
                    content = content_item.value
        if not content and description and len(description) > 200:
            content = description

        if content:
            content = str(content).strip()
            if not content:
                content = None

        published_dt: datetime | None = None
        if "published_parsed" in entry and entry.published_parsed:
            try:
                parsed_date = datetime(*entry.published_parsed[:6]).replace(tzinfo=timezone.utc)
                # Validate that the date is within reasonable bounds
                if parsed_date.year >= MIN_VALID_PUBLISHED_YEAR:
                    published_dt = parsed_date
                else:
                    logger.warning(
                        "Published date year is before minimum valid year, using current time",
                        guid=guid,
                        parsed_year=parsed_date.year,
                        min_year=MIN_VALID_PUBLISHED_YEAR,
                    )
                    published_dt = datetime.now(timezone.utc)
            except Exception:
                logger.warning(
                    "Failed to parse published_parsed",
                    guid=guid,
                    published_parsed=entry.published_parsed,
                )
        elif "updated_parsed" in entry and entry.updated_parsed:
            try:
                parsed_date = datetime(*entry.updated_parsed[:6]).replace(tzinfo=timezone.utc)
                # Validate that the date is within reasonable bounds
                if parsed_date.year >= MIN_VALID_PUBLISHED_YEAR:
                    published_dt = parsed_date
                else:
                    logger.warning(
                        "Updated date year is before minimum valid year, using current time",
                        guid=guid,
                        parsed_year=parsed_date.year,
                        min_year=MIN_VALID_PUBLISHED_YEAR,
                    )
                    published_dt = datetime.now(timezone.utc)
            except Exception:
                logger.warning(
                    "Failed to parse updated_parsed",
                    guid=guid,
                    updated_parsed=entry.updated_parsed,
                )

        # If no valid date was found, use current timestamp as fallback
        if published_dt is None:
            published_dt = datetime.now(timezone.utc)

        # Skip articles that have no meaningful content
        if not title and not content and not description:
            logger.warning("Skipping entry with no title, content, or description", guid=guid)
            return None

        try:
            image_url = self.find_best_article_image(entry, content, feed_url)
            estimated_read_time = self.calculate_estimated_read_time(content or description)

            return {
                "guid": guid_str,
                "title": title,
                "link": link_str,
                "description": description,
                "content": content,
                "image_url": str(image_url) if image_url is not None else None,
                "published_at": published_dt,
                "estimated_read_time_minutes": estimated_read_time,
                "author": entry.get("author"),
            }
        except Exception as e:
            logger.warning(
                "Failed to create article data",
                guid=guid,
                error=str(e),
                entry_title=title,
            )
            return None

    def find_best_article_image(self, entry: Any, content_html: str | None, feed_url: str | None = None) -> str | None:
        """Try to find the best image for an article and convert relative URLs to absolute"""

        def validate_and_normalize_url(url: str) -> str | None:
            """Validate URL and convert relative URLs to absolute using feed_url"""
            if not url or not url.strip():
                return None

            url = url.strip()

            # Skip data URLs and obvious placeholders
            if url.startswith("data:") or url in ["#", "javascript:void(0)"]:
                return None

            # If it's already an absolute URL, validate and return
            if url.startswith(("http://", "https://")):
                try:
                    parsed = urlparse(url)
                    if parsed.netloc:  # Must have a domain
                        return url
                except Exception:  # noqa: S110
                    pass  # URL parsing is best-effort
                return None

            # Convert relative URL to absolute if we have a feed_url
            if feed_url:
                try:
                    absolute_url = urljoin(feed_url, url)
                    parsed = urlparse(absolute_url)
                    if parsed.netloc and parsed.scheme in ["http", "https"]:
                        return absolute_url
                except Exception:  # noqa: S110
                    pass  # URL joining is best-effort

            return None

        # Check media_content first
        if "media_content" in entry and entry.media_content:
            for media in entry.media_content:
                if media.get("medium") == "image" and media.get("url"):
                    validated_url = validate_and_normalize_url(media.get("url"))
                    if validated_url:
                        return validated_url

        # Check enclosures
        if "enclosures" in entry and entry.enclosures:
            for enclosure in entry.enclosures:
                if enclosure.get("type", "").startswith("image/") and enclosure.get("href"):
                    validated_url = validate_and_normalize_url(enclosure.get("href"))
                    if validated_url:
                        return validated_url

        # Parse content HTML for images
        if content_html:
            try:
                soup = BeautifulSoup(content_html, "html.parser")
                img_tag = soup.find("img")
                if img_tag and img_tag.get("src"):  # type: ignore[attr-defined]
                    src = img_tag.get("src")  # type: ignore[attr-defined]
                    width = img_tag.get("width")  # type: ignore[attr-defined]
                    height = img_tag.get("height")  # type: ignore[attr-defined]

                    # Skip tiny images (likely tracking pixels)
                    if width == "1" and height == "1":
                        return None

                    validated_url = validate_and_normalize_url(src)
                    if validated_url:
                        return validated_url

            except Exception as e:
                logger.warning(
                    "BeautifulSoup failed to parse content for image extraction",
                    error=str(e),
                    guid=entry.get("id"),
                )
                # Fallback to regex if BeautifulSoup fails
                try:
                    img_match = re.search(
                        r'<img [^>]*src=(["\'])(.*?)\1',
                        content_html,
                        re.IGNORECASE | re.DOTALL,
                    )
                    if img_match:
                        validated_url = validate_and_normalize_url(img_match.group(2))
                        if validated_url:
                            return validated_url
                except Exception:  # noqa: S110
                    pass  # HTML parsing is best-effort

        return None

    def calculate_estimated_read_time(self, text_content: str | None) -> int | None:
        """Calculate estimated read time in minutes with CJK support"""
        if not text_content:
            return None

        return calculate_reading_time_from_html(text_content, default_wpm=self.default_wpm)

    def extract_feed_scheduling_data(self, parsed_feed: feedparser.FeedParserDict) -> dict[str, Any]:
        """Extract TTL and scheduling data from parsed feed"""
        ttl_value = None
        if parsed_feed.feed.get("ttl"):
            try:
                ttl_value = int(parsed_feed.feed.get("ttl"))
            except (ValueError, TypeError):
                logger.warning("Invalid TTL value in feed", ttl_raw=parsed_feed.feed.get("ttl"))
                ttl_value = None

        skip_hours_value = []
        skip_hours_raw = parsed_feed.feed.get("skipHours", {}).get("hour", [])
        if skip_hours_raw:
            for hour in skip_hours_raw:
                try:
                    hour_int = int(hour)
                    if 0 <= hour_int <= 23:  # Valid hour range
                        skip_hours_value.append(hour_int)
                except (ValueError, TypeError):
                    logger.warning("Invalid skip hour value", hour_raw=hour)

        skip_days_value = []
        skip_days_raw = parsed_feed.feed.get("skipDays", {}).get("day", [])
        if skip_days_raw:
            valid_days = [
                "Monday",
                "Tuesday",
                "Wednesday",
                "Thursday",
                "Friday",
                "Saturday",
                "Sunday",
            ]
            for day in skip_days_raw:
                day_str = str(day).strip()
                if day_str in valid_days:
                    skip_days_value.append(day_str)
                else:
                    logger.warning("Invalid skip day value", day_raw=day)

        return {
            "ttl": ttl_value,
            "skip_hours": skip_hours_value,
            "skip_days": skip_days_value,
        }

    def validate_feed_quality(
        self, parsed_feed: feedparser.FeedParserDict, min_article_count: int = 1
    ) -> dict[str, Any]:
        """Validate if feed has acceptable quality and content

        Args:
            parsed_feed: Parsed feed dictionary
            min_article_count: Minimum number of valid articles required

        Returns:
            Dictionary with validation results including truncation info
        """
        total_entries = len(parsed_feed.entries)

        # Limit number of articles processed to prevent spam attacks
        entries_to_process = parsed_feed.entries[:MAX_ARTICLES_PER_FEED]
        was_truncated = total_entries > MAX_ARTICLES_PER_FEED

        if was_truncated:
            logger.warning(
                "Feed has too many entries, truncating",
                total_entries=total_entries,
                max_articles=MAX_ARTICLES_PER_FEED,
            )

        # Extract valid articles
        valid_articles = []
        for entry in entries_to_process:
            article_data = self.extract_article_data(entry)
            if article_data:
                valid_articles.append(article_data)

        valid_articles_count = len(valid_articles)

        result: dict[str, Any] = {
            "is_valid": True,
            "total_entries": total_entries,
            "valid_articles": valid_articles_count,
            "validation_errors": [],
        }

        if valid_articles_count == 0:
            result["is_valid"] = False
            if total_entries == 0:
                result["validation_errors"].append("Feed has no entries at all")
            else:
                result["validation_errors"].append("Feed has entries but no valid articles")

        if valid_articles_count < min_article_count:
            result["is_valid"] = False
            result["validation_errors"].append(f"Feed has fewer than {min_article_count} valid articles")

        # Additional check for feeds that might be too sparse
        if total_entries > 0 and valid_articles_count < (total_entries * 0.1):
            result["validation_errors"].append("Feed has very low valid article ratio")

        return result
