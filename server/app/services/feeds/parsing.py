"""
Feed parsing module.
Strictly handles CPU-bound parsing and data extraction.
Zero DB dependencies.
"""

import re
from datetime import datetime, timezone
from typing import Any, TypedDict, cast
from urllib.parse import urljoin, urlparse

import feedparser  # type: ignore
import nh3  # type: ignore
import structlog
from bs4 import BeautifulSoup, Tag
from dateutil import parser as date_parser

from app.typing.articles import ArticleCreate
from app.utils.text import calculate_reading_time

logger = structlog.get_logger(__name__)

# ==============================================================================
# CONFIGURATION
# ==============================================================================

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

ALLOWED_ATTRIBUTES = {
    "a": {"href", "title", "target"},
    "img": {"src", "alt", "title", "width", "height"},
    "video": {"src", "controls", "poster"},
    "source": {"src", "type"},
    "code": {"class"},
    "span": {"class"},
    "div": {"class"},
}


class ParsedFeed(TypedDict):
    title: str
    description: str | None
    link: str | None
    language: str | None
    image_url: str | None
    ttl: int | None
    articles: list[ArticleCreate]
    version: str


def parse_feed_content(content: str, url: str) -> ParsedFeed:
    """
    Parse raw feed content into a structured format.
    Handles RSS/Atom normalization.
    """
    parsed = feedparser.parse(content)

    if parsed.bozo:
        logger.warning("Feed parsed with errors", url=url, error=str(parsed.bozo_exception))

    feed: dict[str, Any] = cast(dict[str, Any], parsed.feed)

    title = _clean_plain_text(feed.get("title", "")) or _extract_domain(url)
    description = _clean_plain_text(feed.get("description") or feed.get("subtitle") or "")
    link = feed.get("link") or url
    language = (feed.get("language") or "en").split("-")[0].lower()

    image_url = feed.get("image", {}).get("href") or feed.get("logo")

    ttl = None
    if "ttl" in feed:
        try:
            ttl = int(feed["ttl"])
        except (ValueError, TypeError):
            pass

    articles: list[ArticleCreate] = []

    for entry in parsed.entries:
        try:
            # No dummy_id needed as feed_id is Optional in ArticleCreate
            article = _extract_article_data(entry, feed_url=url)
            if article:
                articles.append(article)
        except Exception as e:
            logger.warning("Failed to extract article", error=str(e))

    version: str = str(parsed.version) if parsed.version else "unknown"

    return {
        "title": title,
        "description": description,
        "link": link,
        "language": language,
        "image_url": image_url,
        "ttl": ttl,
        "articles": articles,
        "version": version,
    }


# ==============================================================================
# EXTRACTION LOGIC (Adapted from rss_extractor.py)
# ==============================================================================


def _extract_article_data(entry: dict[str, Any], feed_url: str) -> ArticleCreate | None:
    """
    Convert a raw feedparser entry into a clean ArticleCreate schema.
    """
    link = _extract_link(entry)
    if not link:
        return None

    title = _clean_plain_text(entry.get("title", "Untitled Article"))[:500]
    guid = _extract_guid(entry, fallback_link=link)
    published_at = _extract_published_date(entry)

    # Content Processing
    raw_content = _get_best_content_candidate(entry)
    clean_content = _sanitize_and_fix_html(raw_content, base_url=feed_url or link)
    summary = _create_summary(entry, clean_content)

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
        # feed_id is Optional and will be assigned in service layer
        feed_id=None,
        user_id=None,
    )


def _extract_link(entry: dict) -> str:
    return entry.get("link", "") or ""


def _extract_guid(entry: dict, fallback_link: str) -> str:
    guid = entry.get("id") or entry.get("guid")
    if isinstance(guid, dict):
        guid = guid.get("value")
    if not guid:
        guid = fallback_link
    return str(guid).strip()[:500]


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


def _create_summary(entry: dict, clean_html_content: str) -> str:
    raw_summary = entry.get("summary", "")
    if raw_summary:
        summary = _clean_plain_text(raw_summary)
        if len(summary) > 20:
            return summary[:1000]

    text = nh3.clean(clean_html_content, tags=set())
    text = re.sub(r"\s+", " ", text).strip()
    return text[:300] + "..." if len(text) > 300 else text


def _clean_plain_text(text: Any) -> str:
    if not text:
        return ""
    if isinstance(text, dict):
        text = text.get("value", "")
    text = nh3.clean(str(text), tags=set())
    return re.sub(r"\s+", " ", text).strip()


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

    if clean_content:
        soup = BeautifulSoup(clean_content, "html.parser")
        for img in soup.find_all("img", src=True):
            if not isinstance(img, Tag):
                continue
            src = img.get("src")
            if src and isinstance(src, str):
                if "icon" in src or "emoji" in src:
                    continue
                return src

    return None


def _extract_domain(url: str) -> str:
    try:
        return urlparse(url).netloc
    except Exception:
        return url
