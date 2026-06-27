"""
Feed parsing module.
Strictly handles CPU-bound parsing and data extraction.
Zero DB dependencies.
"""

import html
import json
import re
from datetime import datetime, timezone
from time import mktime
from typing import Any, cast
from urllib.parse import urljoin

import feedparser
import langcodes
import nh3
import structlog
from bs4 import BeautifulSoup, Tag
from dateutil import parser as date_parser

from app.typing.entries import ArticleCreate
from app.typing.feeds import ParsedFeed
from app.utils.text import clean_html_text

logger = structlog.get_logger(__name__)

# ==============================================================================
# CONFIGURATION
# ==============================================================================
# HTML sanitization is handled by feedparser's built-in sanitizer
# We use BeautifulSoup/markdownify for text/markdown conversion


# ArticleCreate and ParsedFeed are imported from app.typing


def _normalize_language(lang_code: str) -> str:
    try:
        return langcodes.Language.get(lang_code).language
    except Exception:
        return "en"


def find_feed_icon(feed: Any) -> str | None:
    # Atom Icon
    if hasattr(feed, "icon"):
        return feed.icon
    # Atom Logo
    if hasattr(feed, "logo"):
        return feed.logo
    # RSS Image
    if hasattr(feed, "image") and hasattr(feed.image, "href"):
        return feed.image.href
    return None


def _parse_json_feed(content: str, url: str) -> ParsedFeed:
    """Parse JSON Feed format (v1.0/v1.1)."""
    data = json.loads(content)

    if not isinstance(data, dict):
        # Could be a list or primitive, invalid for JSON Feed
        raise json.JSONDecodeError("JSON root is not an object", content, 0)

    # Basic metadata extraction
    title = clean_html_text(data.get("title", ""))
    home_page_url = data.get("home_page_url", url)

    description = clean_html_text(data.get("description", ""))
    language = _normalize_language(data.get("language", "en"))
    icon = data.get("icon") or data.get("favicon")

    # Author
    author_data = data.get("author", {})
    author_name = str(author_data.get("name")) if isinstance(author_data, dict) and author_data.get("name") else None

    articles: list[ArticleCreate] = []
    items = data.get("items", [])

    if isinstance(items, list):
        for item in items:
            if not isinstance(item, dict):
                continue

            link = item.get("url", "")
            if not link:
                continue

            item_title = clean_html_text(item.get("title", "Untitled"))
            content_html = item.get("content_html", "")
            summary = item.get("summary", "")

            # Fallback content
            if not content_html:
                content_html = item.get("content_text", "") or summary

            published_at = datetime.now(timezone.utc)
            date_str = item.get("date_published")
            if date_str and isinstance(date_str, str):
                try:
                    dt = date_parser.parse(date_str)
                    if dt.tzinfo is None:
                        dt = dt.replace(tzinfo=timezone.utc)
                    published_at = dt
                except (ValueError, TypeError):
                    pass

            item_author = item.get("author", {})
            item_author_name = None
            if isinstance(item_author, dict) and item_author.get("name"):
                item_author_name = str(item_author.get("name"))

            articles.append(
                ArticleCreate(
                    title=item_title,
                    link=link,
                    description=clean_html_text(summary)[:1000],
                    content=str(content_html),
                    published_at=published_at,
                    author=item_author_name or author_name,
                    guid=str(item.get("id", link)),
                    image_url=item.get("image"),
                    tags=item.get("tags", []),
                )
            )

    return ParsedFeed(
        title=title,
        description=description,
        link=home_page_url,
        language=language,
        image_url=icon,
        last_updated_at=None,
        articles=articles,
        tags=[],
        author=author_name,
    )


def parse_feed_content(content: str, url: str) -> ParsedFeed:
    """
    Parse raw feed content into a structured format.
    Handles RSS/Atom/JSON normalization with comprehensive field extraction.
    """

    # 1. JSON Feed Support
    if isinstance(content, bytes):
        content = content.decode("utf-8", errors="ignore")
    content = content.strip()
    if content.startswith("{"):
        try:
            # logger.info(f"Attempting JSON parse for {url}")
            return _parse_json_feed(content, url)
        except json.JSONDecodeError as e:
            logger.warning(f"JSON decode failed for {url}: {e}")
            pass  # Continue to XML parsing

    # 2. XML (RSS/Atom) parsing
    # logger.info(f"Attempting XML parse for {url}")
    # Enable feedparser's built-in HTML sanitization
    parsed = feedparser.parse(content, sanitize_html=True)

    logger.info(f"Feedparser entries found: {len(parsed.entries)}")

    if parsed.bozo:
        logger.warning(f"Feed parsed with errors url={url} error={parsed.bozo_exception}")

    feed: dict[str, Any] = cast(dict[str, Any], parsed.feed)

    # Basic metadata
    title = html.unescape(clean_html_text(feed.get("title", "")))

    # Prefer subtitle over description for the tagline
    description = html.unescape(clean_html_text(feed.get("subtitle") or feed.get("description") or ""))

    link = feed.get("link") or url
    language = _normalize_language(feed.get("language", None))

    # Rich UI images
    image_url = find_feed_icon(feed)

    # Feed Author
    feed_author = feed.get("author")
    if not feed_author:
        contributors = feed.get("contributors")
        if contributors and isinstance(contributors, list):
            # Try to get the first contributor's name
            for c in contributors:
                if isinstance(c, dict) and c.get("name"):
                    feed_author = c.get("name")
                    break

    # Last updated timestamp
    last_updated_at = None
    if hasattr(feed, "updated_parsed") and feed.updated_parsed:
        try:
            last_updated_at = datetime.fromtimestamp(mktime(feed.updated_parsed), tz=timezone.utc)
        except (ValueError, TypeError, OverflowError):
            pass
    elif hasattr(feed, "published_parsed") and feed.published_parsed:
        try:
            last_updated_at = datetime.fromtimestamp(mktime(feed.published_parsed), tz=timezone.utc)
        except (ValueError, TypeError, OverflowError):
            pass

    # Tags/Categories
    tags = []
    if hasattr(feed, "tags"):
        tags = [t.term for t in feed.tags if hasattr(t, "term") and t.term]
    elif hasattr(feed, "categories"):
        tags = [c for c in feed.categories if isinstance(c, str)]

    articles: list[ArticleCreate] = []

    for entry in parsed.entries:
        try:
            article = _extract_article_data(entry, url)
            if article:
                articles.append(article)
        except Exception as e:
            logger.warning(
                f"Failed to parse article in {url}: {e}",
                entry_id=entry.get("id", "unknown"),
            )
            continue

    parsed_feed = ParsedFeed(
        title=title,
        description=description,
        link=link,
        language=language,
        image_url=image_url,
        last_updated_at=last_updated_at,
        articles=articles,
        tags=tags,
        author=feed_author,
        # content_type will be None/default as we don't extract it from XML
    )

    return parsed_feed


# ==============================================================================
# EXTRACTION LOGIC
# ==============================================================================


def _extract_article_data(entry: dict[str, Any], feed_url: str) -> ArticleCreate | None:
    """
    Convert a raw feedparser entry into a clean ArticleCreate schema.
    Implements comprehensive content and image extraction.
    """

    link = _extract_link(entry)
    if not link:
        return None

    title = html.unescape(clean_html_text(entry.get("title", "Untitled Article"))[:500])
    guid = _extract_guid(entry, fallback_link=link)
    published_at = _extract_published_date(entry)

    # Content Resolution (The Onion Strategy)
    # Layer 1: Get the best content candidate
    raw_summary = getattr(entry, "summary", "")
    raw_content = ""

    if hasattr(entry, "content"):
        # Atom feeds return a list. Usually the last one is the most 'rich'
        # e.g. [{'type': 'text/plain'}, {'type': 'text/html'}]
        for c in entry.content:
            if c.get("type") == "text/html":
                raw_content = c.get("value", "")
                break
        if not raw_content and len(entry.content) > 0:
            raw_content = entry.content[0].get("value", "")

    # Fallback: if no content, use summary as content
    if not raw_content:
        raw_content = raw_summary

    # Sanitize and fix relative URLs
    clean_content = _sanitize_and_fix_html(raw_content, base_url=feed_url or link)

    # Create a clean summary for list views (pure text, no HTML)
    summary = _create_summary(entry, clean_content)

    # Author extraction
    author = _extract_author(entry)

    # Image extraction with source tracking
    image_url, _ = find_best_article_image(entry)
    if image_url and (feed_url or link):
        # Resolve relative URLs
        image_url = urljoin(feed_url or link, image_url)

    # Tags extraction
    tags = []
    if hasattr(entry, "tags"):
        tags = [t.term for t in entry.tags if hasattr(t, "term") and t.term]
    elif hasattr(entry, "categories"):
        tags = [c for c in entry.categories if isinstance(c, str)]

    return ArticleCreate(
        title=title,
        link=link,
        description=summary,
        content=clean_content,  # Full HTML for reading view
        published_at=published_at,
        author=author,
        guid=guid,
        image_url=image_url,
        tags=tags,
    )


def _extract_link(entry: dict) -> str:
    return entry.get("link", "") or ""


def _extract_guid(entry: dict, fallback_link: str) -> str:
    guid = entry.get("id") or entry.get("guid")
    if isinstance(guid, dict):
        guid = guid.get("value")
    if not guid:
        guid = fallback_link

    guid_str = str(guid).strip()
    # Strip URL fragments from HTTP(S) GUIDs to prevent duplicate entries
    # when articles update (e.g., BBC News appending #0, #1, etc.)
    if guid_str.lower().startswith(("http://", "https://")):
        guid_str = guid_str.split("#")[0]

    return guid_str[:500]


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
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            return dt.astimezone(timezone.utc)
        except (ValueError, TypeError, ImportError):
            pass

    return datetime.now(timezone.utc)


def _get_best_content_candidate(entry: dict) -> str:
    """
    Extract the best content from entry.
    Feedparser already sanitizes HTML when sanitize_html=True is used.
    """
    if "content" in entry:
        for c in entry["content"]:
            if c.get("type") in ["text/html", "application/xhtml+xml", "html"]:
                return c.get("value", "")
        if len(entry["content"]) > 0:
            return entry["content"][0].get("value", "")

    if "summary_detail" in entry:
        return entry["summary_detail"].get("value", "")

    return entry.get("summary", "") or entry.get("description", "")


def _sanitize_and_fix_html(html_content: str, base_url: str | None) -> str:
    """
    Fix relative URLs in HTML content.

    Note: HTML sanitization is already handled by feedparser when sanitize_html=True.
    We only need to resolve relative URLs here.
    """
    if not html_content:
        return ""

    if base_url:
        try:
            soup = BeautifulSoup(html_content, "html.parser")
            has_changes = False
            for tag in soup.find_all(["a", "img", "video", "source"]):
                if not isinstance(tag, Tag):
                    continue
                if tag.has_attr("href"):
                    val = tag.get("href")
                    if val and isinstance(val, str) and not (val.startswith("data:") or val.startswith("mailto:")):
                        tag["href"] = urljoin(base_url, val)
                        has_changes = True
                if tag.has_attr("src"):
                    val = tag.get("src")
                    if val and isinstance(val, str) and not (val.startswith("data:") or val.startswith("mailto:")):
                        tag["src"] = urljoin(base_url, val)
                        has_changes = True
            if has_changes:
                html_content = str(soup)
        except Exception as e:
            logger.debug("Failed to fix relative URLs", error=str(e))

    return html_content


def _create_summary(entry: dict, clean_html_content: str) -> str:
    raw_summary = entry.get("summary", "")
    if raw_summary:
        summary = html.unescape(clean_html_text(raw_summary))
        if len(summary) > 20:
            return summary[:1000]

    text = html.unescape(nh3.clean(clean_html_content, tags=set()))
    text = re.sub(r"\s+", " ", text).strip()
    return text[:300] + "..." if len(text) > 300 else text


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


# ==============================================================================
# IMAGE EXTRACTION
# ==============================================================================


def find_best_article_image(entry: Any) -> tuple[str | None, str]:
    """
    Heuristic to find the best 'Hero Image' for an article.

    Returns:
        Tuple of (image_url, source) where source indicates where the image was found
    """
    # 1. Check 'media_content' (Common in high-quality feeds like NYT, Verge)
    # entry.media_content is a list of dicts. Look for 'image/jpeg' or 'medium=image'
    if hasattr(entry, "media_content"):
        for media in entry.media_content:
            if media.get("medium") == "image" or "image" in media.get("type", ""):
                if "url" in media:
                    return media["url"], "media_content"

    # 2. Check 'media_thumbnail' (YouTube feeds, some blogs)
    if hasattr(entry, "media_thumbnail"):
        # Usually a list, take the largest if possible, but first is okay
        if len(entry.media_thumbnail) > 0:
            return entry.media_thumbnail[0]["url"], "media_thumbnail"

    # 3. Check 'links' for 'enclosure' (Podcasts, some CMSs)
    if hasattr(entry, "links"):
        for link in entry.links:
            if link.get("rel") == "enclosure" and "image" in link.get("type", ""):
                return link["href"], "enclosure"

    # 4. Parse the HTML content for the first <img> tag
    # This is expensive but necessary for blogs that just dump HTML
    content_html = ""
    if hasattr(entry, "content"):
        content_html = entry.content[0].value
    elif hasattr(entry, "summary"):
        content_html = entry.summary

    if content_html:
        try:
            soup = BeautifulSoup(content_html, "html.parser")
            img = soup.find("img")
            if img and isinstance(img, Tag) and img.get("src"):
                src = img.get("src")
                if src and isinstance(src, str):
                    # Skip common tracking pixels and icons
                    if "icon" not in src.lower() and "emoji" not in src.lower() and "pixel" not in src.lower():
                        return src, "html_parse"
        except Exception as e:
            logger.debug("Failed to extract image from HTML", error=str(e))

    return None, "none"
