from functools import lru_cache
from typing import TypedDict

import httpx
import structlog

from app.core import redis_cache
from app.core.constants import (
    BROWSER_USER_AGENT,
    DEFAULT_RSS_TIMEOUT,
    FEED_CONTENT_CACHE_PREFIX,
    HTTP_CLIENT_KEEPALIVE_EXPIRY,
    HTTP_CLIENT_MAX_KEEPALIVE,
    HTTP_CLIENT_POOL_LIMITS,
)
from app.utils.urls import transform_rsshub_url

logger = structlog.get_logger(__name__)

# 30 minutes cache for feed content
FEED_CACHE_TTL = 1800
# 50MB limit for feed content
MAX_FEED_SIZE_BYTES = 50 * 1024 * 1024


class FetchResult(TypedDict):
    content: str
    headers: dict[str, str]
    status_code: int
    not_modified: bool
    error: str | None
    final_url: str | None
    permanent_redirect: bool


@lru_cache(maxsize=1)
def _get_client() -> httpx.AsyncClient:
    """Cached singleton HTTP client."""
    return httpx.AsyncClient(
        limits=httpx.Limits(
            max_connections=HTTP_CLIENT_POOL_LIMITS,
            max_keepalive_connections=HTTP_CLIENT_MAX_KEEPALIVE,
            keepalive_expiry=HTTP_CLIENT_KEEPALIVE_EXPIRY,
        ),
        follow_redirects=True,
        timeout=DEFAULT_RSS_TIMEOUT,
        headers={
            "User-Agent": BROWSER_USER_AGENT,
            "Accept-Encoding": "gzip, deflate, br",
        },
        verify=False,  # noqa: S501
    )


def _build_error_result(status_code: int, error_msg: str) -> FetchResult:
    """Helper to construct uniform error responses."""
    return {
        "content": "",
        "headers": {},
        "status_code": status_code,
        "not_modified": False,
        "error": error_msg,
        "final_url": None,
        "permanent_redirect": False,
    }


def _is_feed_content_type(content_type: str) -> bool:
    """Check if content type indicates a feed."""
    ct = content_type.lower()
    return (
        "application/rss+xml" in ct
        or "application/atom+xml" in ct
        or "application/xml" in ct
        or "text/xml" in ct
    )


async def fetch_feed_content(
    url: str,
    etag: str | None = None,
    last_modified: str | None = None,
    timeout: int = DEFAULT_RSS_TIMEOUT,
    if_modified_since_timestamp: int | None = None,
) -> FetchResult:
    """Fetch feed content with conditional headers, caching, and delta support."""

    # 1. Check Cache (only if not conditional fetch, or maybe we can cache conditional too?)
    # If we are doing a refresh (etag/last_modified provided), we probably want to hit the server
    # to check for updates. But if we are just adding a feed, we might hit cache.
    # However, the user said "setup redis caching for GET requests in the fetcher".
    # If we cache the *result* of a fetch, we can return it.
    # But if the caller provides ETag, they want to know if it changed.
    # If we return cached content, we are effectively saying "it hasn't changed since we last cached it".
    # This is fine for 30 mins.

    cache_key = f"{FEED_CONTENT_CACHE_PREFIX}{url}"

    # Only use cache if NOT doing a conditional check (or if we decide 30min is acceptable lag even for refreshes)
    # The user said "ttl 30 min to avoid hammering feeds". This implies we should respect the cache
    # even for refreshes, effectively rate limiting our checks to once every 30 mins per feed.
    if not etag and not last_modified:
        cached = await redis_cache.get(cache_key)
        if cached:
            logger.info("Feed fetch cache hit", url=url)
            return cached

    fetch_url = transform_rsshub_url(url)

    # Build conditional headers dynamically
    headers = {
        k: v
        for k, v in {
            "If-None-Match": etag,
            "If-Modified-Since": last_modified,
            "A-IM": "feed" if if_modified_since_timestamp else None,
        }.items()
        if v
    }

    try:
        # Stream response to check size
        client = _get_client()
        async with client.stream(
            "GET", fetch_url, headers=headers, timeout=timeout
        ) as response:

            # Status checks
            is_error = response.status_code >= 400
            is_not_modified = response.status_code == 304

            if is_error:
                logger.warning(
                    "Feed fetch failed", url=url, status=response.status_code
                )
                return _build_error_result(
                    response.status_code, f"HTTP {response.status_code}"
                )

            if is_not_modified:
                return {
                    "content": "",
                    "headers": {k.lower(): v for k, v in response.headers.items()},
                    "status_code": 304,
                    "not_modified": True,
                    "error": None,
                    "final_url": str(response.url),
                    "permanent_redirect": False,
                }

            # Check Content Length header if present
            if "content-length" in response.headers:
                try:
                    if int(response.headers["content-length"]) > MAX_FEED_SIZE_BYTES:
                        logger.warning(
                            "Feed too large (header)",
                            url=url,
                            size=response.headers["content-length"],
                        )
                        return _build_error_result(413, "Feed too large")
                except ValueError:
                    pass

            # Read content with size limit
            body_parts = []
            bytes_read = 0
            async for chunk in response.aiter_bytes():
                bytes_read += len(chunk)
                if bytes_read > MAX_FEED_SIZE_BYTES:
                    logger.warning("Feed too large (stream)", url=url, bytes=bytes_read)
                    return _build_error_result(413, "Feed too large")
                body_parts.append(chunk)

            content_bytes = b"".join(body_parts)

            # Decode content
            # httpx usually handles this but since we streamed, we need to decode manually or use response.encoding
            # We can try to decode using the charset in Content-Type or default to utf-8
            encoding = response.encoding or "utf-8"
            try:
                content = content_bytes.decode(encoding)
            except LookupError:
                # Fallback to utf-8 if encoding is invalid
                content = content_bytes.decode("utf-8", errors="replace")
            except UnicodeDecodeError:
                # Fallback to latin-1 or just replace
                content = content_bytes.decode("utf-8", errors="replace")

            # Content Type Detection
            content_type = response.headers.get("content-type", "").lower()

            # If it's HTML, check if it's a lying feed
            if "text/html" in content_type:
                # Check for XML signature
                stripped_start = content[:1000].strip()
                if not (
                    stripped_start.startswith("<?xml")
                    or "<rss" in stripped_start
                    or "<feed" in stripped_start
                ):
                    # It's likely real HTML, not a feed
                    # But we don't error here, we just return it.
                    # The parser will fail if it's not a feed.
                    # Or we could return a specific error to avoid parsing overhead?
                    # User said: "Also accept feeds that lie and return text/html"
                    # So we must pass it through.
                    pass

            result: FetchResult = {
                "content": content,
                "headers": {k.lower(): v for k, v in response.headers.items()},
                "status_code": response.status_code,
                "not_modified": False,
                "error": None,
                "final_url": str(response.url),
                "permanent_redirect": any(
                    h.status_code in (301, 308) for h in response.history
                ),
            }

            # Cache successful results (only if not conditional? or always?)
            # If we cache, we should cache the whole result including headers
            if response.status_code == 200:
                await redis_cache.set(cache_key, result, ttl_seconds=FEED_CACHE_TTL)

            return result

    except httpx.TimeoutException:
        logger.warning("Feed fetch timed out", url=url)
        return _build_error_result(408, "Timeout")

    except Exception as e:
        logger.error("Feed fetch error", url=url, error=str(e))
        return _build_error_result(500, str(e))
