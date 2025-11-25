"""
Utilities for text analysis, hashing, language detection, and reading time.
"""

import hashlib
import re
from typing import Any

import structlog
from bs4 import BeautifulSoup
from iso639 import Lang

logger = structlog.get_logger(__name__)

# --- Constants & Regex ---
CJK_PATTERN = re.compile(r"[\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\u4e00-\u9fff\uac00-\ud7af\uff00-\uffef]")
WHITESPACE_PATTERN = re.compile(r"\s+")
HTML_TAG_PATTERN = re.compile(r"<[^>]*>")
PUNCTUATION_PATTERN = re.compile(r"[^\w\s]")
# Patterns for language extraction (e.g., en-US, zh-Hans)
LANGUAGE_PATTERNS = [
    re.compile(r"^([a-z]{2,3})-[a-z]{2}$"),
    re.compile(r"^([a-z]{2,3})-[a-z]{4}$"),
    re.compile(r"^([a-z]{2,3})-[a-z]+$"),
    re.compile(r"^([a-z]{2,3})_[a-z]{2}$"),
]


# --- Hashing Utilities ---


def get_content_hash(url: str) -> str:
    """
    Generate SHA-256 hash for article URL (cross-feed deduplication).

    Purpose: Detect when the same article appears in multiple feeds.

    Difference from guid_hash:
    - guid_hash: Deduplicates within a single feed (uses RSS GUID)
    - content_hash: Deduplicates across feeds (uses article URL)

    Example:
        Feed A and Feed B both contain article "https://example.com/post-1"
        → Same content_hash allows detecting this duplicate
    """
    normalized = url.strip().lower()
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()


def get_guid_hash(guid: str, fallback_link: str | None = None) -> str:
    """
    Generate SHA-256 hash for RSS GUID (article deduplication within a feed).

    Why GUID instead of link?
    - RSS GUID is the official unique identifier per RSS spec
    - GUID can be a URL, URN, or any unique string
    - Same article might have different GUIDs across different feeds
    - Link alone isn't reliable (can change, might not exist)

    Example RSS:
        <item>
            <guid>urn:uuid:1234-5678</guid>  <!-- Not a URL! -->
            <link>https://example.com/article</link>
        </item>

    Args:
        guid: RSS GUID field value
        fallback_link: Article link to use if GUID is empty

    Returns:
        SHA-256 hash string for deduplication
    """
    value = guid.strip() if guid else ""
    if not value:
        if not fallback_link:
            raise ValueError("Both guid and fallback_link are empty")
        value = fallback_link.strip()
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def calculate_feed_content_hash(entries: list[Any]) -> str:
    """Calculate SHA-256 hash of top 10 article titles + links to detect feed changes."""
    if not entries:
        return ""
    content_parts = []
    # Hash only top 10 articles - they're most important and stable
    for entry in entries[:10]:
        title = getattr(entry, "title", "")
        link = getattr(entry, "link", "")
        content_parts.append(f"{title}|{link}")
    combined = "||".join(content_parts)
    return hashlib.sha256(combined.encode()).hexdigest()


# --- Content Detection ---


def is_content_complete(content: str | None, threshold: int = 500) -> bool:
    """
    Heuristic to check if content looks like a full article vs a summary.

    Note: This is imperfect. Some micro-blogs have full content < 500 chars.
    """
    if content is None or content == "":
        return False
    # If it contains standard paragraph tags, it's more likely to be full content
    # than a plain text summary, even if short.
    if "<p>" in content and len(content) > 200:
        return True
    return len(content) >= threshold


def is_cjk_text(text: str) -> bool:
    """Check if text contains >20% CJK characters."""
    if not text.strip():
        return False
    non_whitespace = WHITESPACE_PATTERN.sub("", text)
    if not non_whitespace:
        return False
    cjk_chars = len(CJK_PATTERN.findall(text))
    return (cjk_chars / len(non_whitespace)) > 0.2


# --- Reading Time ---


def calculate_reading_time(content: str, default_wpm: int = 230, cjk_cpm: int = 300) -> int:
    """Calculate reading time in minutes, handling HTML stripping and CJK detection."""
    if not content or not content.strip():
        return 1

    # Try BeautifulSoup for clean text extraction, fallback to regex
    try:
        soup = BeautifulSoup(content, "html.parser")
        clean_text = soup.get_text(separator=" ", strip=True)
    except Exception:
        clean_text = HTML_TAG_PATTERN.sub(" ", content).strip()

    if not clean_text:
        return 1

    if is_cjk_text(clean_text):
        char_count = len(WHITESPACE_PATTERN.sub("", clean_text))
        return max(1, round(char_count / cjk_cpm))

    # Word count for non-CJK
    clean_text = PUNCTUATION_PATTERN.sub(" ", clean_text)
    word_count = len(clean_text.split())
    return max(1, round(word_count / default_wpm))


# --- Language Normalization ---


def normalize_language_code(language_code: str | None) -> str | None:
    """Normalize language codes (e.g., 'en-US' -> 'en') using ISO 639-1."""
    if not language_code:
        return None

    code = str(language_code).strip()
    if not code:
        return None

    # 1. Try extracting base code (e.g., en from en-US)
    base_code = None
    code_lower = code.lower()

    # Check regex patterns
    for pattern in LANGUAGE_PATTERNS:
        match = pattern.match(code_lower)
        if match:
            base_code = match.group(1)
            break

    if not base_code and 2 <= len(code_lower) <= 3 and code_lower.isalpha():
        base_code = code_lower

    # 2. Validate via iso639 library
    candidate = base_code if base_code else code
    try:
        lang = Lang(candidate)
        if lang.pt1:
            return lang.pt1
    except Exception:
        # Fallback: if we extracted a valid-looking 2-letter base, use it
        if base_code and len(base_code) == 2:
            return base_code

    return None
