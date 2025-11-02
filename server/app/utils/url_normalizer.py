"""URL normalization utilities for RSS feeds."""

from urllib.parse import urlparse, urlunparse

import httpx
import structlog

logger = structlog.get_logger(__name__)


def normalize_feed_url(url: str) -> str:
    """Normalize a feed URL to prevent duplicates.

    This function ensures consistent URL storage by:
    - Always using https for http/https URLs
    - Converting domain to lowercase
    - Removing trailing slashes from path
    - Removing common tracking parameters
    - Removing fragment identifiers

    Args:
        url: Raw URL string

    Returns:
        Normalized URL string
    """
    if not url or not isinstance(url, str):
        return url

    # Basic cleanup
    url = url.strip()

    # Parse the URL
    try:
        parsed = urlparse(url)
    except Exception:
        # If parsing fails, return original URL
        return url

    # Normalize scheme - always use https if it's an http/https URL
    scheme = parsed.scheme.lower()
    if scheme in ("http", "https"):
        scheme = "https"
    elif scheme not in ("ftp", "rsshub"):
        # For non-standard schemes, return as-is
        return url

    # Normalize domain - convert to lowercase
    netloc = parsed.netloc.lower()

    # Normalize path - remove trailing slash unless it's the root
    path = parsed.path
    if path.endswith("/") and len(path) > 1:
        path = path.rstrip("/")
    elif not path:
        path = ""

    # Remove common tracking parameters
    query_params = []
    if parsed.query:
        # Split query string into parameters
        for param in parsed.query.split("&"):
            if "=" in param:
                key, _ = param.split("=", 1)
                key = key.lower()
                # Skip common tracking parameters
                if key not in (
                    "utm_source",
                    "utm_medium",
                    "utm_campaign",
                    "utm_content",
                    "utm_term",
                    "fbclid",
                    "gclid",
                    "ref",
                    "referrer",
                    "source",
                ):
                    query_params.append(param)
            else:
                # Keep parameters without values
                query_params.append(param)

    query = "&".join(query_params) if query_params else ""

    # Remove fragment (everything after #)
    fragment = ""

    # Reconstruct the URL
    normalized = urlunparse((scheme, netloc, path, parsed.params, query, fragment))

    return normalized


def are_urls_equivalent(url1: str, url2: str) -> bool:
    """Check if two URLs are equivalent after normalization.

    Args:
        url1: First URL
        url2: Second URL

    Returns:
        True if URLs are equivalent after normalization
    """
    return normalize_feed_url(url1) == normalize_feed_url(url2)


def get_protocol_variation(url: str) -> str | None:
    """Get the protocol variation (http <-> https) of a URL.

    This is useful for checking if a feed exists with a different protocol,
    which can happen with legacy feeds stored before normalization.

    Args:
        url: The URL to get the protocol variation for

    Returns:
        The URL with the opposite protocol (http <-> https), or None if
        the URL doesn't use http/https protocols
    """
    try:
        parsed = urlparse(url)
        if parsed.scheme in ("http", "https"):
            # Try the opposite protocol
            alt_scheme = "https" if parsed.scheme == "http" else "http"
            return urlunparse((alt_scheme, parsed.netloc, parsed.path, parsed.params, parsed.query, parsed.fragment))
        return None
    except Exception:
        return None


def normalize_url_for_display(url_str: str | None) -> str | None:
    """Normalize URL for API responses, preserving original schemes like rsshub://

    Args:
        url_str: URL string to normalize

    Returns:
        Normalized URL string or None if invalid
    """
    if not url_str:
        return None
    url_str = str(url_str).strip()

    # Keep rsshub:// URLs as-is for display purposes
    if url_str.startswith("rsshub://"):
        return url_str

    # If it's already a valid web URL, return it
    if url_str.startswith(("http://", "https://")):
        return url_str

    # If it contains any other scheme (like data:, ftp:, etc.), it's invalid.
    if ":" in url_str:
        return None

    # Otherwise, assume it's a web URL missing the protocol and add it.
    return f"https://{url_str}"


async def resolve_feed_url(url: str, timeout_seconds: int = 10, max_redirects: int = 10) -> str:
    """Resolve a feed URL by following HTTP redirects to get the canonical URL.

    This function performs a HEAD request to follow redirects and determine
    the final canonical URL that the server considers authoritative. This is
    more accurate than arbitrary normalization rules (like removing www).

    Examples:
        http://fark.com/feed -> https://www.fark.com/feed (server redirects)
        http://www.example.com -> https://www.example.com (no redirect)

    Args:
        url: The URL to resolve
        timeout_seconds: Request timeout in seconds (default: 10)
        max_redirects: Maximum number of redirects to follow (default: 10)

    Returns:
        The final resolved URL after following all redirects, or the original
        URL if resolution fails (with basic normalization applied)

    Note:
        If the HEAD request fails (timeout, connection error, etc.), falls back
        to basic normalization without removing www or changing protocol arbitrarily.
    """
    if not url or not isinstance(url, str):
        return url

    # Basic cleanup first
    url = url.strip()

    try:
        # Parse to validate URL structure
        parsed = urlparse(url)
        if parsed.scheme not in ("http", "https"):
            # For non-HTTP schemes (like rsshub://), return as-is
            logger.debug("Non-HTTP scheme detected, skipping resolution", url=url, scheme=parsed.scheme)
            return url

        # Perform HEAD request with redirect following
        async with httpx.AsyncClient(
            follow_redirects=True,
            max_redirects=max_redirects,
            timeout=timeout_seconds,
        ) as client:
            try:
                response = await client.head(url)
                final_url = str(response.url)

                logger.info(
                    "Successfully resolved feed URL",
                    original_url=url,
                    final_url=final_url,
                    status_code=response.status_code,
                    redirects=len(response.history),
                )

                # Apply basic normalization to the resolved URL
                return _basic_normalize_url(final_url)

            except httpx.HTTPStatusError as e:
                # Server returned error status - use original URL with basic normalization
                logger.warning(
                    "HTTP error during URL resolution, using basic normalization",
                    url=url,
                    status_code=e.response.status_code,
                    error=str(e),
                )
                return _basic_normalize_url(url)

            except httpx.TimeoutException:
                logger.warning("Timeout during URL resolution, using basic normalization", url=url)
                return _basic_normalize_url(url)

            except httpx.NetworkError as e:
                logger.warning("Network error during URL resolution, using basic normalization", url=url, error=str(e))
                return _basic_normalize_url(url)

            except Exception as e:
                logger.warning(
                    "Unexpected error during URL resolution, using basic normalization", url=url, error=str(e)
                )
                return _basic_normalize_url(url)

    except Exception as e:
        logger.error("Failed to parse or resolve URL, returning original", url=url, error=str(e))
        return url


def _basic_normalize_url(url: str) -> str:
    """Apply basic URL normalization without arbitrary www removal or protocol changes.

    This is a safer normalization that:
    - Lowercases the domain
    - Removes trailing slashes (except root)
    - Removes tracking parameters
    - Removes fragments
    - Does NOT remove www (respects server preference)
    - Does NOT change http to https (respects server preference)

    Args:
        url: URL to normalize

    Returns:
        Normalized URL string
    """
    if not url or not isinstance(url, str):
        return url

    url = url.strip()

    try:
        parsed = urlparse(url)
    except Exception:
        return url

    # Keep scheme as-is (don't arbitrarily change http to https)
    scheme = parsed.scheme.lower()

    # Normalize domain to lowercase (but keep www if present)
    netloc = parsed.netloc.lower()

    # Normalize path - remove trailing slash unless it's the root
    path = parsed.path
    if path.endswith("/") and len(path) > 1:
        path = path.rstrip("/")
    elif not path:
        path = "/"

    # Remove common tracking parameters
    query_params = []
    if parsed.query:
        for param in parsed.query.split("&"):
            if "=" in param:
                key, _ = param.split("=", 1)
                key = key.lower()
                # Skip common tracking parameters
                if key not in (
                    "utm_source",
                    "utm_medium",
                    "utm_campaign",
                    "utm_content",
                    "utm_term",
                    "fbclid",
                    "gclid",
                    "ref",
                    "referrer",
                    "source",
                ):
                    query_params.append(param)
            else:
                query_params.append(param)

    query = "&".join(query_params) if query_params else ""

    # Remove fragment
    fragment = ""

    # Reconstruct URL
    normalized = urlunparse((scheme, netloc, path, parsed.params, query, fragment))

    return normalized
