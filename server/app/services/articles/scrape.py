"""
Service for extracting full text content from article URLs.

Uses:
1. Trafilatura: For main content extraction (noise removal).
2. BeautifulSoup: For DOM-specific cleanup (removing duplicate titles/images).
3. nh3: For security sanitization (XSS prevention).
"""

import asyncio
import re
import time

import nh3
import structlog
import trafilatura
from bs4 import BeautifulSoup, Tag
from trafilatura.downloads import ConfigParser
from trafilatura.settings import DEFAULT_CONFIG

from app.core.constants import (
    ALLOWED_ATTRIBUTES,
    ALLOWED_TAGS,
    CONTENT_EXTRACTION_TIMEOUT,
)
from app.utils.urls import urls_match

logger = structlog.get_logger(__name__)

# ==============================================================================
# CONFIGURATION
# ==============================================================================

# ==============================================================================
# CONFIGURATION
# ==============================================================================


def _get_trafilatura_config() -> ConfigParser:
    """Create custom config with shorter timeout and no retries."""
    config = ConfigParser(defaults=DEFAULT_CONFIG.defaults())
    config["DEFAULT"]["DOWNLOAD_TIMEOUT"] = str(CONTENT_EXTRACTION_TIMEOUT)
    config["DEFAULT"]["MAX_REDIRECTS"] = "2"
    # Minimize noise
    config["DEFAULT"]["deduplicate"] = "yes"
    return config


# ==============================================================================
# DOM MANIPULATION HELPERS (BeautifulSoup)
# ==============================================================================


# ==============================================================================
# DOM MANIPULATION HELPERS (BeautifulSoup)
# ==============================================================================


def _remove_duplicate_title_heading(soup: BeautifulSoup, article_title: str | None) -> None:
    """
    Remove the first heading if it matches the article title.
    Mutates the soup object.
    """
    if not article_title:
        return

    try:
        # Find the first heading element (h1-h6)
        first_heading = soup.find(["h1", "h2", "h3", "h4", "h5", "h6"])

        if first_heading:
            # Normalize text for comparison
            heading_text = re.sub(r"\s+", " ", first_heading.get_text().strip())
            title_text = re.sub(r"\s+", " ", article_title.strip())

            # Check for exact match or strong containment
            if heading_text.lower() == title_text.lower():
                logger.debug("Removing duplicate title heading", text=heading_text)
                first_heading.decompose()
    except Exception as e:
        logger.warning("Error removing duplicate title", error=str(e))


def _remove_duplicate_image(soup: BeautifulSoup, main_image_url: str | None) -> None:
    """
    Remove an <img> tag from the body if it matches the main_image_url.
    This prevents showing the Hero Image twice (once in UI header, once in body).
    Mutates the soup object.
    """
    if not main_image_url:
        return

    try:
        images = soup.find_all("img", src=True)
        for img in images:
            # Type check: ensure img is a Tag object (not NavigableString, etc.)
            if not isinstance(img, Tag):
                continue

            # BeautifulSoup Tag attributes can be strings or lists, extract as string
            img_src_attr = img.attrs.get("src")
            if isinstance(img_src_attr, list):
                img_src = img_src_attr[0] if img_src_attr else None
            else:
                img_src = img_src_attr if isinstance(img_src_attr, str) else None

            if img_src and urls_match(img_src, main_image_url):
                logger.debug("Removing duplicate hero image from body", src=img_src)
                # Optional: Remove parent figure if it contains only this image
                parent = img.parent
                img.decompose()

                # Cleanup empty parents (like <figure></figure> or <p></p>)
                if parent and parent.name in ["figure", "p", "div"]:
                    if not parent.get_text(strip=True) and not parent.find("img"):
                        parent.decompose()
                return  # Only remove the first occurrence (usually the top one)
    except Exception as e:
        logger.warning("Error removing duplicate image", error=str(e))


def _heal_html_code_tags(soup: BeautifulSoup) -> None:
    """
    Trafilatura extracts inline code as block <pre> tags and splits paragraphs.
    This function traverses the body, detects when a paragraph was split by inline
    pre/text nodes, converts those <pre> nodes to inline <code>, and merges them
    back into the preceding <p> tag. Also removes nested <pre> wrappers.
    """
    body = soup.body if soup.body else soup
    if not body:
        return

    # 1. Fix nested <pre> tags (like <pre><pre>code</pre></pre>)
    for nested_pre in body.find_all("pre"):
        inner_pre = nested_pre.find("pre")
        if inner_pre:
            nested_pre.string = inner_pre.get_text()

    # 2. Merge split inline elements back into paragraphs
    children = list(body.children)
    current_p = None
    nodes_to_merge = []

    for child in children:
        if isinstance(child, Tag) and child.name == "p":
            if current_p and nodes_to_merge:
                for node in nodes_to_merge:
                    if isinstance(node, Tag) and node.name == "pre":
                        code_tag = soup.new_tag("code")
                        code_tag.string = node.get_text()
                        current_p.append(code_tag)
                        node.decompose()
                    else:
                        current_p.append(node)
                nodes_to_merge = []
            current_p = child
        elif current_p:
            is_text = not isinstance(child, Tag)
            is_inline_pre = isinstance(child, Tag) and child.name == "pre" and "\n" not in child.get_text()

            if is_text or is_inline_pre:
                nodes_to_merge.append(child)
            else:
                if nodes_to_merge:
                    for node in nodes_to_merge:
                        if isinstance(node, Tag) and node.name == "pre":
                            code_tag = soup.new_tag("code")
                            code_tag.string = node.get_text()
                            current_p.append(code_tag)
                            node.decompose()
                        else:
                            current_p.append(node)
                    nodes_to_merge = []
                current_p = None


# ==============================================================================
# MAIN EXTRACTION LOGIC
# ==============================================================================


def _fetch_and_extract(url: str, config: ConfigParser) -> str | None:
    """Blocking Trafilatura operation to be run in a thread."""
    downloaded = trafilatura.fetch_url(url, config=config)
    if not downloaded:
        return None

    # Extract with images allowed
    return trafilatura.extract(downloaded, output_format="html", include_images=True, config=config)


async def extract_full_content(
    url: str, article_title: str | None = None, main_image_url: str | None = None
) -> tuple[str | None, str | None]:
    """
    Extract full text content from the article's original URL.

    Pipeline:
    1. Trafilatura (Fetch & Extract raw HTML)
    2. BeautifulSoup (Remove duplicate Title & Hero Image)
    3. nh3 (Sanitize HTML for security)
    4. Metrics (Read Time)

    Returns:
        (content, error_message)
    """
    start_time = time.perf_counter()
    config = _get_trafilatura_config()

    try:
        # 1. Fetch & Extract (Blocking I/O)
        extracted_html = await asyncio.wait_for(
            asyncio.to_thread(_fetch_and_extract, url, config),
            timeout=CONTENT_EXTRACTION_TIMEOUT,
        )

        if not extracted_html:
            return None, "Could not extract readable content"

        # 2. DOM Manipulation (Cleanup)
        # We use BeautifulSoup for structural changes before sanitizing
        soup = BeautifulSoup(extracted_html, "html.parser")

        # Heal broken inline code tags split by Trafilatura
        _heal_html_code_tags(soup)

        # A. Remove Duplicate Title
        if article_title:
            _remove_duplicate_title_heading(soup, article_title)

        # B. Remove Duplicate Hero Image
        if main_image_url:
            _remove_duplicate_image(soup, main_image_url)

        # Convert back to string for sanitization
        cleaned_dom = str(soup)

        # 3. Security Sanitization (nh3)
        # Strips scripts, styles, iframes, and unsafe attributes
        safe_content = nh3.clean(
            cleaned_dom,
            tags=ALLOWED_TAGS,
            attributes=ALLOWED_ATTRIBUTES,
            url_schemes={"http", "https", "mailto", "data"},
        )

        duration = time.perf_counter() - start_time
        logger.info(
            "Extracted full text",
            url=url,
            content_length=len(safe_content),
            duration=round(duration, 3),
        )

        return safe_content, None

    except asyncio.TimeoutError:
        logger.warning("Extraction timed out", url=url)
        return None, f"Timed out after {CONTENT_EXTRACTION_TIMEOUT}s"
    except Exception as e:
        logger.error("Extraction failed", url=url, error=str(e))
        return None, "Unexpected error during extraction"
