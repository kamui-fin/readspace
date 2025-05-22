import json
from typing import Any, Optional

import redis.asyncio as redis
import structlog
from app.core.config import get_settings

logger = structlog.get_logger(__name__)
settings = get_settings()

class RedisCache:
    # Remove class-level client, or manage it per-loop if we had a more complex setup.
    # For this fix, we will create a client on each call to _get_client within a task context.
    # _client: Optional[redis.Redis] = None 

    @classmethod
    async def _get_client(cls) -> redis.Redis:
        # Always create a new client for the current event loop
        # This is a simplification. A more robust solution might involve
        # a dictionary to store clients per event loop if RedisCache were a long-lived singleton
        # managing connections for multiple concurrent loops, but for Celery tasks with asyncio.run(),
        # creating a client per task run is more straightforward.
        try:
            client = redis.from_url(
                settings.REDIS_URL, 
                encoding="utf-8", 
                decode_responses=True # Automatically decode responses from bytes to str
            )
            await client.ping() # Verify connection
            # logger.info("Successfully (re)established Redis connection for current task.") # Less noisy log
            return client
        except redis.RedisError as e:
            logger.error("Failed to establish Redis connection for current task", error=str(e), exc_info=True)
            raise ConnectionError(f"Failed to connect to Redis: {str(e)}") from e

    async def get(self, key: str) -> Optional[Any]:
        client = None
        try:
            client = await self._get_client()
            cached_value = await client.get(key)
            if cached_value:
                logger.debug("Cache hit", key=key)
                try:
                    return json.loads(cached_value)
                except json.JSONDecodeError:
                    logger.warning("Failed to decode JSON from cache, returning raw", key=key, value=cached_value)
                    return cached_value
            logger.debug("Cache miss", key=key)
            return None
        except ConnectionError: # Already logged in _get_client or if ping fails
            logger.error("Redis connection error during GET, returning None", key=key)
            return None
        except Exception as e:
            logger.error("Error getting value from Redis", key=key, error=str(e), exc_info=True)
            return None
        finally:
            if client:
                await client.close() # Close the client after the operation

    async def set(self, key: str, value: Any, ttl_seconds: Optional[int] = None) -> bool:
        client = None
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
        finally:
            if client:
                await client.close() # Close the client after the operation

    async def delete(self, key: str) -> bool:
        client = None
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
        finally:
            if client:
                await client.close() # Close the client after the operation
    
    @classmethod
    async def close(cls):
        # This method is now less relevant if clients are created/closed per operation.
        # However, if there were a global client, it would be closed here.
        # For now, we can leave it as a no-op or remove if no global client is ever used.
        logger.info("RedisCache.close() called. Clients are now managed per-operation.")
        # if cls._client:
        #     try:
        #         await cls._client.close()
        #         logger.info("Redis client connection closed.")
        #     except Exception as e:
        #         logger.error("Error closing Redis client connection", error=str(e), exc_info=True)
        #     cls._client = None

# Global instance for convenience, can be injected or accessed via class methods
# redis_cache_instance = RedisCache()

# Optional: Add lifespan events to FastAPI app to manage Redis connection pool
# async def startup_redis_cache():
#     await RedisCache._get_client() # Initialize on startup

# async def shutdown_redis_cache():
#     await RedisCache.close() 