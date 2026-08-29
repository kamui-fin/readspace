"""
Functional AI Service: Summarization and Translation.
"""

import hashlib
import json
import re
from functools import lru_cache
from typing import Any

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
