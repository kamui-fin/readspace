"""Feed fetching service with caching and conditional requests."""

from typing import Any

import httpx
import structlog

from app.core.redis_cache import RedisCache
from app.utils.rsshub_url_transformer import transform_rsshub_url

logger = structlog.get_logger(__name__)

DEFAULT_RSS_TIMEOUT = 180


class FeedFetcher:
    """Handles HTTP fetching of RSS/Atom feeds with caching and conditional requests."""

    def __init__(self, redis_cache: RedisCache):
        self.redis_cache = redis_cache

    async def fetch_content(
        self,
        url: str,
        etag: str | None = None,
        last_modified: str | None = None,
        timeout_seconds: int | None = None,
    ) -> dict[str, Any]:
        """Fetch feed content using httpx with ETag and Last-Modified headers, using cache."""
        # Transform rsshub:// URLs to actual HTTP URLs
        actual_url = transform_rsshub_url(url)

        cache_key = f"feed_content:{url}"
        cached_data = await self.redis_cache.get(cache_key)

        timeout = timeout_seconds if timeout_seconds is not None else DEFAULT_RSS_TIMEOUT
        request_headers = self._build_request_headers(etag, last_modified, cached_data)

        try:
            return await self._make_http_request(actual_url, request_headers, timeout, cache_key)
        except httpx.ConnectTimeout:
            return await self._handle_timeout_error(url)
        except httpx.ReadTimeout:
            return await self._handle_timeout_error(url)
        except httpx.HTTPStatusError as exc:
            return await self._handle_http_error(exc, actual_url)
        except Exception as exc:
            return await self._handle_unexpected_error(exc, actual_url)

    def _build_request_headers(
        self, etag: str | None, last_modified: str | None, cached_data: dict | None
    ) -> dict[str, str]:
        """Build HTTP request headers including conditional request headers."""
        headers = {"User-Agent": "Mozilla/5.0 (compatible; Readspace/1.0; +https://readspace.app/bot)"}

        if etag:
            headers["If-None-Match"] = etag
        if last_modified:
            headers["If-Modified-Since"] = last_modified

        # Use cached headers if no specific ones are provided
        if cached_data and not (etag or last_modified):
            cached_headers = cached_data.get("headers", {})
            if cached_headers.get("ETag"):
                headers["If-None-Match"] = cached_headers["ETag"]
            if cached_headers.get("Last-Modified"):
                headers["If-Modified-Since"] = cached_headers["Last-Modified"]

        return headers

    async def _make_http_request(
        self, url: str, headers: dict[str, str], timeout: float, cache_key: str
    ) -> dict[str, Any]:
        """Make the actual HTTP request and handle the response."""
        async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
            response = await client.get(url, headers=headers)

        response_headers_dict = {k.lower(): v for k, v in response.headers.items()}

        if response.status_code == 304:  # Not Modified
            logger.info(
                "Feed not modified (304), serving from cache",
                url=url,
                etag=headers.get("If-None-Match"),
                last_modified=headers.get("If-Modified-Since"),
            )
            cached_data = await self.redis_cache.get(cache_key)
            return {
                "content": cached_data.get("content", "") if cached_data else "",
                "headers": cached_data.get("headers", {}) if cached_data else {},
                "not_modified": True,
                "status_code": 304,
            }

        response.raise_for_status()  # Raise exception for HTTP errors

        content = response.text
        feed_data = {
            "content": content,
            "headers": response_headers_dict,
            "not_modified": False,
            "status_code": response.status_code,
        }

        # Cache the successful response
        await self.redis_cache.set(cache_key, feed_data, 15 * 60)  # 15 minutes
        logger.info("Feed fetched and cached successfully", url=url, status=response.status_code)

        return feed_data

    async def _handle_timeout_error(self, url: str) -> dict[str, Any]:
        """Handle timeout errors."""
        logger.warning("Timeout while fetching feed", url=url, timeout=DEFAULT_RSS_TIMEOUT)
        return {
            "content": "",
            "headers": {},
            "error": "timeout",
            "status_code": 408,
        }

    async def _handle_http_error(self, exc: httpx.HTTPStatusError, url: str) -> dict[str, Any]:
        """Handle HTTP status errors."""
        logger.warning(
            "HTTP error while fetching feed",
            url=url,
            status_code=exc.response.status_code,
        )
        return {
            "content": "",
            "headers": {},
            "error": f"http_{exc.response.status_code}",
            "status_code": exc.response.status_code,
        }

    async def _handle_unexpected_error(self, exc: Exception, url: str) -> dict[str, Any]:
        """Handle unexpected errors."""
        logger.error(
            "Unexpected error while fetching feed",
            url=url,
            error=str(exc),
            exc_info=True,
        )
        return {
            "content": "",
            "headers": {},
            "error": "network_error",
            "status_code": 500,
        }
