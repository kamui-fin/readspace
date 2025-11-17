"""Feed fetching service with caching and conditional requests."""

import time
from dataclasses import dataclass
from urllib.parse import urlparse, urlunparse

import httpx
import structlog

from app.core.constants import (
    DEFAULT_RSS_TIMEOUT,
    DEFAULT_USER_AGENT,
    HTTP_CLIENT_KEEPALIVE_EXPIRY,
    HTTP_CLIENT_MAX_KEEPALIVE,
    HTTP_CLIENT_POOL_LIMITS,
)
from app.core.metrics import (
    cache_operations_total,
    external_api_duration_seconds,
    external_api_errors_total,
    rss_fetch_duration_seconds,
    rss_fetch_size_bytes,
    rss_fetch_total,
)
from app.core.redis_cache import RedisCache
from app.utils.rsshub_url_transformer import transform_rsshub_url
from app.utils.url_validator import validate_feed_url

logger = structlog.get_logger(__name__)


@dataclass
class FetchResult:
    """Result of a feed fetch operation."""

    content: str
    headers: dict[str, str]
    status_code: int
    not_modified: bool = False
    error: str | None = None


# Singleton HTTP client instance
_http_client: httpx.AsyncClient | None = None


def get_http_client() -> httpx.AsyncClient:
    """
    Get or create the singleton HTTP client with connection pooling.

    This client is reused across all feed fetches to maintain persistent
    connections and reduce TCP handshake overhead.

    Returns:
        httpx.AsyncClient: Configured async HTTP client with connection pooling
    """
    global _http_client

    if _http_client is None:
        limits = httpx.Limits(
            max_connections=HTTP_CLIENT_POOL_LIMITS,
            max_keepalive_connections=HTTP_CLIENT_MAX_KEEPALIVE,
            keepalive_expiry=HTTP_CLIENT_KEEPALIVE_EXPIRY,
        )
        _http_client = httpx.AsyncClient(
            limits=limits,
            follow_redirects=True,
            timeout=DEFAULT_RSS_TIMEOUT,
        )
        logger.info(
            "HTTP client initialized with connection pooling",
            max_connections=HTTP_CLIENT_POOL_LIMITS,
            max_keepalive=HTTP_CLIENT_MAX_KEEPALIVE,
        )

    return _http_client


def normalize_feed_url(url: str) -> str:
    """
    Normalize feed URL for consistent caching.

    Normalization ensures that URLs that point to the same resource
    share the same cache key, preventing duplicate cache entries.

    Changes applied:
    - Convert http:// to https:// (most feeds support HTTPS)
    - Remove trailing slashes
    - Remove URL fragments
    - Lowercase the domain (case-insensitive)
    - Preserve path case (case-sensitive)
    - Preserve query parameters

    Args:
        url: The feed URL to normalize

    Returns:
        str: Normalized URL

    Examples:
        >>> normalize_feed_url("http://example.com/feed.xml")
        "https://example.com/feed.xml"
        >>> normalize_feed_url("https://EXAMPLE.COM/Feed/RSS.xml?format=rss#comments/")
        "https://example.com/Feed/RSS.xml?format=rss"
    """
    # Don't normalize rsshub:// URLs
    if url.startswith("rsshub://"):
        return url

    # Parse the URL
    parsed = urlparse(url)

    # Convert http to https
    scheme = "https" if parsed.scheme == "http" else parsed.scheme

    # Lowercase the domain
    netloc = parsed.netloc.lower()

    # Remove trailing slash from path
    path = parsed.path.rstrip("/")

    # Reconstruct URL without fragment
    normalized = urlunparse(
        (
            scheme,
            netloc,
            path,
            parsed.params,
            parsed.query,
            "",  # Remove fragment
        )
    )

    return normalized


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
    ) -> FetchResult:
        """
        Fetch feed content using httpx with ETag and Last-Modified headers, using cache.

        Args:
            url: The feed URL to fetch
            etag: Optional ETag for conditional requests
            last_modified: Optional Last-Modified header for conditional requests
            timeout_seconds: Optional timeout override (defaults to DEFAULT_RSS_TIMEOUT)

        Returns:
            FetchResult: Typed response with content, headers, status_code, and optional error

        Raises:
            ValueError: If the URL fails security validation after transformation
        """
        start_time = time.perf_counter()
        cached = False

        # Transform rsshub:// URLs to actual HTTP URLs
        actual_url = transform_rsshub_url(url)

        # SECURITY: Validate the transformed URL against allowed schemes and domains
        # This prevents SSRF attacks via rsshub:// URLs or other malicious redirects
        is_valid, error_message = validate_feed_url(actual_url, allow_rsshub=False)
        if not is_valid:
            logger.error(
                "Feed URL failed security validation",
                original_url=url,
                transformed_url=actual_url,
                error=error_message,
                validation_check="security",
            )
            rss_fetch_total.labels(status="error", cached="false").inc()
            external_api_errors_total.labels(service="rss_feed", error_type="validation_failed").inc()
            return FetchResult(
                content="",
                headers={},
                status_code=400,
                error=f"Invalid feed URL: {error_message}",
            )

        # Normalize URL for consistent cache key
        normalized_url = normalize_feed_url(url)
        cache_key = f"feed_content:{normalized_url}"
        cached_data = await self.redis_cache.get(cache_key)

        if cached_data:
            cache_operations_total.labels(operation="get", result="hit").inc()
        else:
            cache_operations_total.labels(operation="get", result="miss").inc()

        timeout = timeout_seconds if timeout_seconds is not None else DEFAULT_RSS_TIMEOUT
        request_headers = self._build_request_headers(etag, last_modified, cached_data)

        try:
            result = await self._make_http_request(actual_url, request_headers, timeout, cache_key)
            cached = result.not_modified

            # Record metrics
            duration = time.perf_counter() - start_time
            status = "success" if result.status_code < 400 else "error"
            rss_fetch_total.labels(status=status, cached=str(cached).lower()).inc()
            rss_fetch_duration_seconds.labels(cached=str(cached).lower()).observe(duration)
            external_api_duration_seconds.labels(service="rss_feed", cached=str(cached).lower()).observe(duration)

            if result.content:
                content_size = len(result.content.encode("utf-8"))
                rss_fetch_size_bytes.observe(content_size)

            # Log successful fetch
            logger.info(
                "Feed fetched successfully",
                url=url,
                status_code=result.status_code,
                duration_seconds=round(duration, 3),
                cached=cached,
                content_size_bytes=len(result.content.encode("utf-8")) if result.content else 0,
            )

            return result

        except httpx.ConnectTimeout:
            duration = time.perf_counter() - start_time
            rss_fetch_total.labels(status="error", cached="false").inc()
            external_api_errors_total.labels(service="rss_feed", error_type="connect_timeout").inc()
            rss_fetch_duration_seconds.labels(cached="false").observe(duration)
            return await self._handle_timeout_error(url, "connect")
        except httpx.ReadTimeout:
            duration = time.perf_counter() - start_time
            rss_fetch_total.labels(status="error", cached="false").inc()
            external_api_errors_total.labels(service="rss_feed", error_type="read_timeout").inc()
            rss_fetch_duration_seconds.labels(cached="false").observe(duration)
            return await self._handle_timeout_error(url, "read")
        except httpx.HTTPStatusError as exc:
            duration = time.perf_counter() - start_time
            rss_fetch_total.labels(status="error", cached="false").inc()
            external_api_errors_total.labels(service="rss_feed", error_type=f"http_{exc.response.status_code}").inc()
            rss_fetch_duration_seconds.labels(cached="false").observe(duration)
            return await self._handle_http_error(exc, actual_url)
        except Exception as exc:
            duration = time.perf_counter() - start_time
            rss_fetch_total.labels(status="error", cached="false").inc()
            external_api_errors_total.labels(service="rss_feed", error_type="network_error").inc()
            rss_fetch_duration_seconds.labels(cached="false").observe(duration)
            return await self._handle_unexpected_error(exc, actual_url)

    def _build_request_headers(
        self, etag: str | None, last_modified: str | None, cached_data: dict | None
    ) -> dict[str, str]:
        """
        Build HTTP request headers including conditional request headers.

        Args:
            etag: Optional ETag for conditional requests
            last_modified: Optional Last-Modified header for conditional requests
            cached_data: Optional cached response data

        Returns:
            dict: HTTP headers for the request
        """
        headers = {"User-Agent": DEFAULT_USER_AGENT}

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
    ) -> FetchResult:
        """
        Make the actual HTTP request and handle the response.

        Uses the singleton HTTP client for connection pooling and reuse.

        Args:
            url: The URL to fetch
            headers: Request headers
            timeout: Request timeout in seconds
            cache_key: Redis cache key for storing response

        Returns:
            dict: Response data
        """
        # Use singleton client with connection pooling
        client = get_http_client()

        # Override timeout for this specific request if needed
        if timeout != DEFAULT_RSS_TIMEOUT:
            response = await client.get(url, headers=headers, timeout=timeout)
        else:
            response = await client.get(url, headers=headers)

        response_headers_dict = {k.lower(): v for k, v in response.headers.items()}

        if response.status_code == 304:  # Not Modified
            logger.debug(
                "Feed not modified (304), serving from cache",
                url=url,
                etag=headers.get("If-None-Match"),
                last_modified=headers.get("If-Modified-Since"),
            )
            cached_data = await self.redis_cache.get(cache_key)
            return FetchResult(
                content=cached_data.get("content", "") if cached_data else "",
                headers=cached_data.get("headers", {}) if cached_data else {},
                not_modified=True,
                status_code=304,
            )

        response.raise_for_status()  # Raise exception for HTTP errors

        content = response.text
        result = FetchResult(
            content=content,
            headers=response_headers_dict,
            not_modified=False,
            status_code=response.status_code,
        )

        # Cache the successful response with 15 minute TTL
        # Convert to dict for caching
        feed_data = {
            "content": result.content,
            "headers": result.headers,
            "not_modified": result.not_modified,
            "status_code": result.status_code,
        }
        await self.redis_cache.set(cache_key, feed_data, 15 * 60)
        logger.debug("Feed fetched successfully", url=url, status=response.status_code)

        return result

    async def _handle_timeout_error(self, url: str, timeout_type: str = "unknown") -> FetchResult:
        """Handle timeout errors."""
        logger.error(
            "Timeout while fetching feed",
            url=url,
            timeout_seconds=DEFAULT_RSS_TIMEOUT,
            timeout_type=timeout_type,
            error_category="network",
        )
        return FetchResult(
            content="",
            headers={},
            error="timeout",
            status_code=408,
        )

    async def _handle_http_error(self, exc: httpx.HTTPStatusError, url: str) -> FetchResult:
        """Handle HTTP status errors."""
        # Use error level for server errors (5xx), warning for client errors (4xx)
        log_level = logger.error if exc.response.status_code >= 500 else logger.warning
        log_level(
            "HTTP error while fetching feed",
            url=url,
            status_code=exc.response.status_code,
            error_category="http",
            response_body=exc.response.text[:200] if hasattr(exc.response, "text") else None,
        )
        return FetchResult(
            content="",
            headers={},
            error=f"http_{exc.response.status_code}",
            status_code=exc.response.status_code,
        )

    async def _handle_unexpected_error(self, exc: Exception, url: str) -> FetchResult:
        """Handle unexpected errors."""
        logger.error(
            "Unexpected error while fetching feed",
            url=url,
            error=str(exc),
            error_type=type(exc).__name__,
            error_category="network",
            exc_info=True,
        )
        return FetchResult(
            content="",
            headers={},
            error="network_error",
            status_code=500,
        )
