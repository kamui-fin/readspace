import ssl
from urllib.parse import urlparse, urlunparse

import aiohttp
import structlog
from url_normalize import url_normalize

from app.core.config import get_settings

logger = structlog.get_logger(__name__)


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
    Uses url-normalize library for robust canonicalization.
    """
    if not url:
        return ""

    url = url.strip()

    # Preserve RSShub
    if url.startswith("rsshub:"):
        try:
            parsed = urlparse(url)
            path = parsed.path.rstrip("/") if len(parsed.path) > 1 else parsed.path
            return urlunparse((parsed.scheme, parsed.netloc, path, "", "", ""))
        except Exception:
            return url

    try:
        # url_normalize handles:
        # - Lowercasing scheme/host
        # - Default ports (80/443)
        # - Decoding unreserved chars
        # - Removing dot segments
        # - Sorting query params
        normalized = url_normalize(url)

        return normalized
    except Exception:
        # Fallback to basic cleanup if library fails
        return url.strip()


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


def _is_head_response_bad(resp: aiohttp.ClientResponse) -> bool:
    """
    Check if a HEAD response is unreliable and requires a GET fallback.
    """
    # Status codes that indicate HEAD is unreliable
    if resp.status in (400, 403, 404, 405):
        return True

    # HEAD redirect but no Location header
    if resp.status in (301, 302, 303, 307, 308) and "location" not in resp.headers:
        return True

    # Wrong content-type on 200
    # Some servers return 200 for HEAD but it's actually an error page or generic HTML
    if resp.status == 200:
        ct = resp.headers.get("content-type", "").lower()
        if not ct or "text/html" in ct or "application/octet-stream" in ct or "text/plain" in ct:
            # If it claims to be generic HTML/text, it might be a splash page or error.
            # Real feeds usually have xml/rss/atom types.
            # However, we must be careful not to discard valid feeds served as text/html.
            # But for *resolution*, if we get text/html, we can't be sure it's the final feed URL
            # without checking the body, which HEAD doesn't have. So we fallback to GET.
            return True

    # HEAD with actual body = broken server (HEAD should have no body)
    # httpx handles this internally usually, but if we see content-length > 0 and it actually sent bytes...
    # Actually, Content-Length IS expected in HEAD (it describes what GET would return).
    # But if the connection actually received body bytes, that's a protocol violation.
    # aiohttp also handles HEAD request without reading body unless requested.
    # We'll skip the body check for now.

    # Cloudflare/Incapsula often break HEAD
    server = resp.headers.get("server", "").lower()
    if "cloudflare" in server or "incapsula" in server:
        return True

    return False


async def resolve_canonical_url(url: str, timeout: int = 10) -> str:
    """
    Follow HTTP redirects to find the canonical URL.
    Implements HEAD -> GET fallback strategy.
    """
    if not url:
        return ""

    url = url.strip()
    if url.startswith("rsshub:"):
        return normalize_feed_url(url)

    # If it's not http/https, just return normalized
    if not url.lower().startswith(("http://", "https://")):
        return normalize_feed_url(url)

    # Setup SSL context for verify=False
    ssl_context = ssl.create_default_context()
    ssl_context.check_hostname = False
    ssl_context.verify_mode = ssl.CERT_NONE

    connector = aiohttp.TCPConnector(ssl=ssl_context)
    timeout_config = aiohttp.ClientTimeout(total=timeout)

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
    }

    try:
        async with aiohttp.ClientSession(connector=connector, timeout=timeout_config, headers=headers) as session:
            # 1. Try HEAD first
            try:
                async with session.head(url, allow_redirects=True) as resp:
                    if _is_head_response_bad(resp):
                        logger.debug(
                            "HEAD response unreliable, using original URL",
                            url=url,
                            status=resp.status,
                        )
                        # Don't fallback to GET here, let the fetcher handle it
                        return normalize_feed_url(url)

                    return normalize_feed_url(str(resp.url))

            except aiohttp.ClientError:
                # Network error on HEAD, assume original URL is fine for now
                return normalize_feed_url(url)

    except Exception as e:
        logger.warning("Failed to resolve canonical URL", url=url, error=str(e))
        # Fallback to original if everything fails
        return normalize_feed_url(url)


def urls_match(url1: str | None, url2: str | None) -> bool:
    """
    Compare two URLs loosely to check if they point to the same resource.
    Ignores scheme (http/https) to be safe.
    """
    if not url1 or not url2:
        return False

    try:
        # Use normalization for comparison
        n1 = normalize_feed_url(url1)
        n2 = normalize_feed_url(url2)
        return n1 == n2
    except Exception:
        return url1 == url2
