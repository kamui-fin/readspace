"""Tests for URL normalization functionality."""

from app.utils.url_normalizer import are_urls_equivalent, normalize_feed_url


class TestUrlNormalizer:
    """Test URL normalization functionality."""

    def test_trailing_slash_removal(self):
        """Test removal of trailing slashes."""
        assert normalize_feed_url("https://example.com/feed/") == "https://example.com/feed"
        # Root path should keep the slash
        assert normalize_feed_url("https://example.com/") == "https://example.com/"

    def test_http_to_https_conversion(self):
        """Test HTTP to HTTPS conversion."""
        assert normalize_feed_url("http://example.com/feed") == "https://example.com/feed"

    def test_www_removal(self):
        """Test www prefix removal."""
        assert normalize_feed_url("https://www.example.com/feed") == "https://example.com/feed"

    def test_combined_normalizations(self):
        """Test multiple normalizations together."""
        assert normalize_feed_url("http://www.example.com/feed/") == "https://example.com/feed"

    def test_tracking_parameter_removal(self):
        """Test removal of tracking parameters."""
        url_with_tracking = "https://example.com/feed?utm_source=twitter&fbclid=123"
        assert normalize_feed_url(url_with_tracking) == "https://example.com/feed"

    def test_legitimate_parameter_preservation(self):
        """Test that legitimate parameters are kept while tracking ones are removed."""
        url = "https://example.com/feed?format=rss&utm_source=twitter&page=1"
        result = normalize_feed_url(url)
        assert "format=rss" in result
        assert "page=1" in result
        assert "utm_source" not in result

    def test_fragment_removal(self):
        """Test removal of URL fragments."""
        assert normalize_feed_url("https://example.com/feed#section1") == "https://example.com/feed"

    def test_domain_case_normalization(self):
        """Test domain case normalization (path case preserved)."""
        assert normalize_feed_url("https://EXAMPLE.COM/Feed") == "https://example.com/Feed"

    def test_complex_normalization(self):
        """Test complex URL with multiple issues."""
        complex_url = "http://www.EXAMPLE.com/feed/?utm_campaign=test#anchor"
        assert normalize_feed_url(complex_url) == "https://example.com/feed"

    def test_edge_cases(self):
        """Test edge cases."""
        # Empty string
        assert normalize_feed_url("") == ""

        # None
        assert normalize_feed_url(None) == None

        # Non-string
        assert normalize_feed_url(123) == 123

        # Invalid URL (should return original)
        assert normalize_feed_url("not-a-url") == "not-a-url"

    def test_non_http_schemes(self):
        """Test that non-HTTP schemes are preserved."""
        ftp_url = "ftp://example.com/file.xml"
        assert normalize_feed_url(ftp_url) == "ftp://example.com/file.xml"

    def test_url_equivalence(self):
        """Test URL equivalence checking."""
        assert are_urls_equivalent("https://example.com/feed", "http://example.com/feed/")
        assert are_urls_equivalent("https://www.example.com/feed", "https://example.com/feed")
        assert are_urls_equivalent("https://example.com/feed?utm_source=test", "https://example.com/feed")

        # Non-equivalent URLs
        assert not are_urls_equivalent("https://example.com/feed", "https://different.com/feed")
        assert not are_urls_equivalent("https://example.com/feed1", "https://example.com/feed2")
