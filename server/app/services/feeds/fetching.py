"""
Feed fetching module handling HTTP requests.
Strictly handles Network I/O. No database dependencies.
"""

from typing import TypedDict

import httpx
import structlog

from app.core.constants import (
    BROWSER_USER_AGENT,
    DEFAULT_RSS_TIMEOUT,
    HTTP_CLIENT_KEEPALIVE_EXPIRY,
    HTTP_CLIENT_MAX_KEEPALIVE,
    HTTP_CLIENT_POOL_LIMITS,
)

logger = structlog.get_logger(__name__)

# Singleton client container
_client: httpx.AsyncClient | None = None


class FetchResult(TypedDict):
    content: str
    headers: dict[str, str]
    status_code: int
    not_modified: bool
    error: str | None


def get_http_client() -> httpx.AsyncClient:
    """
    Get or create the singleton HTTP client.
    This client is persistent across the application lifecycle.
    """
    global _client
    if _client is None:
        limits = httpx.Limits(
            max_connections=HTTP_CLIENT_POOL_LIMITS,
            max_keepalive_connections=HTTP_CLIENT_MAX_KEEPALIVE,
            keepalive_expiry=HTTP_CLIENT_KEEPALIVE_EXPIRY,
        )
        _client = httpx.AsyncClient(
            limits=limits,
            follow_redirects=True,
            timeout=DEFAULT_RSS_TIMEOUT,
            headers={"User-Agent": BROWSER_USER_AGENT},
            verify=False,  # noqa: S501  # Many RSS feeds have bad SSL
        )
    return _client


async def fetch_feed_content(
    url: str,
    etag: str | None = None,
    last_modified: str | None = None,
    timeout: int = DEFAULT_RSS_TIMEOUT,
) -> FetchResult:
    """
    Fetch feed content using conditional GET requests.

    Args:
        url: Target URL
        etag: ETag from previous fetch
        last_modified: Last-Modified from previous fetch
        timeout: Request timeout in seconds

    Returns:
        FetchResult dict containing content/status/headers.
    """
    client = get_http_client()

    headers = {}
    if etag:
        headers["If-None-Match"] = etag
    if last_modified:
        headers["If-Modified-Since"] = last_modified

    try:
        response = await client.get(url, headers=headers, timeout=timeout)

        # Handle 304 Not Modified
        if response.status_code == 304:
            return {
                "content": "",
                "headers": dict[str, str](response.headers),
                "status_code": 304,
                "not_modified": True,
                "error": None,
            }

        # Handle other errors
        if response.status_code >= 400:
            logger.warning("Feed fetch failed", url=url, status=response.status_code)
            return {
                "content": "",
                "headers": dict[str, str](response.headers),
                "status_code": response.status_code,
                "not_modified": False,
                "error": f"HTTP {response.status_code}",
            }

        return {
            "content": response.text,
            "headers": dict[str, str](response.headers),
            "status_code": response.status_code,
            "not_modified": False,
            "error": None,
        }

    except httpx.TimeoutException:
        logger.warning("Feed fetch timed out", url=url)
        return {
            "content": "",
            "headers": {},
            "status_code": 408,
            "not_modified": False,
            "error": "Timeout",
        }
    except Exception as e:
        logger.error("Feed fetch error", url=url, error=str(e))
        return {
            "content": "",
            "headers": {},
            "status_code": 500,
            "not_modified": False,
            "error": str(e),
        }
