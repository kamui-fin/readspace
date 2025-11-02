"""Domain extraction and cleaning utilities."""

from urllib.parse import urlparse


def extract_clean_domain(url_or_domain: str) -> str:
    """Extract and clean domain from URL or domain string.

    Performs the following operations:
    - Converts to lowercase
    - Removes 'www.' prefix
    - Extracts domain from full URL if needed
    - Returns empty string if invalid

    Args:
        url_or_domain: URL string or domain string to clean

    Returns:
        Cleaned domain string, or empty string if invalid

    Examples:
        >>> extract_clean_domain("https://www.example.com/path")
        'example.com'
        >>> extract_clean_domain("WWW.EXAMPLE.COM")
        'example.com'
        >>> extract_clean_domain("example.com")
        'example.com'
    """
    if not url_or_domain:
        return ""

    domain = url_or_domain.lower().strip()

    # If it's a URL, extract domain
    if "://" in domain:
        try:
            parsed = urlparse(domain)
            domain = parsed.netloc
        except Exception:
            # If parsing fails, try to extract manually
            parts = domain.split("://", 1)
            if len(parts) == 2:
                domain = parts[1].split("/")[0]

    # Remove www prefix
    if domain.startswith("www."):
        domain = domain[4:]

    return domain
