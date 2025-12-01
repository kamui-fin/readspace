from functools import lru_cache
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
from app.utils.urls import transform_rsshub_url

logger = structlog.get_logger(__name__)


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


async def fetch_feed_content(
    url: str,
    etag: str | None = None,
    last_modified: str | None = None,
    timeout: int = DEFAULT_RSS_TIMEOUT,
    if_modified_since_timestamp: int | None = None,
) -> FetchResult:
    """Fetch feed content with conditional headers and delta support."""
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
        response = await _get_client().get(fetch_url, headers=headers, timeout=timeout)

        # Status checks
        is_error = response.status_code >= 400
        is_not_modified = response.status_code == 304

        if is_error:
            logger.warning("Feed fetch failed", url=url, status=response.status_code)
        elif response.status_code == 226:
            logger.info("Received feed delta update", url=url)

        return {
            "content": "" if is_error or is_not_modified else response.text,
            "headers": {k.lower(): v for k, v in response.headers.items()},
            "status_code": response.status_code,
            "not_modified": is_not_modified,
            "error": f"HTTP {response.status_code}" if is_error else None,
            "final_url": str(response.url),
            "permanent_redirect": any(
                h.status_code in (301, 308) for h in response.history
            ),
        }

    except httpx.TimeoutException:
        logger.warning("Feed fetch timed out", url=url)
        return _build_error_result(408, "Timeout")

    except Exception as e:
        logger.error("Feed fetch error", url=url, error=str(e))
        return _build_error_result(500, str(e))
