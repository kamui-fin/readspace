import html
import re
from typing import Any

import nh3
import structlog
from bs4 import BeautifulSoup
from iso639 import Lang

logger = structlog.get_logger(__name__)

# CJK covers Chinese, Japanese, Korean ranges
CJK_PATTERN = re.compile(r"[\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\u4e00-\u9fff\uac00-\ud7af\uff00-\uffef]")
WHITESPACE_PATTERN = re.compile(r"\s+")
HTML_TAG_PATTERN = re.compile(r"<[^>]*>")
PUNCTUATION_PATTERN = re.compile(r"[^\w\s]")

# Matches en-US, en_US, en-us, etc.
LANG_CODE_PATTERN = re.compile(r"^([a-z]{2,3})(?:[-_][a-z0-9]+)?$", re.IGNORECASE)


def tag_visible(element: Any) -> bool:
    if element.parent.name in [
        "style",
        "script",
        "head",
        "title",
        "meta",
        "[document]",
    ]:
        return False
    from bs4 import Comment

    if isinstance(element, Comment):
        return False
    return True


def clean_html_text(text: str | None) -> str:
    """
    Clean HTML text to plain text.
    Strips tags, scripts, styles, and unescapes entities.
    """
    if not text:
        return ""
    try:
        soup = BeautifulSoup(str(text), "html.parser")
        texts = soup.findAll(text=True)
        visible_texts = filter(tag_visible, texts)
        clean = " ".join(t.strip() for t in visible_texts).strip()

        # If soup extraction yielded nothing but we had content, fallback to nh3
        if not clean and str(text).strip():
            return html.unescape(nh3.clean(str(text), tags=set()))

        return html.unescape(clean)
    except Exception as e:
        logger.warning(f"Error cleaning HTML text: {e}")
        return html.unescape(nh3.clean(str(text), tags=set()))


def is_content_complete(content: str | None, threshold: int = 500) -> bool:
    """Heuristic: Is this a full article or just a summary?"""
    if not content:
        return False
    # If it has paragraph tags and decent length, it's likely complete
    if "<p>" in content and len(content) > 200:
        return True
    return len(content) >= threshold


def is_cjk_text(text: str) -> bool:
    """Check if text is primarily East Asian (requires different reading time calc)."""
    if not text.strip():
        return False

    # Remove whitespace to get true character density
    clean_text = WHITESPACE_PATTERN.sub("", text)
    if not clean_text:
        return False

    cjk_chars = len(CJK_PATTERN.findall(text))
    # Threshold: if > 20% of chars are CJK, treat as CJK
    return (cjk_chars / len(clean_text)) > 0.2


def calculate_reading_time(content: str, default_wpm: int = 230, cjk_cpm: int = 300) -> int:
    """
    Calculate reading time in minutes.
    Uses Words Per Minute (WPM) for Western text.
    Uses Characters Per Minute (CPM) for CJK text.
    """
    if not content:
        return 1

    # 1. Strip HTML
    try:
        soup = BeautifulSoup(content, "html.parser")
        text = soup.get_text(separator=" ", strip=True)
    except Exception:
        text = HTML_TAG_PATTERN.sub(" ", content).strip()

    if not text:
        return 1

    # 2. CJK Calculation
    if is_cjk_text(text):
        char_count = len(WHITESPACE_PATTERN.sub("", text))
        return max(1, round(char_count / cjk_cpm))

    # 3. Western Calculation
    # Remove punctuation for more accurate word count
    clean_text = PUNCTUATION_PATTERN.sub(" ", text)
    word_count = len(clean_text.split())
    return max(1, round(word_count / default_wpm))


def normalize_language_code(code: str | None) -> str | None:
    """Standardize language codes to ISO 639-1 (e.g. 'en-US' -> 'en')."""
    if not code:
        return None

    code = code.strip()

    # 1. Regex Extraction of base code
    match = LANG_CODE_PATTERN.match(code)
    candidate = match.group(1).lower() if match else code.lower()

    # 2. Validation via library
    try:
        lang = Lang(candidate)
        if lang.pt1:
            return lang.pt1
    except Exception:
        # Fallback to candidate if it looks like a valid 2-letter code
        if len(candidate) == 2 and candidate.isalpha():
            return candidate

    return None
