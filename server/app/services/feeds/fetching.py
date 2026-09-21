import asyncio
import ssl
from typing import TypedDict

import aiohttp
import structlog

from app.core import redis_cache
from app.core.constants import (
    BROWSER_USER_AGENT,
    DEFAULT_RSS_TIMEOUT,
    FEED_CACHE_TTL,
    FEED_CONTENT_CACHE_PREFIX,
    HTTP_CLIENT_POOL_LIMITS,
)
from app.core.custom_exceptions import ValidationError
from app.utils.security import SSRFSafeResolver, build_ssrf_trace_config, validate_url_security
from app.utils.urls import transform_rsshub_url

logger = structlog.get_logger(__name__)

# 50MB limit for feed content
MAX_FEED_SIZE_BYTES = 50 * 1024 * 1024

_session: aiohttp.ClientSession | None = None
_session_loop: asyncio.AbstractEventLoop | None = None


async def _get_client_session() -> aiohttp.ClientSession:
    """Get or create a shared aiohttp.ClientSession bound to the current event loop."""
    global _session, _session_loop
    current_loop = asyncio.get_running_loop()

    if _session is None or _session.closed or _session_loop is not current_loop:
        # Standard verified SSL context by default
        ssl_context = ssl.create_default_context()

        # Limit connections to prevent resource exhaustion, enable DNS cache
        connector = aiohttp.TCPConnector(
            ssl=ssl_context, limit=HTTP_CLIENT_POOL_LIMITS, ttl_dns_cache=300, resolver=SSRFSafeResolver()
        )

        _session = aiohttp.ClientSession(connector=connector, trace_configs=[build_ssrf_trace_config()])
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


async def _process_response(
    response: aiohttp.ClientResponse,
    cache_key: str,
) -> FetchResult:
    """Process HTTP response into uniform FetchResult and cache if valid."""
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


async def fetch_feed_content(
    url: str,
    etag: str | None = None,
    last_modified: str | None = None,
    timeout: int = DEFAULT_RSS_TIMEOUT,
    if_modified_since_timestamp: int | None = None,
) -> FetchResult:
    """Fetch feed content with conditional headers, caching, and delta support."""

    # Cache is only consulted on a "fresh" fetch (no etag/last_modified). A refresh
    # always hits the server so conditional headers can pick up updates.
    cache_key = f"{FEED_CONTENT_CACHE_PREFIX}{url}"

    if not etag and not last_modified:
        cached = await redis_cache.get(cache_key)
        if cached:
            logger.info("Feed fetch cache hit", url=url)
            return cached

    # RSSHub Proxy Replacement
    url = transform_rsshub_url(url)

    # SSRF guard (redirect hops + connect-time IPs are checked by the session)
    try:
        await validate_url_security(url, allow_rsshub=False)
    except ValidationError as e:
        logger.warning("Blocked feed fetch by SSRF policy", url=url, error=str(e))
        return _build_error_result(400, "URL not allowed")

    headers = {
        "User-Agent": BROWSER_USER_AGENT,
        "Accept": "application/rss+xml,application/atom+xml,application/xml;q=0.9,text/xml;q=0.8,*/*;q=0.1",
        "Accept-Encoding": "gzip, deflate, br",
        "Accept-Language": "en-US,en;q=0.9",
    }
    if etag:
        headers["If-None-Match"] = etag
    if last_modified:
        headers["If-Modified-Since"] = last_modified

    session = await _get_client_session()
    timeout_config = aiohttp.ClientTimeout(total=timeout, connect=10, sock_read=timeout)

    try:
        try:
            async with session.get(url, headers=headers, allow_redirects=True, timeout=timeout_config) as response:
                return await _process_response(response, cache_key)
        except aiohttp.ClientSSLError as ssl_err:
            logger.warning(
                "TLS verification failed, falling back to unverified TLS for legacy blog",
                url=url,
                error=str(ssl_err),
            )
            async with session.get(
                url, headers=headers, allow_redirects=True, timeout=timeout_config, ssl=False
            ) as response:
                return await _process_response(response, cache_key)

    except (asyncio.TimeoutError, aiohttp.ClientError) as e:
        # Network errors
        status = 408 if isinstance(e, asyncio.TimeoutError) else 502
        return _build_error_result(
            status,
            f"Request error: {type(e).__name__} {e}",
        )

    except Exception as e:
        return _build_error_result(500, f"Unexpected error: {str(e)}")


class DownloadedResource(TypedDict):
    body: bytes
    final_url: str
    charset: str | None


async def fetch_public_resource(
    url: str, *, timeout: float = DEFAULT_RSS_TIMEOUT, max_bytes: int = MAX_FEED_SIZE_BYTES
) -> DownloadedResource | None:
    """Download a bounded body, checking initial URLs, redirect hops and connect-time IPs."""
    try:
        await validate_url_security(url, allow_rsshub=False)
    except ValidationError as e:
        logger.warning("Blocked resource fetch by SSRF policy", url=url, error=str(e))
        return None

    session = await _get_client_session()
    timeout_config = aiohttp.ClientTimeout(total=timeout, connect=10, sock_read=timeout)
    headers = {"User-Agent": BROWSER_USER_AGENT, "Accept": "*/*"}

    try:
        async with session.get(url, headers=headers, allow_redirects=True, timeout=timeout_config) as response:
            if response.status != 200:
                return None
            body = bytearray()
            async for chunk in response.content.iter_chunked(64 * 1024):
                if len(body) + len(chunk) > max_bytes:
                    return None
                body.extend(chunk)
            return {"body": bytes(body), "final_url": str(response.url), "charset": response.charset}
    except (asyncio.TimeoutError, aiohttp.ClientError, ValidationError) as e:
        logger.warning("Resource fetch failed", url=url, error=str(e))
        return None


def decode_resource(resource: DownloadedResource) -> str:
    """Decode a streamed body without relying on ClientResponse's unread internal buffer."""
    try:
        return resource["body"].decode(resource["charset"] or "utf-8", errors="replace")
    except LookupError:
        return resource["body"].decode("utf-8", errors="replace")


async def fetch_page_html(url: str, timeout: int = DEFAULT_RSS_TIMEOUT) -> str | None:
    """Download the complete article page for extraction with a bounded, SSRF-safe request."""
    resource = await fetch_public_resource(url, timeout=timeout)
    return decode_resource(resource) if resource is not None else None
