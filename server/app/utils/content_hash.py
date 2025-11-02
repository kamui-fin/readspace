"""Content hashing utilities for feed articles."""

import hashlib
from typing import Any


def calculate_feed_content_hash(entries: list[Any]) -> str:
    """Calculate SHA-256 hash of top 10 article titles + links.

    This enables detecting when feed content is actually unchanged,
    allowing us to skip expensive article processing.

    Args:
        entries: Parsed feed entries (from feedparser or similar)

    Returns:
        Hex string of SHA-256 hash, or empty string if no entries

    Example:
        >>> entries = [{'title': 'Article 1', 'link': 'http://example.com/1'}]
        >>> hash_value = calculate_feed_content_hash(entries)
        >>> len(hash_value) == 64  # SHA-256 produces 64 hex characters
        True
    """
    if not entries:
        return ""

    # Hash only top 10 articles - they're most important and stable
    content_parts = []
    for entry in entries[:10]:
        title = getattr(entry, "title", "")
        link = getattr(entry, "link", "")
        content_parts.append(f"{title}|{link}")

    combined = "||".join(content_parts)
    return hashlib.sha256(combined.encode()).hexdigest()
