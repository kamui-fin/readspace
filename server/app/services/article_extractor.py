"""Article extraction service for RSS/Atom feed entries."""

import re
from datetime import datetime, timezone
from typing import Any
from urllib.parse import urljoin
from uuid import UUID

import structlog
from bs4 import BeautifulSoup

from app.schemas.rss_schemas import ArticleCreate
from app.utils.reading_time import calculate_reading_time

logger = structlog.get_logger(__name__)


class ArticleExtractor:
    """Extracts article data from RSS/Atom feed entries."""

    def extract_article_data(self, entry: Any, feed_id: UUID, user_id: UUID) -> ArticleCreate:
        """Extract article data from a feed entry.

        Args:
            entry: feedparser entry object
            feed_id: UUID of the feed
            user_id: UUID of the user

        Returns:
            ArticleCreate: Pydantic schema with extracted article data
        """
        # Extract basic fields
        title = self._extract_title(entry)
        link = self._extract_link(entry)
        guid = self._extract_guid(entry, link)
        published_at = self._extract_published_date(entry)

        # Extract and clean content
        content = self._extract_content(entry)
        summary = self._extract_summary(entry, content)

        # Extract metadata
        author = self._extract_author(entry)
        image_url = self._extract_image_url(entry, content)
        read_time = self._calculate_read_time(content)

        logger.debug(
            "Extracted article data",
            title=title,
            link=link,
            has_content=bool(content),
            read_time=read_time,
        )

        return ArticleCreate(
            title=title,
            link=link,
            description=summary,
            content=content,
            published_at=published_at,
            author=author,
            guid=guid,
            image_url=image_url,
            estimated_read_time_minutes=read_time,
            feed_id=feed_id,
            user_id=user_id,
        )

    def _extract_title(self, entry: Any) -> str:
        """Extract and clean article title."""
        title = entry.get("title", "Untitled Article")
        if isinstance(title, dict):
            title = title.get("value", "Untitled Article")

        # Clean HTML tags and normalize whitespace
        title = BeautifulSoup(title, "html.parser").get_text()
        title = re.sub(r"\s+", " ", title).strip()

        return title[:500]  # Limit length

    def _extract_link(self, entry: Any) -> str:
        """Extract article link."""
        link = entry.get("link", "")
        if isinstance(link, list) and link:
            # Handle multiple links, prefer the first one
            link = link[0].get("href", "") if isinstance(link[0], dict) else str(link[0])
        elif isinstance(link, dict):
            link = link.get("href", "")

        return str(link).strip()[:2000]  # Limit length

    def _extract_guid(self, entry: Any, fallback_link: str) -> str:
        """Extract article GUID, using link as fallback."""
        guid = entry.get("id") or entry.get("guid")

        if isinstance(guid, dict):
            guid = guid.get("value", fallback_link)
        elif not guid:
            guid = fallback_link

        return str(guid).strip()[:500]  # Limit length

    def _extract_published_date(self, entry: Any) -> datetime:
        """Extract and parse published date."""
        # Try different date fields
        date_fields = ["published_parsed", "updated_parsed", "created_parsed"]

        for field in date_fields:
            date_tuple = entry.get(field)
            if date_tuple:
                try:
                    # Extract first 6 elements (year, month, day, hour, minute, second)
                    # Create datetime without timezone first, then replace with UTC
                    dt = datetime(*date_tuple[:6])
                    return dt.replace(tzinfo=timezone.utc)
                except (TypeError, ValueError, AttributeError):
                    continue

        # Try string date fields
        string_fields = ["published", "updated", "created"]
        for field in string_fields:
            date_str = entry.get(field)
            if date_str:
                try:
                    # This is a simplified parser - in production you might want to use dateutil
                    return datetime.fromisoformat(date_str.replace("Z", "+00:00"))
                except (ValueError, AttributeError):
                    continue

        # Default to current time if no date found
        logger.warning(
            "No valid publication date found, using current time",
            entry_id=entry.get("id"),
        )
        return datetime.now(timezone.utc)

    def _extract_content(self, entry: Any) -> str:
        """Extract and clean article content."""
        content = ""

        # Try content field first (Atom feeds)
        if "content" in entry:
            content_list = entry["content"]
            if content_list:
                content = content_list[0].get("value", "")

        # Fallback to summary if no content
        if not content:
            content = entry.get("summary", "")

        # Clean HTML content
        if content:
            soup = BeautifulSoup(content, "html.parser")

            # Remove script and style elements
            for script in soup(["script", "style"]):
                script.decompose()

            # Get text content
            content = soup.get_text()

            # Normalize whitespace
            content = re.sub(r"\s+", " ", content).strip()

        return content[:10000]  # Limit content length

    def _extract_summary(self, entry: Any, content: str) -> str:
        """Extract article summary, creating one from content if needed."""
        summary = entry.get("summary", "")

        if summary:
            # Clean HTML from summary
            soup = BeautifulSoup(summary, "html.parser")
            summary = soup.get_text()
            summary = re.sub(r"\s+", " ", summary).strip()

        # If no summary or very short, create one from content
        if not summary or len(summary) < 50:
            if content:
                # Take first 300 characters as summary
                summary = content[:300]
                if len(content) > 300:
                    # Find last complete word
                    last_space = summary.rfind(" ")
                    if last_space > 200:
                        summary = summary[:last_space] + "..."

        return str(summary)[:1000]  # Limit length

    def _extract_author(self, entry: Any) -> str | None:
        """Extract article author."""
        # Try different author fields
        author = entry.get("author") or entry.get("dc_creator")

        if isinstance(author, dict):
            author = author.get("name") or author.get("email")
        elif isinstance(author, list) and author:
            author = author[0]
            if isinstance(author, dict):
                author = author.get("name") or author.get("email")

        if author:
            author = str(author).strip()[:200]  # Limit length
            return author if author else None

        return None

    def _extract_image_url(self, entry: Any, content: str) -> str | None:
        """Extract article image URL from various sources."""
        # Try media content first (common in RSS)
        if "media_content" in entry:
            for media in entry["media_content"]:
                if media.get("medium") == "image" or media.get("type", "").startswith("image/"):
                    url = media.get("url")
                    return str(url) if url else None

        # Try media thumbnail
        if "media_thumbnail" in entry:
            thumbnails = entry["media_thumbnail"]
            if thumbnails:
                url = thumbnails[0].get("url")
                return str(url) if url else None

        # Try enclosure
        enclosures = entry.get("enclosures", [])
        for enclosure in enclosures:
            if enclosure.get("type", "").startswith("image/"):
                href = enclosure.get("href")
                return str(href) if href else None

        # Search in content for images
        if content:
            soup = BeautifulSoup(content, "html.parser")
            img_tag = soup.find("img", src=True)
            if img_tag and hasattr(img_tag, "get"):
                img_src = img_tag.get("src")
                if img_src:
                    # Convert relative URLs to absolute if possible
                    entry_link = entry.get("link")
                    if entry_link:
                        try:
                            return urljoin(str(entry_link), str(img_src))
                        except Exception:
                            return str(img_src)
                    return str(img_src)

        return None

    def _calculate_read_time(self, content: str) -> int:
        """Calculate estimated reading time in minutes with CJK support."""
        if not content:
            return 1

        read_time = calculate_reading_time(content, default_wpm=200)
        return min(read_time, 60)  # Cap at 60 minutes
