"""
Functional AI Service: Summarization and Translation.
"""

import hashlib
import re
import time
import structlog
from google import genai
from google.genai import types

from app.core.config import get_settings
from app.core.constants import AI_CACHE_TTL
from app.core import redis_cache
from app.services.ai.prompts import SUMMARY_SYSTEM_PROMPT, get_translation_system_prompt

logger = structlog.get_logger(__name__)

# Module-level client singleton
_client: genai.Client | None = None


def _get_client() -> genai.Client | None:
    """Lazy load the Gemini client."""
    global _client
    if _client is None:
        settings = get_settings()
        if settings.ENABLE_AI and settings.GEMINI_API_KEY:
            try:
                _client = genai.Client(api_key=settings.GEMINI_API_KEY)
            except Exception as e:
                logger.error("Failed to initialize Gemini client", error=str(e))
    return _client


async def generate_summary(title: str, content: str) -> str | None:
    """Generate a summary with caching."""
    client = _get_client()
    if not client:
        return None

    # 1. Prepare
    clean_text = _strip_html(content)[:15000]

    # 2. Cache Check
    cache_key = _make_cache_key("summary", f"{title}:{clean_text}")
    if cached := await redis_cache.get(cache_key):
        return cached

    # 3. Generate
    user_prompt = f"Title: {title}\n\nContent: {clean_text}\n\nProvide a summary in the same language as the content."

    result = await _call_gemini(
        client, prompt=user_prompt, system_instruction=SUMMARY_SYSTEM_PROMPT, max_tokens=400, temperature=0.3
    )

    if result:
        await redis_cache.set(cache_key, result, ttl_seconds=AI_CACHE_TTL)

    return result


async def translate_content(content: str, target_lang_code: str) -> str | None:
    """Translate HTML content with caching."""
    client = _get_client()
    if not client:
        return None

    truncated = content[:12000]
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
    client: genai.Client, prompt: str, system_instruction: str, max_tokens: int, temperature: float
) -> str | None:
    """Raw API call wrapper."""
    settings = get_settings()
    try:
        response = client.models.generate_content(
            model=settings.GEMINI_MODEL,
            contents=prompt,
            config=types.GenerateContentConfig(
                system_instruction=system_instruction, temperature=temperature, max_output_tokens=max_tokens
            ),
        )
        return response.text.strip() if response.text else None
    except Exception as e:
        logger.error("Gemini API error", error=str(e))
        return None


def _make_cache_key(prefix: str, data: str) -> str:
    hashed = hashlib.sha256(data.encode()).hexdigest()[:16]
    return f"ai:{prefix}:{hashed}"


def _strip_html(html: str) -> str:
    text = re.sub(r"<[^>]+>", " ", html)
    return re.sub(r"\s+", " ", text).strip()


def _get_lang_name(code: str) -> str:
    params = {
        "es": "Spanish",
        "fr": "French",
        "de": "German",
        "zh": "Chinese",
        "jp": "Japanese",
        "ru": "Russian",
        "pt": "Portuguese",
    }
    return params.get(code.lower(), code)
