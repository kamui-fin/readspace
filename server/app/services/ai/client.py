"""Shared Gemini client factory for the Gemini Developer API (AI Studio)."""

from functools import lru_cache

import structlog
from google import genai

from app.core.config import get_settings

logger = structlog.get_logger(__name__)


@lru_cache(maxsize=1)
def get_gemini_client() -> genai.Client | None:
    """Lazy load the Gemini Developer API client, shared by all AI call sites."""
    settings = get_settings()
    if not settings.ENABLE_AI or not settings.GEMINI_API_KEY:
        return None
    try:
        return genai.Client(api_key=settings.GEMINI_API_KEY)
    except Exception as e:
        logger.error("Failed to initialize Gemini client", error=str(e))
        return None
