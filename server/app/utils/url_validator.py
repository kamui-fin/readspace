"""URL validation utilities for security."""

import re
from urllib.parse import urlparse

import structlog

logger = structlog.get_logger(__name__)

# Precompiled regex pattern for folder name validation
FOLDER_NAME_PATTERN = re.compile(r"^[\w\s\-_()\[\].]+$", re.UNICODE)

# Allowed URL schemes for feed URLs
ALLOWED_FEED_SCHEMES = {"http", "https", "rsshub"}

# Blocked domains or patterns (for SSRF protection)
BLOCKED_DOMAINS = {
    "localhost",
    "127.0.0.1",
    "0.0.0.0",
    "::1",
    "[::1]",
}

# Blocked private IP ranges (IPv4)
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
    "169.254.",  # Link-local
)


def validate_feed_url(url: str, allow_rsshub: bool = True) -> tuple[bool, str | None]:
    """Validate a feed URL for security concerns.

    Args:
        url: The URL to validate
        allow_rsshub: Whether to allow rsshub:// URLs

    Returns:
        Tuple of (is_valid, error_message)
        If valid, error_message is None
        If invalid, error_message contains the reason

    Examples:
        >>> validate_feed_url("https://example.com/feed.xml")
        (True, None)

        >>> validate_feed_url("file:///etc/passwd")
        (False, "Invalid URL scheme: file. Only http, https are allowed")

        >>> validate_feed_url("http://localhost/feed")
        (False, "URL points to blocked domain: localhost")
    """
    try:
        parsed = urlparse(url)
    except Exception as e:
        logger.warning("Failed to parse URL", url=url, error=str(e))
        return False, f"Invalid URL format: {str(e)}"

    # Check scheme
    allowed_schemes = ALLOWED_FEED_SCHEMES if allow_rsshub else {"http", "https"}
    if parsed.scheme not in allowed_schemes:
        schemes_str = ", ".join(sorted(allowed_schemes))
        return False, f"Invalid URL scheme: {parsed.scheme}. Only {schemes_str} are allowed"

    # rsshub:// URLs don't have a netloc, so skip domain validation
    if parsed.scheme == "rsshub":
        return True, None

    # Check for empty netloc (malformed URL)
    if not parsed.netloc:
        return False, "URL has no domain/host"

    # Extract domain (handle ports)
    domain = parsed.netloc.split(":")[0].lower()

    # Check against blocked domains
    if domain in BLOCKED_DOMAINS:
        logger.warning("Attempted access to blocked domain", url=url, domain=domain)
        return False, f"URL points to blocked domain: {domain}"

    # Check for private IP ranges
    for prefix in PRIVATE_IP_PREFIXES:
        if domain.startswith(prefix):
            logger.warning("Attempted access to private IP", url=url, domain=domain)
            return False, f"URL points to private IP address: {domain}"

    # Check for IP addresses that might bypass domain checks
    if domain.replace(".", "").replace(":", "").replace("[", "").replace("]", "").isdigit():
        # More thorough check for various IP formats
        if any(domain.startswith(prefix) for prefix in PRIVATE_IP_PREFIXES):
            logger.warning("Attempted access to private IP", url=url, domain=domain)
            return False, f"URL points to private IP address: {domain}"

    return True, None


def validate_folder_name(name: str) -> tuple[bool, str | None]:
    """Validate a folder name for security and consistency.

    Args:
        name: The folder name to validate

    Returns:
        Tuple of (is_valid, error_message)

    Rules:
        - Cannot be empty or only whitespace
        - Length must be between 1 and 100 characters
        - Can contain: letters, numbers, spaces, hyphens, underscores, parentheses, brackets
        - Cannot start or end with whitespace
        - No control characters or other special characters

    Examples:
        >>> validate_folder_name("My Folder")
        (True, None)

        >>> validate_folder_name("")
        (False, "Folder name cannot be empty")

        >>> validate_folder_name("Folder/With/Slashes")
        (False, "Folder name contains invalid characters")
    """

    # Check for empty or whitespace-only
    if not name or not name.strip():
        return False, "Folder name cannot be empty"

    # Check length
    if len(name) > 100:
        return False, "Folder name must be 100 characters or less"

    # Check for leading/trailing whitespace
    if name != name.strip():
        return False, "Folder name cannot start or end with whitespace"

    # Allow: letters (any language), numbers, spaces, hyphens, underscores, parentheses, brackets, periods
    # This regex allows Unicode letters and numbers
    if not FOLDER_NAME_PATTERN.match(name):
        return (
            False,
            "Folder name contains invalid characters. Only letters, numbers, spaces, hyphens, "
            "underscores, parentheses, brackets, and periods are allowed",
        )

    return True, None
