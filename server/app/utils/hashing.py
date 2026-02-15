import hashlib
from typing import Any


def _sha256(text: str) -> str:
    """Helper to ensure consistent encoding."""
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def get_content_hash(url: str) -> str:
    """
    Cross-feed deduplication hash based on Article URL.
    """
    if not url:
        return ""
    return _sha256(url.strip().lower())


def get_guid_hash(guid: str, fallback_link: str | None = None) -> str:
    """
    Single-feed deduplication hash.
    Prefer RSS <guid>, fallback to <link>.
    """
    value = guid.strip() if guid else ""

    if not value:
        if not fallback_link:
            raise ValueError("Cannot generate hash: both guid and link are empty")
        value = fallback_link.strip()

    return _sha256(value)


def calculate_feed_content_hash(entries: list[Any]) -> str:
    """
    Fingerprint of the feed's current state.
    Hashes the Title+Link of the top 10 entries.
    Used to detect if a feed has updated without parsing the whole thing.
    """
    if not entries:
        return ""

    parts = []
    for entry in entries[:10]:
        title = getattr(entry, "title", "") or ""
        link = getattr(entry, "link", "") or ""
        parts.append(f"{title}|{link}")

    return _sha256("||".join(parts))
