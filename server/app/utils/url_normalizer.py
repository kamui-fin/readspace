"""URL normalization utilities for RSS feeds."""

from urllib.parse import urlparse, urlunparse


def normalize_feed_url(url: str) -> str:
    """Normalize a feed URL to prevent duplicates.

    This function:
    - Converts to lowercase (for domain)
    - Removes trailing slashes from path
    - Ensures HTTPS when possible
    - Removes common tracking parameters
    - Removes fragment identifiers

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

    # Normalize scheme - prefer https
    scheme = parsed.scheme.lower()
    if scheme not in ("http", "https", "ftp"):
        # For non-standard schemes, return as-is
        return url

    # Convert http to https for common domains that support it
    if scheme == "http":
        scheme = "https"

    # Normalize domain - convert to lowercase
    netloc = parsed.netloc.lower()

    # Remove www. prefix for consistency
    if netloc.startswith("www."):
        netloc = netloc[4:]

    # Normalize path - remove trailing slash unless it's the root
    path = parsed.path
    if path.endswith("/") and len(path) > 1:
        path = path.rstrip("/")
    # Ensure root path has a slash
    elif not path:
        path = "/"

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
