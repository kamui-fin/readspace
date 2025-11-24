"""
Utilities for URL normalization, validation, resolving, and cleaning.
"""

from urllib.parse import urlparse, urlunparse
import httpx
import structlog
from app.core.config import get_settings

logger = structlog.get_logger(__name__)

# Security constants
ALLOWED_FEED_SCHEMES = {"http", "https", "rsshub"}
BLOCKED_DOMAINS = {"localhost", "127.0.0.1", "0.0.0.0", "::1", "[::1]"}
PRIVATE_IP_PREFIXES = (
    "10.", "172.16.", "172.17.", "172.18.", "172.19.", "172.20.", 
    "172.21.", "172.22.", "172.23.", "172.24.", "172.25.", "172.26.", 
    "172.27.", "172.28.", "172.29.", "172.30.", "172.31.", 
    "192.168.", "169.254."
)

def extract_clean_domain(url_or_domain: str) -> str:
    """Extract domain from URL, removing www and protocol."""
    if not url_or_domain:
        return ""
    
    domain = url_or_domain.lower().strip()
    
    # Handle URL input
    if "://" in domain:
        try:
            parsed = urlparse(domain)
            domain = parsed.netloc
        except Exception:
            parts = domain.split("://", 1)
            if len(parts) == 2:
                domain = parts[1].split("/")[0]

    # Remove port if present
    if ":" in domain:
        domain = domain.split(":")[0]

    if domain.startswith("www."):
        domain = domain[4:]
        
    return domain


def normalize_feed_url(url: str) -> str:
    """
    Standardize feed URL for storage/deduplication.
    
    - Forces HTTPS (unless scheme is rsshub/ftp)
    - Lowercases domain
    - Removes tracking params (utm_*, fbclid, etc)
    - Removes fragments
    """
    if not url or not isinstance(url, str):
        return url
    
    url = url.strip()
    try:
        parsed = urlparse(url)
    except Exception:
        return url

    # Normalize scheme
    scheme = parsed.scheme.lower()
    if scheme in ("http", "https"):
        scheme = "https"
    
    # Normalize domain
    netloc = parsed.netloc.lower()
    
    # Normalize path
    path = parsed.path
    if path.endswith("/") and len(path) > 1:
        path = path.rstrip("/")
    elif not path:
        path = ""

    # Filter query params
    query_params = []
    if parsed.query:
        ignored_params = {
            "utm_source", "utm_medium", "utm_campaign", "utm_content", 
            "utm_term", "fbclid", "gclid", "ref", "referrer", "source"
        }
        for param in parsed.query.split("&"):
            if "=" in param:
                key, _ = param.split("=", 1)
                if key.lower() not in ignored_params:
                    query_params.append(param)
            else:
                query_params.append(param)

    query = "&".join(query_params) if query_params else ""
    
    return urlunparse((scheme, netloc, path, parsed.params, query, ""))


def transform_rsshub_url(url: str) -> str:
    """Convert rsshub:// URLs to their HTTP equivalent via config."""
    if not url.startswith("rsshub://"):
        return url
        
    settings = get_settings()
    rsshub_base = settings.RSSHUB_URL.rstrip("/")
    path = url[len("rsshub://"):]
    return f"{rsshub_base}/{path}"


async def resolve_feed_url(url: str, timeout_seconds: int = 10) -> str:
    """
    Follow HTTP redirects to find the canonical URL, then normalize it.
    Solves issues where user enters http://site.com/feed and it redirects to https.
    """
    if not url:
        return url
        
    url = url.strip()
    
    # Skip resolution for non-HTTP (like rsshub://)
    if not url.startswith(("http://", "https://")):
        return normalize_feed_url(url)

    try:
        async with httpx.AsyncClient(follow_redirects=True, timeout=timeout_seconds) as client:
            response = await client.head(url)
            final_url = str(response.url)
            return normalize_feed_url(final_url)
    except Exception as e:
        logger.warning(f"URL resolution failed, using normalized original: {e}", url=url)
        return normalize_feed_url(url)


def validate_feed_url_security(url: str, allow_rsshub: bool = True) -> tuple[bool, str | None]:
    """
    Security validation: Checks scheme and SSRF (blocked domains/IPs).
    Returns (is_valid, error_message).
    """
    try:
        parsed = urlparse(url)
    except Exception as e:
        return False, f"Invalid URL format: {str(e)}"

    # Scheme Check
    allowed = ALLOWED_FEED_SCHEMES if allow_rsshub else {"http", "https"}
    if parsed.scheme not in allowed:
        return False, f"Invalid scheme: {parsed.scheme}. Allowed: {', '.join(sorted(allowed))}"

    if parsed.scheme == "rsshub":
        return True, None

    if not parsed.netloc:
        return False, "URL has no domain"

    netloc = parsed.netloc.lower()
    
    # Extract domain (strip IPv6 brackets and ports)
    if netloc.startswith("["):
        domain = netloc.split("]")[0] + "]"
    else:
        domain = netloc.split(":")[0]

    # Allow configured RSSHub instance even if local
    settings = get_settings()
    if settings.RSSHUB_URL and domain in settings.RSSHUB_URL:
        return True, None

    # Blocked List Check
    if domain in BLOCKED_DOMAINS:
        return False, f"Blocked domain: {domain}"

    # Private IP Check
    # (Simple string check; for strict security, DNS resolution is required before fetch)
    if any(domain.startswith(prefix) for prefix in PRIVATE_IP_PREFIXES):
        return False, f"Private IP address not allowed: {domain}"

    return True, None