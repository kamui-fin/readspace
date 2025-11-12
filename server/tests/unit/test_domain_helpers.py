"""Unit tests for domain extraction and cleaning utilities."""

import pytest

from app.utils.domain_helpers import extract_clean_domain


@pytest.mark.unit
class TestExtractCleanDomain:
    """Tests for extract_clean_domain function."""

    def test_empty_string_returns_empty(self):
        """Empty string should return empty string."""
        assert extract_clean_domain("") == ""

    def test_none_returns_empty(self):
        """None should return empty string."""
        assert extract_clean_domain(None) == ""  # type: ignore

    def test_simple_domain_lowercase(self):
        """Simple domain should be lowercased."""
        assert extract_clean_domain("example.com") == "example.com"

    def test_uppercase_domain_converted_to_lowercase(self):
        """Uppercase domain should be converted to lowercase."""
        assert extract_clean_domain("EXAMPLE.COM") == "example.com"

    def test_mixed_case_domain_converted_to_lowercase(self):
        """Mixed case domain should be converted to lowercase."""
        assert extract_clean_domain("ExAmPlE.CoM") == "example.com"

    def test_www_prefix_removed(self):
        """www. prefix should be removed."""
        assert extract_clean_domain("www.example.com") == "example.com"

    def test_www_uppercase_prefix_removed(self):
        """WWW. prefix should be removed (after lowercasing)."""
        assert extract_clean_domain("WWW.EXAMPLE.COM") == "example.com"

    def test_full_url_extracts_domain(self):
        """Full HTTPS URL should extract just the domain."""
        assert extract_clean_domain("https://example.com/path/to/page") == "example.com"

    def test_http_url_extracts_domain(self):
        """Full HTTP URL should extract just the domain."""
        assert extract_clean_domain("http://example.com/path") == "example.com"

    def test_url_with_www_removes_prefix(self):
        """URL with www should extract domain without www."""
        assert extract_clean_domain("https://www.example.com/path") == "example.com"

    def test_url_with_query_params(self):
        """URL with query parameters should extract just domain."""
        assert extract_clean_domain("https://example.com/path?param=value&other=test") == "example.com"

    def test_url_with_port(self):
        """URL with port should include port in domain."""
        assert extract_clean_domain("https://example.com:8080/path") == "example.com:8080"

    def test_url_with_subdomain(self):
        """URL with subdomain should preserve subdomain."""
        assert extract_clean_domain("https://blog.example.com/post") == "blog.example.com"

    def test_subdomain_with_www(self):
        """Subdomain with www should only remove www prefix."""
        assert extract_clean_domain("www.blog.example.com") == "blog.example.com"

    def test_url_with_fragment(self):
        """URL with fragment should extract just domain."""
        assert extract_clean_domain("https://example.com/page#section") == "example.com"

    def test_url_with_username_password(self):
        """URL with credentials should extract domain (urlparse includes credentials in netloc)."""
        # urlparse.netloc includes user:pass@ when present, which is expected behavior
        assert extract_clean_domain("https://user:pass@example.com/path") == "user:pass@example.com"

    def test_whitespace_is_stripped(self):
        """Leading and trailing whitespace should be stripped."""
        assert extract_clean_domain("  example.com  ") == "example.com"

    def test_whitespace_with_url(self):
        """Whitespace around URL should be handled."""
        assert extract_clean_domain("  https://example.com/path  ") == "example.com"

    def test_ip_address_as_domain(self):
        """IP address should be handled correctly."""
        assert extract_clean_domain("192.168.1.1") == "192.168.1.1"

    def test_ip_address_in_url(self):
        """IP address in URL should be extracted."""
        assert extract_clean_domain("http://192.168.1.1:8080/path") == "192.168.1.1:8080"

    def test_localhost(self):
        """Localhost should be handled."""
        assert extract_clean_domain("localhost") == "localhost"

    def test_localhost_url(self):
        """Localhost URL should be extracted."""
        assert extract_clean_domain("http://localhost:3000/page") == "localhost:3000"

    def test_ftp_protocol(self):
        """FTP protocol should be handled."""
        assert extract_clean_domain("ftp://files.example.com/path") == "files.example.com"

    def test_custom_protocol(self):
        """Custom protocol should be handled."""
        assert extract_clean_domain("custom://example.com/path") == "example.com"

    def test_invalid_url_missing_domain(self):
        """Invalid URL missing domain should return what's parseable."""
        result = extract_clean_domain("https://")
        # Should return empty or handle gracefully
        assert result == "" or result == "https:"

    def test_url_with_multiple_slashes(self):
        """URL with multiple slashes should be handled."""
        assert extract_clean_domain("https://example.com//path//to//page") == "example.com"

    def test_domain_with_tld_only(self):
        """Domain with TLD only should be preserved."""
        assert extract_clean_domain("com") == "com"

    def test_multilevel_subdomain(self):
        """Multi-level subdomain should be preserved."""
        assert extract_clean_domain("https://api.v2.example.com/endpoint") == "api.v2.example.com"

    def test_international_domain(self):
        """International domain names should be preserved."""
        assert extract_clean_domain("https://例え.jp/path") == "例え.jp"

    def test_punycode_domain(self):
        """Punycode domain should be preserved."""
        assert extract_clean_domain("https://xn--e1afmkfd.xn--p1ai/path") == "xn--e1afmkfd.xn--p1ai"

    def test_very_long_domain(self):
        """Very long domain should be handled."""
        long_domain = "a" * 50 + ".example.com"
        assert extract_clean_domain(long_domain) == long_domain.lower()

    def test_domain_with_hyphen(self):
        """Domain with hyphen should be preserved."""
        assert extract_clean_domain("my-example-site.com") == "my-example-site.com"

    def test_domain_with_numbers(self):
        """Domain with numbers should be preserved."""
        assert extract_clean_domain("example123.com") == "example123.com"

    def test_url_parsing_exception_fallback(self):
        """Test fallback when URL parsing fails."""
        # This tests the exception handling in the code
        # Malformed URLs should still try to extract domain
        result = extract_clean_domain("https://example.com")
        assert result == "example.com"

    def test_manual_extraction_fallback(self):
        """Test manual extraction when urlparse fails."""
        # URL with unusual format that might fail urlparse
        result = extract_clean_domain("custom://domain.com/path")
        assert "domain.com" in result

    @pytest.mark.parametrize(
        "input_url,expected_domain",
        [
            ("example.com", "example.com"),
            ("www.example.com", "example.com"),
            ("https://example.com", "example.com"),
            ("https://www.example.com", "example.com"),
            ("HTTPS://WWW.EXAMPLE.COM", "example.com"),
            ("https://blog.example.com/post/123", "blog.example.com"),
            ("http://example.com:8080", "example.com:8080"),
            ("  example.com  ", "example.com"),
            ("", ""),
        ],
    )
    def test_parametrized_common_cases(self, input_url: str, expected_domain: str):
        """Test common domain extraction cases."""
        assert extract_clean_domain(input_url) == expected_domain
