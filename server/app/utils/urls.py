from urllib.parse import urlparse, urlunparse

import httpx

from app.core.config import get_settings


def transform_rsshub_url(url: str) -> str:
    """
    Transform rsshub:// URLs to HTTP URLs using the configured instance.
    """
    if not url or not url.startswith("rsshub"):
        return url

    settings = get_settings()
    if not settings.RSSHUB_URL:
        return url

    rsshub_base = settings.RSSHUB_URL.rstrip("/")
    # Clean up both 'rsshub://' and 'rsshub:'
    path = url.replace("rsshub://", "").replace("rsshub:", "").lstrip("/")
    return f"{rsshub_base}/{path}"


def normalize_feed_url(url: str) -> str:
    """
    Standardize URL for storage/deduplication.
    Forces HTTPS, lowercases domain, strips tracking params.
    """
    if not url:
        return ""

    url = url.strip()
    try:
        parsed = urlparse(url)
    except Exception:
        return url

    scheme = parsed.scheme.lower()

    # Preserve RSShub
    if scheme == "rsshub":
        path = parsed.path.rstrip("/") if len(parsed.path) > 1 else parsed.path
        return urlunparse((scheme, parsed.netloc, path, "", "", ""))

    if scheme in ("http", "https"):
        scheme = "https"

    # Clean Params
    query = ""
    if parsed.query:
        # Blocklist approach is safer than allowlist for URLs
        ignored_params = {
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
        }
        filtered_params = [p for p in parsed.query.split("&") if p.split("=")[0].lower() not in ignored_params]
        query = "&".join(filtered_params)

    path = parsed.path.rstrip("/") if len(parsed.path) > 1 else parsed.path
    return urlunparse((scheme, parsed.netloc.lower(), path, parsed.params, query, ""))


def extract_domain_from_url(url: str | None) -> str:
    """
    Extract domain from URL.
    """
    if not url:
        return ""
    try:
        parsed = urlparse(url)
        return parsed.netloc or ""
    except Exception:
        return ""


async def resolve_canonical_url(url: str, timeout: int = 10) -> str:
    """
    Follow HTTP redirects to find the canonical URL.
    """
    if not url:
        return ""

    url = url.strip()
    if url.startswith("rsshub:"):
        return normalize_feed_url(url)

    # If it's not http/https, just return normalized
    if not url.lower().startswith(("http://", "https://")):
        return normalize_feed_url(url)

    try:
        # verify=False is risky but common for RSS feeds with bad certs.
        # Ideally, make this configurable.
        async with httpx.AsyncClient(follow_redirects=True, timeout=timeout, verify=False) as client:
            resp = await client.head(url)
            return normalize_feed_url(str(resp.url))
    except Exception:
        # Fallback to original if network fails
        return normalize_feed_url(url)


def urls_match(url1: str | None, url2: str | None) -> bool:
    """
    Compare two URLs loosely to check if they point to the same resource.
    Ignores scheme (http/https) to be safe.
    """
    if not url1 or not url2:
        return False

    try:
        u1 = urlparse(url1)
        u2 = urlparse(url2)
        # Compare netloc + path. Ignore scheme and query params (often dynamic sizing)
        return (u1.netloc == u2.netloc) and (u1.path == u2.path)
    except Exception:
        return url1 == url2
