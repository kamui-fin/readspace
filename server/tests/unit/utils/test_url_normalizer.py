"""Unit tests for URL normalizer utility functions."""

import pytest

from app.utils.url_normalizer import extract_domain_from_url


class TestExtractDomainFromUrl:
    """Test suite for extract_domain_from_url function."""

    def test_extract_domain_from_https_url(self):
        """Test extracting domain from https URL."""
        url = "https://www.example.com/feed"
        result = extract_domain_from_url(url)
        assert result == "example.com"

    def test_extract_domain_from_http_url(self):
        """Test extracting domain from http URL."""
        url = "http://www.example.com/rss"
        result = extract_domain_from_url(url)
        assert result == "example.com"

    def test_extract_domain_from_url_with_path(self):
        """Test extracting domain from URL with path."""
        url = "https://example.com/path/to/feed.xml"
        result = extract_domain_from_url(url)
        assert result == "example.com"

    def test_extract_domain_from_subdomain(self):
        """Test extracting domain from URL with subdomain."""
        url = "https://blog.example.co.uk/rss"
        result = extract_domain_from_url(url)
        assert result == "blog.example.co.uk"

    def test_extract_domain_from_url_with_port(self):
        """Test extracting domain from URL with port."""
        url = "https://example.com:8080/feed"
        result = extract_domain_from_url(url)
        assert result == "example.com"

    def test_extract_domain_from_url_with_www_and_port(self):
        """Test extracting domain from URL with www and port."""
        url = "https://www.example.com:8080/feed"
        result = extract_domain_from_url(url)
        assert result == "example.com"

    def test_extract_domain_removes_www_prefix(self):
        """Test that www prefix is removed."""
        url = "https://www.example.com"
        result = extract_domain_from_url(url)
        assert result == "example.com"

    def test_extract_domain_from_url_without_www(self):
        """Test extracting domain from URL without www."""
        url = "https://example.com"
        result = extract_domain_from_url(url)
        assert result == "example.com"

    def test_extract_domain_from_url_with_query_params(self):
        """Test extracting domain from URL with query parameters."""
        url = "https://example.com/feed?param=value&other=123"
        result = extract_domain_from_url(url)
        assert result == "example.com"

    def test_extract_domain_from_empty_string(self):
        """Test extracting domain from empty string."""
        url = ""
        result = extract_domain_from_url(url)
        assert result == "Unknown Feed"

    def test_extract_domain_from_none(self):
        """Test extracting domain from None."""
        url = None  # type: ignore
        result = extract_domain_from_url(url)
        assert result == "Unknown Feed"

    def test_extract_domain_from_url_without_scheme(self):
        """Test extracting domain from URL without scheme."""
        url = "example.com/feed"
        result = extract_domain_from_url(url)
        assert result == "example.com"

    def test_extract_domain_from_url_without_scheme_with_www(self):
        """Test extracting domain from URL without scheme but with www."""
        url = "www.example.com/feed"
        result = extract_domain_from_url(url)
        assert result == "example.com"

    def test_extract_domain_preserves_case_lowercase(self):
        """Test that domain is converted to lowercase."""
        url = "https://EXAMPLE.COM/feed"
        result = extract_domain_from_url(url)
        assert result == "example.com"

    def test_extract_domain_from_complex_subdomain(self):
        """Test extracting domain from complex subdomain."""
        url = "https://feeds.news.example.com/rss/feed.xml"
        result = extract_domain_from_url(url)
        assert result == "feeds.news.example.com"

    def test_extract_domain_from_localhost(self):
        """Test extracting domain from localhost URL."""
        url = "http://localhost:8000/feed"
        result = extract_domain_from_url(url)
        assert result == "localhost"

    def test_extract_domain_from_ip_address(self):
        """Test extracting domain from IP address."""
        url = "http://192.168.1.1:8080/feed"
        result = extract_domain_from_url(url)
        assert result == "192.168.1.1"

    def test_extract_domain_from_invalid_url(self):
        """Test extracting domain from malformed URL."""
        url = "not a valid url"
        result = extract_domain_from_url(url)
        # Should still attempt to extract something or return fallback
        assert isinstance(result, str)
        assert len(result) > 0
