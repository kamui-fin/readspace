"""
HTTP caching utilities for parsing Cache-Control and related headers.
"""

import re
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime


def parse_cache_control_max_age(headers: dict[str, str]) -> int | None:
    """
    Parse Cache-Control header to extract max-age in minutes.

    Args:
        headers: HTTP response headers

    Returns:
        max-age value in minutes, or None if not present
    """
    cache_control = headers.get("Cache-Control") or headers.get("cache-control")
    if not cache_control:
        return None

    # Parse max-age directive
    match = re.search(r"max-age=(\d+)", cache_control, re.IGNORECASE)
    if match:
        seconds = int(match.group(1))
        return max(1, seconds // 60)  # Convert to minutes, minimum 1

    return None


def parse_expires_header(headers: dict[str, str]) -> int | None:
    """
    Parse Expires header to calculate TTL in minutes from now.

    Args:
        headers: HTTP response headers

    Returns:
        TTL in minutes until expiration, or None if not present/invalid
    """
    expires = headers.get("Expires") or headers.get("expires")
    if not expires:
        return None

    try:
        expires_dt = parsedate_to_datetime(expires)
        now = datetime.now(timezone.utc)

        # Calculate difference in minutes
        delta = (expires_dt - now).total_seconds()
        if delta > 0:
            return max(1, int(delta // 60))  # Minimum 1 minute
    except (ValueError, TypeError, OverflowError):
        pass

    return None


def parse_ttl_from_headers(headers: dict[str, str]) -> int | None:
    """
    Parse TTL from Cache-Control or Expires headers.
    Cache-Control max-age takes precedence over Expires.

    Args:
        headers: HTTP response headers

    Returns:
        TTL in minutes, or None if not present
    """
    # Try Cache-Control first (preferred)
    ttl = parse_cache_control_max_age(headers)
    if ttl is not None:
        return ttl

    # Fall back to Expires
    return parse_expires_header(headers)
