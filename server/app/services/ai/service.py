"""
Functional AI Service: Summarization and Translation.
"""

import hashlib
import json
import re
from difflib import SequenceMatcher
from functools import lru_cache
from typing import Any

import nh3
import structlog
from google import genai
from google.genai import types

from app.core import redis_cache
from app.core.config import get_settings
from app.core.constants import AI_CACHE_TTL, HIGHLIGHT_TEXT_INTEGRITY_MIN_SIMILARITY, MAX_AI_INPUT_CHARS
from app.services.ai.prompts import SUMMARY_SYSTEM_PROMPT, get_highlight_system_prompt, get_translation_system_prompt
from app.typing.common import LanguageCode
from app.utils.text import clean_html_text

# nh3 allowlist for AI Highlights output: article HTML tags plus <mark> for highlights.
# Kept intentionally permissive on structure (the model must not alter it) but strict on
# attributes to close off prompt-injection attempts to emit script/style/event-handler content.
HIGHLIGHT_ALLOWED_TAGS = {
    "a",
    "b",
    "blockquote",
    "br",
    "code",
    "div",
    "em",
    "figcaption",
    "figure",
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
    "mark",
    "ol",
    "p",
    "pre",
    "span",
    "strong",
    "sub",
    "sup",
    "table",
    "tbody",
    "td",
    "tfoot",
    "th",
    "thead",
    "tr",
    "u",
    "ul",
}

HIGHLIGHT_ALLOWED_ATTRIBUTES = {
    "a": {"href", "title", "target"},
    "img": {"src", "alt", "title", "width", "height"},
    "mark": {"class", "data-rank"},
    "*": {"class"},
}

logger = structlog.get_logger(__name__)


@lru_cache(maxsize=1)
def _get_client() -> genai.Client | None:
    """Lazy load the Gemini client."""
    settings = get_settings()
    if settings.ENABLE_AI:
        try:
            if settings.GOOGLE_CLOUD_PROJECT:
                return genai.Client(
                    vertexai=True,
                    project=settings.GOOGLE_CLOUD_PROJECT,
                    location=settings.GOOGLE_CLOUD_LOCATION,
                )
            elif settings.GEMINI_API_KEY:
                return genai.Client(api_key=settings.GEMINI_API_KEY)
        except Exception as e:
            logger.error("Failed to initialize Gemini client", error=str(e))
    return None


async def generate_summary(title: str, content: str, article_id: str, language_key: str = "original") -> str | None:
    """Generate a summary with caching."""
    client = _get_client()
    if not client:
        return None

    # 1. Prepare
    clean_text = clean_html_text(content)[:MAX_AI_INPUT_CHARS]

    # 2. Cache Check
    # Cache key based on article_id and language_key, NOT content hash
    # Use readable key format: summary:<article_id>:<language_key>
    cache_key = f"summary:{article_id}:{language_key}"
    if cached := await redis_cache.get(cache_key):
        return cached

    # 3. Generate
    user_prompt = f"Title: {title}\n\nContent: {clean_text}\n\nProvide a summary."

    if language_key and language_key != "original":
        target_lang = _get_lang_name(language_key)
        user_prompt += f" The summary must be in {target_lang}."
    else:
        user_prompt += " The summary must be in the same language as the content."

    result = await _call_gemini(
        client,
        prompt=user_prompt,
        system_instruction=SUMMARY_SYSTEM_PROMPT,
        max_tokens=4000,
        temperature=0.3,
    )

    if result:
        await redis_cache.set(cache_key, result, ttl_seconds=AI_CACHE_TTL)

    return result


async def translate_content(content: str, target_lang_code: str) -> str | None:
    """Translate HTML content with caching."""
    client = _get_client()
    if not client:
        return None

    truncated = content[:MAX_AI_INPUT_CHARS]
    target_lang = _get_lang_name(target_lang_code)

    cache_key = _make_cache_key("translate", f"{target_lang}:{truncated}")
    if cached := await redis_cache.get(cache_key):
        return cached

    result = await _call_gemini(
        client,
        prompt=truncated,
        system_instruction=get_translation_system_prompt(target_lang),
        max_tokens=2000,
        temperature=0.1,
    )

    if result:
        # Cleanup potential markdown fences
        result = re.sub(r"^```(?:html)?\n|\n```$", "", result.strip(), flags=re.MULTILINE)
        await redis_cache.set(cache_key, result, ttl_seconds=AI_CACHE_TTL)
        return result


async def generate_highlights(content: str, article_id: str, language_key: str = "original") -> str | None:
    """Generate AI Highlights (skim mode): the same HTML with <mark> tags inserted, with caching."""
    client = _get_client()
    if not client:
        return None

    truncated = content[:MAX_AI_INPUT_CHARS]

    # Cache key based on article_id and language_key (mirrors generate_summary), NOT content
    # hash — highlights don't vary by "target language" the way translation does, but they do
    # need to be cached independently for a translated view of the same article.
    cache_key = f"highlights:{article_id}:{language_key}"
    if cached := await redis_cache.get(cache_key):
        return cached

    result = await _call_gemini(
        client,
        prompt=truncated,
        system_instruction=get_highlight_system_prompt(),
        max_tokens=6000,
        temperature=0.2,
    )

    if not result:
        return None

    result = re.sub(r"^```(?:html)?\n|\n```$", "", result.strip(), flags=re.MULTILINE)

    if not _highlights_preserve_text(original_html=truncated, candidate_html=result):
        logger.warning("Discarding AI highlights: text integrity check failed", article_id=article_id)
        return None

    # The model is only asked to add data-rank (see get_highlight_system_prompt) — it can't be
    # trusted to also remember a literal "rs-highlight" class on every tag, and the frontend CSS
    # keys off that class, so stamp it on here rather than relying on the model to include it.
    result = _add_highlight_class(result)

    sanitized = nh3.clean(
        result,
        tags=HIGHLIGHT_ALLOWED_TAGS,
        attributes=HIGHLIGHT_ALLOWED_ATTRIBUTES,
        link_rel="noopener noreferrer",
    )

    await redis_cache.set(cache_key, sanitized, ttl_seconds=AI_CACHE_TTL)
    return sanitized


def _inject_highlight_class(match: re.Match[str]) -> str:
    """re.sub callback: add class="rs-highlight" to a <mark> tag's attributes if missing."""
    attrs = match.group(1)
    class_match = re.search(r'class\s*=\s*"([^"]*)"', attrs)
    if not class_match:
        return f'<mark class="rs-highlight"{attrs}>'
    if "rs-highlight" in class_match.group(1).split():
        return match.group(0)
    new_attrs = attrs[: class_match.start(1)] + class_match.group(1) + " rs-highlight" + attrs[class_match.end(1) :]
    return f"<mark{new_attrs}>"


def _add_highlight_class(html_content: str) -> str:
    """Ensure every <mark> tag carries class="rs-highlight", adding it if missing and
    appending to an existing class attribute otherwise (the model is never asked to add it)."""
    return re.sub(r"<mark((?:\s+[^<>]*)?)>", _inject_highlight_class, html_content)


def _strip_mark_tags(html_content: str) -> str:
    """Remove <mark>/</mark> wrapper tags while leaving their contents in place."""
    return re.sub(r"</?mark[^>]*>", "", html_content)


def _highlights_preserve_text(original_html: str, candidate_html: str) -> bool:
    """
    Word-level integrity check: the model's response must contain the same words as the
    original, modulo the <mark> tags it was asked to insert. Guards against hallucinated
    rewrites reaching the reader (see PRD §3.4) — a missing paragraph or reworded sentence
    would silently corrupt the article, unlike a bad translation, which is obvious.
    """
    original_words = clean_html_text(original_html).split()
    candidate_words = clean_html_text(_strip_mark_tags(candidate_html)).split()

    if not original_words or not candidate_words:
        return False

    similarity = SequenceMatcher(None, original_words, candidate_words).ratio()
    return similarity >= HIGHLIGHT_TEXT_INTEGRITY_MIN_SIMILARITY


def get_metadata_translation_system_prompt(target_lang: str) -> str:
    return (
        f"You are a professional translator. Translate article metadata (title, description, "
        f"and tags) to {target_lang}.\n"
        "Return ONLY a JSON object matching this schema:\n"
        "{\n"
        '  "title": "translated title",\n'
        '  "description": "translated description",\n'
        '  "tags": ["translated tag 1", "translated tag 2"]\n'
        "}\n"
        "Do not include any explanation, markdown formatting (like ```json), or extra text. Output only raw JSON."
    )


async def translate_metadata(
    title: str,
    description: str,
    tags: list[str],
    target_lang_code: str,
) -> dict[str, Any]:
    """Translate title, description, and tags concurrently in a single LLM call with caching."""
    client = _get_client()
    if not client:
        return {"title": title, "description": description, "tags": tags}

    # Short-circuit if nothing to translate
    if not title and not description and not tags:
        return {"title": title, "description": description, "tags": tags}

    target_lang = _get_lang_name(target_lang_code)

    # Create request payload for caching
    input_data = {
        "title": title or "",
        "description": description or "",
        "tags": tags or [],
    }
    serialized_input = json.dumps(input_data, sort_keys=True, ensure_ascii=False)

    cache_key = _make_cache_key("translate_metadata", f"{target_lang}:{serialized_input}")
    if cached := await redis_cache.get(cache_key):
        try:
            return json.loads(cached)
        except Exception as e:
            logger.debug("Failed to deserialize cached translation metadata", error=str(e))

    system_prompt = get_metadata_translation_system_prompt(target_lang)
    result = await _call_gemini(
        client,
        prompt=serialized_input,
        system_instruction=system_prompt,
        max_tokens=1000,
        temperature=0.1,
    )

    output = {"title": title, "description": description, "tags": tags}
    if result:
        # Cleanup potential markdown fences
        clean_result = re.sub(r"^```(?:json)?\n|\n```$", "", result.strip(), flags=re.MULTILINE)
        try:
            parsed = json.loads(clean_result)
            if isinstance(parsed, dict):
                output["title"] = parsed.get("title", title)
                output["description"] = parsed.get("description", description)
                output["tags"] = parsed.get("tags", tags)
                # Ensure tags is a list of strings
                if not isinstance(output["tags"], list):
                    output["tags"] = tags
                else:
                    output["tags"] = [str(t) for t in output["tags"]]

            await redis_cache.set(cache_key, json.dumps(output, ensure_ascii=False), ttl_seconds=AI_CACHE_TTL)
        except Exception as e:
            logger.warn("Failed to parse metadata translation response", error=str(e), raw_response=result)

    return output


# --- Internal Helpers ---


async def _call_gemini(
    client: genai.Client,
    prompt: str,
    system_instruction: str,
    max_tokens: int,
    temperature: float,
) -> str | None:
    """Raw API call wrapper using the fast processing model."""
    settings = get_settings()
    try:
        response = client.models.generate_content(
            model=settings.GEMINI_FAST_MODEL,
            contents=prompt,
            config=types.GenerateContentConfig(
                system_instruction=system_instruction,
                temperature=temperature,
                max_output_tokens=max_tokens,
            ),
        )

        if response.candidates and response.candidates[0].content and response.candidates[0].content.parts:
            parts = response.candidates[0].content.parts
            text_parts = [part.text for part in parts if hasattr(part, "text") and part.text]
            if text_parts:
                return "".join(text_parts).strip()

        return response.text.strip() if response.text else None
    except Exception as e:
        logger.error("Gemini API error", error=str(e))
        return None


def _make_cache_key(prefix: str, data: str) -> str:
    hashed = hashlib.sha256(data.encode()).hexdigest()[:16]
    return f"ai:{prefix}:{hashed}"


def _get_lang_name(lang_code: str) -> str:
    """Convert ISO 639-1 language code to language name."""
    try:
        return LanguageCode(lang_code.lower()).display_name
    except ValueError:
        return lang_code
