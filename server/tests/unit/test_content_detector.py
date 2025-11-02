"""Unit tests for content detector utility."""

from app.utils.content_detector import is_content_complete


def test_is_content_complete_with_none():
    """Test that None content is detected as incomplete."""
    assert is_content_complete(None) is False


def test_is_content_complete_with_empty_string():
    """Test that empty string content is detected as incomplete."""
    assert is_content_complete("") is False


def test_is_content_complete_below_threshold():
    """Test that content below threshold is detected as incomplete."""
    assert is_content_complete("a" * 499) is False


def test_is_content_complete_at_threshold():
    """Test that content at exactly threshold is detected as complete."""
    assert is_content_complete("a" * 500) is True


def test_is_content_complete_above_threshold():
    """Test that content above threshold is detected as complete."""
    assert is_content_complete("a" * 1000) is True


def test_is_content_complete_custom_threshold():
    """Test that custom threshold values work correctly."""
    assert is_content_complete("a" * 100, threshold=200) is False
    assert is_content_complete("a" * 200, threshold=200) is True
    assert is_content_complete("a" * 300, threshold=200) is True


def test_is_content_complete_realistic_excerpt():
    """Test with realistic excerpt-length content."""
    excerpt = "This is a short article excerpt. " * 10  # ~340 chars
    assert is_content_complete(excerpt) is False


def test_is_content_complete_realistic_full_article():
    """Test with realistic full article-length content."""
    full_article = "This is a full article with multiple paragraphs. " * 15  # ~750 chars
    assert is_content_complete(full_article) is True
