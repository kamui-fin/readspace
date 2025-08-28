"""Tests for the GUID generator utility."""

import pytest
from app.utils.guid_generator import generate_stable_guid


class TestGuidGenerator:
    """Test cases for stable GUID generation."""

    def test_generate_stable_guid_with_original_guid(self):
        """Should return original GUID when provided."""
        original_guid = "test-guid-123"
        result = generate_stable_guid(original_guid=original_guid)
        assert result == original_guid

    def test_generate_stable_guid_with_empty_original_guid(self):
        """Should fallback to link when original GUID is empty."""
        link = "https://example.com/article"
        result = generate_stable_guid(original_guid="", link=link)
        assert result == link

    def test_generate_stable_guid_with_whitespace_original_guid(self):
        """Should fallback to link when original GUID is whitespace."""
        link = "https://example.com/article"
        result = generate_stable_guid(original_guid="   ", link=link)
        assert result == link

    def test_generate_stable_guid_with_link_fallback(self):
        """Should return link when no original GUID."""
        link = "https://example.com/article"
        result = generate_stable_guid(link=link)
        assert result == link

    def test_generate_stable_guid_with_empty_link(self):
        """Should fallback to hash when link is empty."""
        title = "Test Article"
        published_at = "2023-01-01"
        content = "This is test content"
        
        result = generate_stable_guid(
            link="", 
            title=title, 
            published_at=published_at, 
            content=content
        )
        assert result.startswith("hash:")
        assert len(result) == 69  # "hash:" + 64 char hex

    def test_generate_stable_guid_hash_consistency(self):
        """Should generate consistent hashes for same input."""
        title = "Test Article"
        published_at = "2023-01-01"
        content = "This is test content"
        
        result1 = generate_stable_guid(
            title=title, 
            published_at=published_at, 
            content=content
        )
        result2 = generate_stable_guid(
            title=title, 
            published_at=published_at, 
            content=content
        )
        
        assert result1 == result2
        assert result1.startswith("hash:")

    def test_generate_stable_guid_hash_different_inputs(self):
        """Should generate different hashes for different inputs."""
        result1 = generate_stable_guid(
            title="Article 1", 
            published_at="2023-01-01", 
            content="Content 1"
        )
        result2 = generate_stable_guid(
            title="Article 2", 
            published_at="2023-01-02", 
            content="Content 2"
        )
        
        assert result1 != result2
        assert result1.startswith("hash:")
        assert result2.startswith("hash:")

    def test_generate_stable_guid_truncate_content(self):
        """Should only use first 1000 characters of content for hashing."""
        long_content = "x" * 2000
        short_content = "x" * 1000
        
        result1 = generate_stable_guid(
            title="Test", 
            published_at="2023-01-01", 
            content=long_content
        )
        result2 = generate_stable_guid(
            title="Test", 
            published_at="2023-01-01", 
            content=short_content
        )
        
        assert result1 == result2

    def test_generate_stable_guid_with_none_values(self):
        """Should handle None values gracefully."""
        result = generate_stable_guid(
            original_guid=None,
            link=None,
            title=None,
            published_at=None,
            content=None
        )
        
        assert result.startswith("hash:")
        # Should be hash of empty strings concatenated with |
        expected_input = "||"
        assert len(result) == 69

    def test_generate_stable_guid_priority_order(self):
        """Should respect priority order: guid > link > hash."""
        original_guid = "test-guid"
        link = "https://example.com"
        title = "Test"
        
        # Should use original GUID even if link provided
        result1 = generate_stable_guid(
            original_guid=original_guid,
            link=link,
            title=title
        )
        assert result1 == original_guid
        
        # Should use link if no GUID
        result2 = generate_stable_guid(
            link=link,
            title=title
        )
        assert result2 == link
        
        # Should use hash if neither GUID nor link
        result3 = generate_stable_guid(title=title)
        assert result3.startswith("hash:")

    def test_generate_stable_guid_strips_whitespace(self):
        """Should strip whitespace from GUID and link."""
        result1 = generate_stable_guid(original_guid="  test-guid  ")
        assert result1 == "test-guid"
        
        result2 = generate_stable_guid(link="  https://example.com  ")
        assert result2 == "https://example.com"