"""Utility for generating stable GUIDs for RSS articles."""

import hashlib


def generate_stable_guid(
    original_guid: str | None = None,
    link: str | None = None,
    title: str | None = None,
    published_at: str | None = None,
    content: str | None = None,
) -> str:
    """Generate a stable GUID for an RSS article.

    Priority order:
    1. Use original_guid if available and not empty
    2. Use link if available and not empty
    3. Generate hash from title + published_at + content (first 1000 chars)

    Args:
        original_guid: The original GUID from the RSS feed
        link: The article link/URL
        title: The article title
        published_at: The publication date as string
        content: The article content

    Returns:
        A stable GUID string
    """
    # First priority: original GUID
    if original_guid and original_guid.strip():
        return original_guid.strip()

    # Second priority: article link
    if link and link.strip():
        return link.strip()

    # Last resort: generate hash from content
    # Combine title, publication date, and first 1000 characters of content
    hash_input = (title or "").strip() + "|" + (published_at or "").strip() + "|" + (content or "")[:1000].strip()

    # Generate SHA-256 hash
    hash_bytes = hashlib.sha256(hash_input.encode("utf-8")).hexdigest()
    return f"hash:{hash_bytes}"
