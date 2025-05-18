import json
from typing import Any, Optional

import redis.asyncio as redis
import structlog
from app.core.config import get_settings

logger = structlog.get_logger(__name__)
settings = get_settings()

class RedisCache:
    _client: Optional[redis.Redis] = None

    @classmethod
    async def _get_client(cls) -> redis.Redis:
        if cls._client is None or not cls._client.is_connected():
            try:
                cls._client = redis.from_url(
                    settings.REDIS_URL, 
                    encoding="utf-8", 
                    decode_responses=True # Automatically decode responses from bytes to str
                )
                await cls._client.ping() # Verify connection
                logger.info("Successfully connected to Redis server.")
            except redis.RedisError as e:
                logger.error("Failed to connect to Redis server", error=str(e), exc_info=True)
                # In a real app, might want to handle this more gracefully (e.g. retry, circuit breaker)
                # For now, re-raise or return None to indicate failure if needed by callers
                raise ConnectionError(f"Failed to connect to Redis: {str(e)}") from e
        return cls._client

    async def get(self, key: str) -> Optional[Any]:
        try:
            client = await self._get_client()
            cached_value = await client.get(key)
            if cached_value:
                logger.debug("Cache hit", key=key)
                try:
                    return json.loads(cached_value)
                except json.JSONDecodeError:
                    logger.warning("Failed to decode JSON from cache, returning raw", key=key, value=cached_value)
                    return cached_value # Or None, or re-raise, depending on expected stored value type
            logger.debug("Cache miss", key=key)
            return None
        except ConnectionError:
            logger.error("Redis connection error during GET, returning None", key=key)
            return None # Act as if cache miss if Redis is down
        except Exception as e:
            logger.error("Error getting value from Redis", key=key, error=str(e), exc_info=True)
            return None # Act as if cache miss on other errors

    async def set(self, key: str, value: Any, ttl_seconds: Optional[int] = None) -> bool:
        try:
            client = await self._get_client()
            serialized_value = json.dumps(value)
            if ttl_seconds:
                await client.setex(key, ttl_seconds, serialized_value)
            else:
                await client.set(key, serialized_value)
            logger.debug("Value set in cache", key=key, ttl_seconds=ttl_seconds)
            return True
        except ConnectionError:
            logger.error("Redis connection error during SET, operation failed", key=key)
            return False
        except Exception as e:
            logger.error("Error setting value in Redis", key=key, error=str(e), exc_info=True)
            return False

    async def delete(self, key: str) -> bool:
        try:
            client = await self._get_client()
            await client.delete(key)
            logger.debug("Key deleted from cache", key=key)
            return True
        except ConnectionError:
            logger.error("Redis connection error during DELETE, operation failed", key=key)
            return False
        except Exception as e:
            logger.error("Error deleting key from Redis", key=key, error=str(e), exc_info=True)
            return False

    @classmethod
    async def close(cls):
        if cls._client:
            try:
                await cls._client.close()
                logger.info("Redis client connection closed.")
            except Exception as e:
                logger.error("Error closing Redis client connection", error=str(e), exc_info=True)
            cls._client = None

# Global instance for convenience, can be injected or accessed via class methods
# redis_cache_instance = RedisCache()

# Optional: Add lifespan events to FastAPI app to manage Redis connection pool
# async def startup_redis_cache():
#     await RedisCache._get_client() # Initialize on startup

# async def shutdown_redis_cache():
#     await RedisCache.close() 