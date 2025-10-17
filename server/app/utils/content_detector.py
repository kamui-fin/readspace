"""Utility for detecting content completeness."""


def is_content_complete(content: str | None, threshold: int = 500) -> bool:
    """
    Determine if article content is complete or truncated.

    Uses a simple length-based heuristic to detect if content appears to be
    a full article or just a summary/excerpt.

    Args:
        content: The article content to check
        threshold: Minimum character length for complete content (default: 500)

    Returns:
        True if content appears complete, False if it appears truncated or missing

    Examples:
        >>> is_content_complete(None)
        False
        >>> is_content_complete("")
        False
        >>> is_content_complete("Short text")
        False
        >>> is_content_complete("A" * 500)
        True
    """
    if content is None or content == "":
        return False

    return len(content) >= threshold
