import re
from collections.abc import Mapping
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime

# Pre-compile regex for performance
_MAX_AGE_REGEX = re.compile(r"max-age=(\d+)", re.IGNORECASE)


def parse_cache_control_max_age(headers: Mapping[str, str]) -> int | None:
    """
    Parse Cache-Control header to extract max-age in minutes.

    Args:
        headers: HTTP response headers (case-insensitive lookup preferred)

    Returns:
        max-age value in minutes, or None if not present
    """
    # Handle case-sensitivity if raw dict is passed, though httpx.Headers is case-insensitive
    val = headers.get("Cache-Control") or headers.get("cache-control")
    if not val:
        return None

    match = _MAX_AGE_REGEX.search(val)
    if match:
        seconds = int(match.group(1))
        return max(1, seconds // 60)  # Convert to minutes, minimum 1

    return None


def parse_expires_header(headers: Mapping[str, str]) -> int | None:
    """
    Parse Expires header to calculate TTL in minutes from now.

    Args:
        headers: HTTP response headers

    Returns:
        TTL in minutes until expiration, or None if not present/invalid
    """
    val = headers.get("Expires") or headers.get("expires")
    if not val:
        return None

    try:
        expires_dt = parsedate_to_datetime(val)
        now = datetime.now(timezone.utc)

        delta = (expires_dt - now).total_seconds()
        if delta > 0:
            return max(1, int(delta // 60))

    except (ValueError, TypeError, OverflowError):
        pass

    return None


def parse_ttl_from_headers(headers: Mapping[str, str]) -> int | None:
    """
    Parse TTL from Cache-Control or Expires headers.
    Cache-Control max-age takes precedence over Expires.
    """
    if ttl := parse_cache_control_max_age(headers):
        return ttl

    return parse_expires_header(headers)
