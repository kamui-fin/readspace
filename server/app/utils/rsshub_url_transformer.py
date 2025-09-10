"""Utility for transforming rsshub:// URLs to actual HTTP URLs."""

from app.core.config import get_settings


def transform_rsshub_url(url: str) -> str:
    """
    Transform rsshub:// URLs to actual HTTP URLs using the configured RSSHUB_URL.
    
    Args:
        url: The URL to transform. If it starts with 'rsshub://', it will be
             transformed using the RSSHUB_URL setting. Otherwise, returns unchanged.
    
    Returns:
        The transformed URL if it was an rsshub:// URL, otherwise the original URL.
    
    Examples:
        >>> # With RSSHUB_URL = "https://rsshub.app"
        >>> transform_rsshub_url("rsshub://android/security-bulletin")
        "https://rsshub.app/android/security-bulletin"
        
        >>> transform_rsshub_url("https://example.com/feed.xml")
        "https://example.com/feed.xml"
    """
    if not url.startswith("rsshub://"):
        return url

    settings = get_settings()
    rsshub_base_url = settings.RSSHUB_URL.rstrip("/")

    # Extract the path after rsshub://
    path = url[len("rsshub://"):]

    return f"{rsshub_base_url}/{path}"
