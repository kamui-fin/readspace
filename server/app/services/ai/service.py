"""
Functional AI Service: Summarization and Translation.
"""

import hashlib
import re
from functools import lru_cache

import structlog
from google import genai
from google.genai import types

from app.core import redis_cache
from app.core.config import get_settings
from app.core.constants import AI_CACHE_TTL, MAX_AI_INPUT_CHARS
from app.services.ai.prompts import SUMMARY_SYSTEM_PROMPT, get_translation_system_prompt
from app.typing.common import LanguageCode
from app.utils.text import clean_html_text

logger = structlog.get_logger(__name__)


@lru_cache(maxsize=1)
def _get_client() -> genai.Client | None:
    """Lazy load the Gemini client."""
    settings = get_settings()
    if settings.ENABLE_AI and settings.GEMINI_API_KEY:
        try:
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
        max_tokens=400,
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


# --- Internal Helpers ---


async def _call_gemini(
    client: genai.Client,
    prompt: str,
    system_instruction: str,
    max_tokens: int,
    temperature: float,
) -> str | None:
    """Raw API call wrapper."""
    settings = get_settings()
    try:
        response = client.models.generate_content(
            model=settings.GEMINI_MODEL,
            contents=prompt,
            config=types.GenerateContentConfig(
                system_instruction=system_instruction,
                temperature=temperature,
                max_output_tokens=max_tokens,
            ),
        )
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
