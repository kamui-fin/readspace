import json
from typing import Any

import redis.asyncio as redis
import structlog

from app.core.config import get_settings

logger = structlog.get_logger(__name__)


class RedisCache:
    """Redis cache with connection pooling for optimal performance.

    Uses a singleton connection pool to avoid creating new connections on every operation.
    This improves performance by 10-100x compared to creating connections per operation.
    """

    _pool: redis.ConnectionPool | None = None
    _pool_initialized: bool = False

    @classmethod
    async def get_pool(cls) -> redis.ConnectionPool:
        """Get or create connection pool (singleton pattern).

        Returns:
            redis.ConnectionPool: Shared connection pool instance
        """
        if cls._pool is None:
            settings = get_settings()
            cls._pool = redis.ConnectionPool.from_url(
                settings.REDIS_URL,
                encoding="utf-8",
                decode_responses=True,
                max_connections=20,  # Pool size for API server
                socket_keepalive=True,  # Keep connections alive
                socket_connect_timeout=5,  # Connection timeout
                retry_on_timeout=True,  # Retry on timeout
            )
            logger.info("Redis connection pool initialized", max_connections=20)
        return cls._pool

    @classmethod
    async def close_pool(cls) -> None:
        """Close the connection pool. Call this on application shutdown."""
        if cls._pool is not None:
            await cls._pool.disconnect()
            cls._pool = None
            logger.info("Redis connection pool closed")

    async def get(self, key: str) -> Any | None:
        """Get cached value by key.

        Args:
            key: Cache key

        Returns:
            Cached value or None if not found
        """
        try:
            pool = await self.get_pool()
            async with redis.Redis(connection_pool=pool) as client:
                cached_value = await client.get(key)
                if cached_value:
                    logger.debug("Cache hit", key=key)
                    try:
                        return json.loads(cached_value)
                    except json.JSONDecodeError:
                        logger.warning(
                            "Failed to decode JSON from cache, returning raw",
                            key=key,
                            value=cached_value,
                        )
                        return cached_value
                logger.debug("Cache miss", key=key)
                return None
        except redis.RedisError as e:
            logger.error("Redis error during GET", key=key, error=str(e))
            return None
        except Exception as e:
            logger.error("Error getting value from Redis", key=key, error=str(e), exc_info=True)
            return None

    async def set(self, key: str, value: Any, ttl_seconds: int | None = None) -> bool:
        """Set cached value with optional TTL.

        Args:
            key: Cache key
            value: Value to cache (will be JSON serialized)
            ttl_seconds: Time to live in seconds (optional)

        Returns:
            bool: True if successful, False otherwise
        """
        try:
            pool = await self.get_pool()
            async with redis.Redis(connection_pool=pool) as client:
                # Handle Pydantic models that may contain non-JSON serializable types (like URLs)
                if hasattr(value, "model_dump"):
                    # Use Pydantic's model_dump with mode="json" to properly serialize URL objects
                    serialized_value = json.dumps(value.model_dump(mode="json"))
                elif isinstance(value, dict) and any(hasattr(v, "model_dump") for v in value.values() if v is not None):
                    # Handle dictionaries containing Pydantic models
                    serializable_dict = {}
                    for k, v in value.items():
                        if hasattr(v, "model_dump"):
                            serializable_dict[k] = v.model_dump(mode="json")
                        else:
                            serializable_dict[k] = v
                    serialized_value = json.dumps(serializable_dict)
                else:
                    serialized_value = json.dumps(value)

                if ttl_seconds:
                    await client.setex(key, ttl_seconds, serialized_value)
                else:
                    await client.set(key, serialized_value)
                logger.debug("Value set in cache", key=key, ttl_seconds=ttl_seconds)
                return True
        except redis.RedisError as e:
            logger.error("Redis error during SET", key=key, error=str(e))
            return False
        except Exception as e:
            logger.error("Error setting value in Redis", key=key, error=str(e), exc_info=True)
            return False

    async def delete(self, key: str) -> bool:
        """Delete key from cache.

        Args:
            key: Cache key to delete

        Returns:
            bool: True if successful, False otherwise
        """
        try:
            pool = await self.get_pool()
            async with redis.Redis(connection_pool=pool) as client:
                await client.delete(key)
                logger.debug("Key deleted from cache", key=key)
                return True
        except redis.RedisError as e:
            logger.error("Redis error during DELETE", key=key, error=str(e))
            return False
        except Exception as e:
            logger.error("Error deleting key from Redis", key=key, error=str(e), exc_info=True)
            return False

    async def exists(self, key: str) -> bool:
        """Check if key exists in cache.

        Args:
            key: Cache key to check

        Returns:
            bool: True if key exists, False otherwise
        """
        try:
            pool = await self.get_pool()
            async with redis.Redis(connection_pool=pool) as client:
                result = await client.exists(key)
                return bool(result)
        except redis.RedisError as e:
            logger.error("Redis error during EXISTS", key=key, error=str(e))
            return False
        except Exception as e:
            logger.error("Error checking key existence in Redis", key=key, error=str(e), exc_info=True)
            return False
