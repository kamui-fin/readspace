"""Cache utilities for AI service."""

import hashlib

import structlog

from app.core.constants import AI_CACHE_TTL
from app.core.redis_cache import RedisCache

logger = structlog.get_logger(__name__)


class AICacheManager:
    """Manages caching for AI operations."""

    def __init__(self) -> None:
        self.redis_cache = RedisCache()

    def _generate_content_hash(self, content: str, extra_params: str = "") -> str:
        """Generate a hash for content-based caching."""
        combined = f"{content}:{extra_params}"
        return hashlib.sha256(combined.encode()).hexdigest()[:16]

    def get_summary_cache_key(self, title: str, content: str) -> str:
        """Generate cache key for article summary."""
        content_hash = self._generate_content_hash(f"{title}:{content}")
        return f"ai:summary:{content_hash}"

    def get_translation_cache_key(self, content: str, target_language: str) -> str:
        """Generate cache key for article translation."""
        content_hash = self._generate_content_hash(content, target_language)
        return f"ai:translation:{target_language}:{content_hash}"

    async def get_cached(self, cache_key: str) -> str | None:
        """Get cached value."""
        try:
            cached_value = await self.redis_cache.get(cache_key)
            if cached_value:
                logger.debug("Cache hit", cache_key=cache_key)
                return cached_value
        except Exception as e:
            logger.warning("Failed to check cache", error=str(e))
        return None

    async def set_cached(self, cache_key: str, value: str, ttl_seconds: int = AI_CACHE_TTL) -> None:
        """Set cached value."""
        try:
            await self.redis_cache.set(cache_key, value, ttl_seconds=ttl_seconds)
            logger.debug("Value cached successfully", cache_key=cache_key)
        except Exception as e:
            logger.warning("Failed to cache value", error=str(e))
