import asyncio
import ssl
from typing import TypedDict

import aiohttp
import structlog

from app.core import redis_cache
from app.core.constants import (
    BROWSER_USER_AGENT,
    DEFAULT_RSS_TIMEOUT,
    FEED_CONTENT_CACHE_PREFIX,
    HTTP_CLIENT_POOL_LIMITS,
)
from app.utils.urls import transform_rsshub_url

logger = structlog.get_logger(__name__)

# 30 minutes cache for feed content
FEED_CACHE_TTL = 1800
# 50MB limit for feed content
MAX_FEED_SIZE_BYTES = 50 * 1024 * 1024

_session: aiohttp.ClientSession | None = None
_session_loop: asyncio.AbstractEventLoop | None = None

async def _get_client_session() -> aiohttp.ClientSession:
    """Get or create a shared aiohttp.ClientSession bound to the current event loop."""
    global _session, _session_loop
    current_loop = asyncio.get_running_loop()
    
    if _session is None or _session.closed or _session_loop is not current_loop:
        ssl_context = ssl.create_default_context()
        ssl_context.check_hostname = False
        ssl_context.verify_mode = ssl.CERT_NONE
        
        # Limit connections to prevent resource exhaustion, enable DNS cache
        connector = aiohttp.TCPConnector(
            ssl=ssl_context,
            limit=HTTP_CLIENT_POOL_LIMITS,
            ttl_dns_cache=300
        )
        
        _session = aiohttp.ClientSession(connector=connector)
        _session_loop = current_loop
        logger.info("Created shared aiohttp.ClientSession for event loop", loop_id=id(current_loop))
        
    return _session


class FetchResult(TypedDict):
    content: str
    headers: dict[str, str]
    status_code: int
    not_modified: bool
    error: str | None
    final_url: str | None
    permanent_redirect: bool


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
    return "application/rss+xml" in ct or "application/atom+xml" in ct or "application/xml" in ct or "text/xml" in ct


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
    # User feedback: "ttl 30 min to avoid hammering feeds".

    # We use a simple strategy:
    # If it's a "fresh" fetch (no etag/last_modified), check cache.
    # If it's a refresh (has etag/last_modified), we skip cache to ensure we get updates,
    # BUT we could arguably respect cache if it's very fresh.
    # For now, let's respect the user's wish to avoid hammering and check cache if available.

    cache_key = f"{FEED_CONTENT_CACHE_PREFIX}{url}"

    # Only use cache if NOT doing a conditional check (or if we decide 30min is acceptable lag even for refreshes)
    # The user said "ttl 30 min to avoid hammering feeds". This implies we should respect the cache
    # even for refreshes, effectively rate limiting our checks to once every 30 mins per feed.
    if not etag and not last_modified:
        cached = await redis_cache.get(cache_key)
        if cached:
            logger.info("Feed fetch cache hit", url=url)
            return cached

    # RSSHub Proxy Replacement
    url = transform_rsshub_url(url)

    headers = {
        "User-Agent": BROWSER_USER_AGENT,
    }
    if etag:
        headers["If-None-Match"] = etag
    if last_modified:
        headers["If-Modified-Since"] = last_modified

    session = await _get_client_session()
    timeout_config = aiohttp.ClientTimeout(total=timeout, connect=10, sock_read=timeout)

    try:
        async with session.get(url, headers=headers, allow_redirects=True, timeout=timeout_config) as response:
            # Handle 304 Not Modified
            if response.status == 304:
                return {
                    "content": "",
                    "headers": {str(k): str(v) for k, v in response.headers.items()},
                    "status_code": 304,
                    "not_modified": True,
                    "error": None,
                    "final_url": str(response.url),
                    "permanent_redirect": False,
                }

            # Handle error statuses
            if response.status >= 400:
                return _build_error_result(response.status, f"HTTP {response.status}")

            # Check size limit via Content-Length if available
            try:
                content_length = int(response.headers.get("Content-Length", 0))
                if content_length > MAX_FEED_SIZE_BYTES:
                    return _build_error_result(413, f"Feed content too large ({content_length} bytes)")
            except ValueError:
                pass

            # Read content
            try:
                # aiohttp reads entire body into memory
                content_bytes = await response.read()

                if len(content_bytes) > MAX_FEED_SIZE_BYTES:
                    return _build_error_result(413, f"Feed content too large ({len(content_bytes)} bytes)")

                # Try to decode
                encoding = response.get_encoding()
                try:
                    content = content_bytes.decode(encoding)
                except Exception:
                    content = content_bytes.decode("utf-8", errors="replace")

            except aiohttp.ClientPayloadError as e:
                return _build_error_result(502, f"Payload error: {e}")
            except Exception as e:
                return _build_error_result(500, f"Content reading failed: {e}")

            # Basic validity check (unless it's JSON)
            content_type = response.headers.get("Content-Type", "").lower()
            is_json = "json" in content_type

            if not is_json and not content.strip():
                return _build_error_result(204, "Empty content")

            # Detect permanent redirect in history
            # aiohttp history is a tuple of response objects
            permanent_redirect = False
            if response.history:
                for r in response.history:
                    if r.status in (301, 308):
                        permanent_redirect = True
                        break

            result: FetchResult = {
                "content": content,
                "headers": {str(k): str(v) for k, v in response.headers.items()},
                "status_code": response.status,
                "not_modified": False,
                "error": None,
                "final_url": str(response.url),
                "permanent_redirect": permanent_redirect,
            }

            # Cache successful results (only if not conditional? or always?)
            # If we cache, we should cache the whole result including headers
            if response.status == 200:
                await redis_cache.set(cache_key, result, ttl_seconds=FEED_CACHE_TTL)

            return result

    except (asyncio.TimeoutError, aiohttp.ClientError) as e:
        # Network errors
        status = 408 if isinstance(e, asyncio.TimeoutError) else 502
        return _build_error_result(
            status,
            f"Request error: {type(e).__name__} {e}",
        )

    except Exception as e:
        return _build_error_result(500, f"Unexpected error: {str(e)}")
