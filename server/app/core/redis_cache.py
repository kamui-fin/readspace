"""
Functional Redis Cache interface.
"""

from typing import Any

import orjson
import redis.asyncio as aioredis
import structlog

from app.core.config import get_settings

logger = structlog.get_logger(__name__)

# Global pool singleton
_pool: aioredis.ConnectionPool | None = None


def get_pool() -> aioredis.ConnectionPool:
    """Get or create the global connection pool."""
    global _pool
    if _pool is None:
        settings = get_settings()
        if not settings.REDIS_URL:
            # Fallback or strict error depending on your needs
            raise ValueError("REDIS_URL is not configured")

        _pool = aioredis.ConnectionPool.from_url(
            settings.REDIS_URL,
            encoding="utf-8",
            decode_responses=True,
            max_connections=50,
            socket_keepalive=True,
            socket_connect_timeout=5,
            retry_on_timeout=True,
        )
        logger.info("Redis connection pool initialized")
    return _pool


async def close_pool() -> None:
    """Close the global connection pool."""
    global _pool
    if _pool is not None:
        await _pool.disconnect()
        _pool = None
        logger.info("Redis connection pool closed")


async def get(key: str) -> Any | None:
    """Retrieve a value from cache."""
    try:
        pool = get_pool()
        async with aioredis.Redis(connection_pool=pool) as client:
            val = await client.get(key)
            if val:
                try:
                    return orjson.loads(val)
                except orjson.JSONDecodeError:
                    return val
            return None
    except Exception as e:
        logger.error("Redis GET failed", key=key, error=str(e))
        return None


async def set(key: str, value: Any, ttl_seconds: int | None = None) -> bool:
    """Set a value in cache."""
    try:
        pool = get_pool()
        async with aioredis.Redis(connection_pool=pool) as client:
            # orjson handles datetime, UUID, Enum, Decimal, and Pydantic models automatically
            serialized = orjson.dumps(value).decode("utf-8")

            if ttl_seconds:
                await client.setex(key, ttl_seconds, serialized)
            else:
                await client.set(key, serialized)
            return True
    except Exception as e:
        logger.error("Redis SET failed", key=key, error=str(e))
        return False


async def delete(key: str) -> bool:
    """Delete a key."""
    try:
        pool = get_pool()
        async with aioredis.Redis(connection_pool=pool) as client:
            await client.delete(key)
            return True
    except Exception as e:
        logger.error("Redis DELETE failed", key=key, error=str(e))
        return False


async def exists(key: str) -> bool:
    """Check if key exists."""
    try:
        pool = get_pool()
        async with aioredis.Redis(connection_pool=pool) as client:
            return bool(await client.exists(key))
    except Exception as e:
        logger.error("Redis EXISTS failed", key=key, error=str(e))
        return False
