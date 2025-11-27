"""
Image extraction utilities for RSS/Atom feeds.
Implements the "onion layering" strategy to find the best hero image.
"""

from typing import Any

from bs4 import BeautifulSoup, Tag


def find_best_article_image(entry: dict[str, Any]) -> tuple[str | None, str]:
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
        except Exception:
            pass

    return None, "none"


def find_feed_icon(feed: dict[str, Any]) -> str | None:
    """
    Extract the feed icon (small square image for avatars/favicons).

    Args:
        feed: feedparser feed object

    Returns:
        Icon URL or None
    """
    # Atom spec: feed.icon is a small image with 1:1 aspect ratio
    if hasattr(feed, "icon"):
        return feed.icon

    # Atom spec: feed.logo is a larger image with 2:1 aspect ratio
    if hasattr(feed, "logo"):
        return feed.logo  # TODO: not sure if this is appropriate to return

    # RSS spec: feed.image usually contains url (href), title, width, and height
    if hasattr(feed, "image") and hasattr(feed.image, "href"):
        return feed.image.href

    return None
