import html
import re
from typing import Any

import nh3
import structlog
from bs4 import BeautifulSoup
from iso639 import Lang

from app.core.constants import MIN_CONTENT_LENGTH

logger = structlog.get_logger(__name__)

# CJK covers Chinese, Japanese, Korean ranges
CJK_PATTERN = re.compile(r"[\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\u4e00-\u9fff\uac00-\ud7af\uff00-\uffef]")
WHITESPACE_PATTERN = re.compile(r"\s+")
HTML_TAG_PATTERN = re.compile(r"<[^>]*>")
PUNCTUATION_PATTERN = re.compile(r"[^\w\s]")
SENTENCE_BOUNDARY_PATTERN = re.compile(r"(?<=[.!?])\s+")

# Elements whose text never belongs in a prose excerpt
EXCERPT_SKIPPED_TAGS = ["script", "style", "noscript", "figure", "picture", "svg", "iframe"]
# Block elements that must be separated by whitespace once tags are stripped
EXCERPT_BLOCK_TAGS = ["p", "div", "section", "article", "li", "blockquote", "h1", "h2", "h3", "h4", "h5", "h6", "br"]

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


def build_excerpt(content: str | None, max_length: int, min_length: int) -> str:
    """
    Build a short plain-text preview from HTML content.

    Takes whole leading sentences until the excerpt reaches ``min_length`` (so a tiny
    opener like "Hi." gets company). If even the first sentence is longer than
    ``max_length``, the text is cut on a word boundary and ellipsised.

    Args:
        content: HTML (or plain text) article body.
        max_length: Maximum excerpt length in characters.
        min_length: Stop adding sentences once the excerpt is at least this long.

    Returns:
        The excerpt, or an empty string when the content has no readable text.
    """
    if not content:
        return ""

    soup = BeautifulSoup(content, "html.parser")
    for tag in soup.find_all(EXCERPT_SKIPPED_TAGS):
        tag.decompose()
    for tag in soup.find_all(EXCERPT_BLOCK_TAGS):
        tag.insert_after(" ")
    text = WHITESPACE_PATTERN.sub(" ", soup.get_text()).strip()
    if not text:
        return ""

    excerpt = ""
    for sentence in SENTENCE_BOUNDARY_PATTERN.split(text):
        candidate = f"{excerpt} {sentence}".strip()
        if len(candidate) > max_length:
            break
        excerpt = candidate
        if len(excerpt) >= min_length:
            break

    if excerpt:
        return excerpt
    return text[: max_length - 1].rsplit(" ", 1)[0].rstrip(",;:") + "…"


def visible_text_length(content: str | None) -> int:
    """
    Length of the readable text in ``content``, ignoring markup.

    Raw HTML length is a poor proxy for how much article a feed actually gave us: a
    200-character teaser wrapped in tracking pixels and share widgets can run to
    several kilobytes of markup.
    """
    if not content:
        return 0

    soup = BeautifulSoup(content, "html.parser")
    for tag in soup.find_all(EXCERPT_SKIPPED_TAGS):
        tag.decompose()
    return len(WHITESPACE_PATTERN.sub(" ", soup.get_text(separator=" ")).strip())


def is_content_complete(content: str | None, threshold: int = MIN_CONTENT_LENGTH) -> bool:
    """
    Heuristic: is this the full article, or just the feed's teaser?

    Measures *visible* text against ``threshold``. Previously any content containing a
    ``<p>`` tag and more than 200 characters of markup counted as complete, which
    classified nearly every truncated "…Read more" teaser as a full article and meant
    full-text extraction almost never ran.
    """
    return visible_text_length(content) >= threshold


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
