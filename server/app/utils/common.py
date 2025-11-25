"""
Common utilities for url and text validation/normalization.
Consolidated from previous validators.py and url.py to reduce sprawl.
"""

import re
from urllib.parse import urlparse, urlunparse
from uuid import UUID

import httpx
import structlog

from app.core.config import get_settings
from app.core.constants import (
    MAX_FOLDER_NAME_LENGTH,
    MAX_PAGE_SIZE,
    MAX_URL_LENGTH,
)
from app.core.custom_exceptions import ValidationError

logger = structlog.get_logger(__name__)

# --- Constants & Regex ---
ALLOWED_FEED_SCHEMES = {"http", "https", "rsshub"}
BLOCKED_DOMAINS = {"localhost", "127.0.0.1", "0.0.0.0", "::1", "[::1]"}  # noqa: S104
PRIVATE_IP_PREFIXES = (
    "10.",
    "172.16.",
    "172.17.",
    "172.18.",
    "172.19.",
    "172.20.",
    "172.21.",
    "172.22.",
    "172.23.",
    "172.24.",
    "172.25.",
    "172.26.",
    "172.27.",
    "172.28.",
    "172.29.",
    "172.30.",
    "172.31.",
    "192.168.",
    "169.254.",
)

EMAIL_PATTERN = re.compile(r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$")
TAG_NAME_PATTERN = re.compile(r"^[a-z0-9_-]+$")
FOLDER_NAME_PATTERN = re.compile(r"^[\w\s\-_()\[\].]+$", re.UNICODE)


# --- URL Utilities ---


def transform_rsshub_url(url: str) -> str:
    """
    Transform rsshub:// URLs to actual HTTP URLs using configured RSShub instance.

    Examples:
        rsshub://twitter/user/elonmusk -> http://localhost:1200/twitter/user/elonmusk
        rsshub:twitter/user/elonmusk -> http://localhost:1200/twitter/user/elonmusk
    """
    if not url or not isinstance(url, str):
        return url

    url = url.strip()
    if not url.startswith("rsshub:"):
        return url

    settings = get_settings()
    rsshub_base = settings.RSSHUB_URL.rstrip("/")

    # Handle both rsshub:// and rsshub: formats
    path = url.replace("rsshub://", "").replace("rsshub:", "")
    path = path.lstrip("/")

    return f"{rsshub_base}/{path}"


def normalize_feed_url(url: str) -> str:
    """
    Standardize feed URL for deduplication and storage.

    Purpose: Prevents duplicate feeds with slightly different URLs.
    - Preserves rsshub:// scheme for storage (not transformed here)
    - Forces HTTPS for http/https URLs
    - Lowercases domain
    - Strips tracking parameters

    Used BEFORE storing feed URLs in database.
    """
    if not url or not isinstance(url, str):
        return url

    url = url.strip()
    try:
        parsed = urlparse(url)
    except Exception:
        return url

    scheme = parsed.scheme.lower()

    # Keep rsshub:// as-is for storage
    if scheme == "rsshub":
        # Just normalize the path
        path = parsed.path.rstrip("/") if len(parsed.path) > 1 else parsed.path
        return urlunparse((scheme, parsed.netloc, path, "", "", ""))

    # Force HTTPS for web URLs
    if scheme in ("http", "https"):
        scheme = "https"

    netloc = parsed.netloc.lower()
    path = parsed.path.rstrip("/") if len(parsed.path) > 1 else parsed.path

    # Filter tracking params
    query = ""
    if parsed.query:
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
        params = []
        for param in parsed.query.split("&"):
            key = param.split("=")[0].lower() if "=" in param else param
            if key not in ignored_params:
                params.append(param)
        query = "&".join(params)

    return urlunparse((scheme, netloc, path, parsed.params, query, ""))


async def resolve_feed_url(url: str, timeout: int = 10) -> str:
    """
    Follow redirects to find canonical URL.

    For rsshub:// URLs, returns as-is (no HTTP resolution needed).
    For http/https URLs, follows redirects to get final URL.
    """
    if not url:
        return ""

    url = url.strip()

    # RSShub URLs don't need resolution
    if url.startswith("rsshub:"):
        return normalize_feed_url(url)

    if not url.startswith(("http://", "https://")):
        return normalize_feed_url(url)

    try:
        async with httpx.AsyncClient(follow_redirects=True, timeout=timeout, verify=False) as client:  # noqa: S501
            response = await client.head(url)
            return normalize_feed_url(str(response.url))
    except Exception:
        return normalize_feed_url(url)


def validate_feed_url_security(url: str, allow_rsshub: bool = True) -> None:
    """Raise ValidationError if URL is insecure or blocked."""
    try:
        parsed = urlparse(url)
    except Exception as e:
        raise ValidationError(f"Invalid URL format: {e}") from e

    allowed = ALLOWED_FEED_SCHEMES if allow_rsshub else {"http", "https"}
    if parsed.scheme not in allowed:
        raise ValidationError(f"Invalid scheme: {parsed.scheme}")

    if parsed.scheme == "rsshub":
        return

    if not parsed.netloc:
        raise ValidationError("URL has no domain")

    netloc = parsed.netloc.lower()
    domain = netloc.split("]")[0] + "]" if netloc.startswith("[") else netloc.split(":")[0]

    settings = get_settings()
    if settings.RSSHUB_URL and domain in settings.RSSHUB_URL:
        return

    if domain in BLOCKED_DOMAINS:
        raise ValidationError(f"Blocked domain: {domain}")

    if any(domain.startswith(p) for p in PRIVATE_IP_PREFIXES):
        raise ValidationError(f"Private IP address not allowed: {domain}")


# --- General Validators ---


def validate_url(url: str, required: bool = True) -> str | None:
    if not url:
        if required:
            raise ValidationError("URL is required")
        return None

    if len(url) > MAX_URL_LENGTH:
        raise ValidationError(f"URL too long (max {MAX_URL_LENGTH})")

    try:
        parsed = urlparse(url)
        if not parsed.scheme or not parsed.netloc:
            raise ValidationError("Invalid URL format")
        return url
    except Exception as e:
        raise ValidationError("Invalid URL") from e


def validate_email(email: str) -> str:
    if not email:
        raise ValidationError("Email is required")
    if not EMAIL_PATTERN.match(email):
        raise ValidationError("Invalid email format")
    return email.lower()


def validate_folder_name(name: str) -> str:
    if not name or not name.strip():
        raise ValidationError("Folder name cannot be empty")
    name = name.strip()
    if len(name) > MAX_FOLDER_NAME_LENGTH:
        raise ValidationError(f"Folder name too long (max {MAX_FOLDER_NAME_LENGTH})")
    if not FOLDER_NAME_PATTERN.match(name):
        raise ValidationError("Folder name contains invalid characters")
    return name


def validate_uuid(uuid_str: str, field_name: str = "ID") -> UUID:
    if not uuid_str:
        raise ValidationError(f"{field_name} is required")
    try:
        return UUID(uuid_str)
    except ValueError as e:
        raise ValidationError(f"Invalid {field_name} format") from e


def validate_pagination(skip: int = 0, limit: int = 100) -> tuple[int, int]:
    if skip < 0:
        raise ValidationError("Skip must be non-negative")
    if limit < 1:
        raise ValidationError("Limit must be positive")
    if limit > MAX_PAGE_SIZE:
        raise ValidationError(f"Limit too large (max {MAX_PAGE_SIZE})")
    return skip, limit
