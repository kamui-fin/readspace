"""
Article extraction service for RSS/Atom feed entries.

Uses `nh3` (Ammonia) for high-performance HTML sanitization.
"""

import re
from datetime import datetime, timezone
from typing import Any
from urllib.parse import urljoin
from uuid import UUID

import nh3
import structlog
from bs4 import BeautifulSoup

from dateutil import parser as date_parser

from app.schemas import ArticleCreate
from app.utils.reading_time import calculate_reading_time

logger = structlog.get_logger(__name__)

# ==============================================================================
# CONFIGURATION
# ==============================================================================

# Tags allowed in the reader
ALLOWED_TAGS = {
    "a",
    "abbr",
    "acronym",
    "b",
    "blockquote",
    "br",
    "code",
    "div",
    "em",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "hr",
    "i",
    "img",
    "li",
    "ol",
    "p",
    "pre",
    "span",
    "strong",
    "table",
    "tbody",
    "td",
    "th",
    "thead",
    "tr",
    "ul",
    "video",
    "source",
    "figure",
    "figcaption",
}

# Attributes allowed per tag
ALLOWED_ATTRIBUTES = {
    "a": {"href", "title", "target"},
    "img": {"src", "alt", "title", "width", "height"},
    "video": {"src", "controls", "poster"},
    "source": {"src", "type"},
    "code": {"class"},  # Useful for syntax highlighting if you have it
    "span": {"class"},
    "div": {"class"},
}

# ==============================================================================
# CORE EXTRACTION LOGIC
# ==============================================================================


def extract_article_data(
    entry: dict[str, Any], feed_id: UUID, user_id: UUID, feed_url: str | None = None
) -> ArticleCreate:
    """
    Main entry point to convert a raw feedparser entry into a clean ArticleCreate schema.
    """
    # 1. Title & Link
    title = _clean_plain_text(entry.get("title", "Untitled Article"))[:500]
    link = _extract_link(entry)

    # 2. GUID
    guid = _extract_guid(entry, fallback_link=link)

    # 3. Dates
    published_at = _extract_published_date(entry)

    # 4. Content Processing
    raw_content = _get_best_content_candidate(entry)

    # Resolve relative links FIRST, then Sanitize
    clean_content = _sanitize_and_fix_html(raw_content, base_url=feed_url or link)

    # Summary
    summary = _create_summary(entry, clean_content)

    # 5. Metadata
    author = _extract_author(entry)
    image_url = _extract_image_url(entry, clean_content, base_url=feed_url or link)
    read_time = min(calculate_reading_time(clean_content, default_wpm=200), 60) if clean_content else 1

    return ArticleCreate(
        title=title,
        link=link,
        description=summary,
        content=clean_content,
        published_at=published_at,
        author=author,
        guid=guid,
        image_url=image_url,
        estimated_read_time_minutes=read_time,
        feed_id=feed_id,
        user_id=user_id,
    )


# ==============================================================================
# HELPERS: HTML & CONTENT
# ==============================================================================


def _sanitize_and_fix_html(html_content: str, base_url: str | None) -> str:
    """
    1. Resolves relative URLs using BeautifulSoup.
    2. Sanitizes HTML using nh3 (Rust).
    """
    if not html_content:
        return ""

    # Step 1: Link Resolution (Pre-sanitization)
    # nh3 is a sanitizer, not a DOM manipulator. We use BS4 strictly
    # to fix relative URLs (e.g., src="/cat.png") before cleaning.
    if base_url:
        try:
            soup = BeautifulSoup(html_content, "html.parser")
            has_changes = False

            # Fix Links
            for tag in soup.find_all(["a", "img", "video", "source"]):
                # Check href
                if tag.has_attr("href"):
                    val = tag["href"]
                    if val and not (val.startswith("data:") or val.startswith("mailto:")):
                        tag["href"] = urljoin(base_url, val)
                        has_changes = True

                # Check src
                if tag.has_attr("src"):
                    val = tag["src"]
                    if val and not (val.startswith("data:") or val.startswith("mailto:")):
                        tag["src"] = urljoin(base_url, val)
                        has_changes = True

            if has_changes:
                html_content = str(soup)
        except Exception:
            # If parsing fails, we proceed to sanitization with the original content
            # to ensure at least XSS protection is applied.
            pass

    # Step 2: Sanitization (nh3)
    # This strips scripts, styles, iframes, and unknown attributes
    try:
        clean_html = nh3.clean(
            html_content,
            tags=ALLOWED_TAGS,
            attributes=ALLOWED_ATTRIBUTES,
            url_schemes={"http", "https", "mailto", "data"},
        )
        return clean_html
    except Exception as e:
        logger.error("HTML sanitization failed", error=str(e))
        return ""


def _get_best_content_candidate(entry: dict) -> str:
    """Find the longest/richest content field."""
    if "content" in entry:
        for c in entry["content"]:
            if c.get("type") in ["text/html", "application/xhtml+xml", "html"]:
                return c.get("value", "")
        if len(entry["content"]) > 0:
            return entry["content"][0].get("value", "")

    if "summary_detail" in entry:
        return entry["summary_detail"].get("value", "")

    return entry.get("summary", "") or entry.get("description", "")


def _create_summary(entry: dict, clean_html_content: str) -> str:
    """Generate a plain-text summary."""
    # 1. Prefer explicit summary
    raw_summary = entry.get("summary", "")
    if raw_summary:
        summary = _clean_plain_text(raw_summary)
        if len(summary) > 20:
            return summary[:1000]

    # 2. Fallback: Strip tags from clean HTML
    # We use nh3.clean with empty tags set to strip everything efficiently
    text = nh3.clean(clean_html_content, tags=set())
    # Normalize whitespace
    text = re.sub(r"\s+", " ", text).strip()

    return text[:300] + "..." if len(text) > 300 else text


def _clean_plain_text(text: Any) -> str:
    """Strip all HTML and normalize whitespace for Titles."""
    if not text:
        return ""
    if isinstance(text, dict):
        text = text.get("value", "")

    # Strip all tags
    text = nh3.clean(str(text), tags=set())
    return re.sub(r"\s+", " ", text).strip()


# ==============================================================================
# HELPERS: METADATA
# ==============================================================================


def _extract_guid(entry: dict, fallback_link: str) -> str:
    guid = entry.get("id") or entry.get("guid")
    if isinstance(guid, dict):
        guid = guid.get("value")
    if not guid:
        guid = fallback_link
    return str(guid).strip()[:500]


def _extract_link(entry: dict) -> str:
    return entry.get("link", "") or ""


def _extract_published_date(entry: dict) -> datetime:
    # 1. fast path
    if "published_parsed" in entry and entry["published_parsed"]:
        try:
            return datetime(*entry["published_parsed"][:6], tzinfo=timezone.utc)
        except ValueError:
            pass

    if "updated_parsed" in entry and entry["updated_parsed"]:
        try:
            return datetime(*entry["updated_parsed"][:6], tzinfo=timezone.utc)
        except ValueError:
            pass

    # 2. slow path
    date_str = entry.get("published") or entry.get("updated") or entry.get("created")
    if date_str:
        try:
            dt = date_parser.parse(date_str)
            return dt.astimezone(timezone.utc)
        except (ValueError, TypeError, ImportError):
            pass

    return datetime.now(timezone.utc)


def _extract_author(entry: dict) -> str | None:
    if "author_detail" in entry:
        name = entry["author_detail"].get("name")
        if name:
            return str(name)[:200]

    if "authors" in entry and isinstance(entry["authors"], list) and entry["authors"]:
        name = entry["authors"][0].get("name")
        if name:
            return str(name)[:200]

    for key in ["author", "dc_creator", "itunes_author"]:
        val = entry.get(key)
        if val and isinstance(val, str):
            return val[:200]

    return None


def _extract_image_url(entry: dict, clean_content: str, base_url: str | None) -> str | None:
    def resolve(url):
        if base_url and url:
            return urljoin(base_url, url)
        return url

    # 1. Media/Enclosures
    if "media_content" in entry:
        for media in entry["media_content"]:
            if media.get("medium") == "image" or str(media.get("type")).startswith("image/"):
                return resolve(media.get("url"))

    if "enclosures" in entry:
        for enc in entry["enclosures"]:
            if str(enc.get("type")).startswith("image/"):
                return resolve(enc.get("href"))

    if "media_thumbnail" in entry:
        if isinstance(entry["media_thumbnail"], list) and entry["media_thumbnail"]:
            return resolve(entry["media_thumbnail"][0].get("url"))

    # 2. Content Scrape
    # We use the already cleaned content (which has resolved URLs)
    if clean_content:
        soup = BeautifulSoup(clean_content, "html.parser")
        for img in soup.find_all("img", src=True):
            src = img["src"]
            if "icon" in src or "emoji" in src:
                continue
            return src  # Already resolved in _sanitize_and_fix_html

    return None
