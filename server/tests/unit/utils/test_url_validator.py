"""Unit tests for URL validation utilities."""

from unittest.mock import MagicMock, patch

import pytest

from app.utils.url.url_validator import validate_feed_url, validate_folder_name


@pytest.mark.unit
class TestValidateFeedUrl:
    """Tests for validate_feed_url function."""

    def test_valid_https_url(self):
        """Valid HTTPS URLs should pass validation."""
        is_valid, error = validate_feed_url("https://example.com/feed.xml")
        assert is_valid is True
        assert error is None

    def test_valid_http_url(self):
        """Valid HTTP URLs should pass validation."""
        is_valid, error = validate_feed_url("http://example.com/feed.xml")
        assert is_valid is True
        assert error is None

    def test_rsshub_url_passes_validation(self):
        """rsshub:// URLs should pass validation when allowed."""
        is_valid, error = validate_feed_url("rsshub://washingtonpost/app", allow_rsshub=True)
        assert is_valid is True
        assert error is None

    def test_rsshub_url_rejected_when_not_allowed(self):
        """rsshub:// URLs should be rejected when not allowed."""
        is_valid, error = validate_feed_url("rsshub://washingtonpost/app", allow_rsshub=False)
        assert is_valid is False
        assert "Invalid URL scheme" in error

    def test_localhost_blocked_by_default(self):
        """Localhost URLs should be blocked for security."""
        is_valid, error = validate_feed_url("http://localhost/feed.xml")
        assert is_valid is False
        assert "blocked domain: localhost" in error

    def test_localhost_with_port_blocked_by_default(self):
        """Localhost URLs with port should be blocked for security."""
        is_valid, error = validate_feed_url("http://localhost:8080/feed.xml")
        assert is_valid is False
        assert "blocked domain: localhost" in error

    @patch("app.utils.url.url_validator.get_settings")
    def test_rsshub_localhost_allowed(self, mock_settings: MagicMock):
        """Localhost should be allowed when it's the configured RSSHub URL."""
        # Mock settings to return localhost:1200 as RSSHub URL
        mock_settings_obj = MagicMock()
        mock_settings_obj.RSSHUB_URL = "http://localhost:1200"
        mock_settings.return_value = mock_settings_obj

        is_valid, error = validate_feed_url("http://localhost:1200/washingtonpost/app", allow_rsshub=False)
        assert is_valid is True
        assert error is None

    @patch("app.utils.url.url_validator.get_settings")
    def test_rsshub_localhost_with_different_port_blocked(self, mock_settings: MagicMock):
        """Localhost with different port should still be blocked."""
        # Mock settings to return localhost:1200 as RSSHub URL
        mock_settings_obj = MagicMock()
        mock_settings_obj.RSSHUB_URL = "http://localhost:1200"
        mock_settings.return_value = mock_settings_obj

        # Try to access localhost:8080 (different port)
        is_valid, error = validate_feed_url("http://localhost:8080/feed.xml", allow_rsshub=False)
        assert is_valid is False
        assert "blocked domain: localhost" in error

    def test_127_0_0_1_blocked(self):
        """127.0.0.1 URLs should be blocked for security."""
        is_valid, error = validate_feed_url("http://127.0.0.1/feed.xml")
        assert is_valid is False
        assert "blocked domain: 127.0.0.1" in error

    def test_ipv6_localhost_blocked(self):
        """IPv6 localhost URLs should be blocked for security."""
        is_valid, error = validate_feed_url("http://[::1]/feed.xml")
        assert is_valid is False
        assert "blocked domain: [::1]" in error

    def test_private_ip_10_0_0_1_blocked(self):
        """Private IP addresses (10.x.x.x) should be blocked."""
        is_valid, error = validate_feed_url("http://10.0.0.1/feed.xml")
        assert is_valid is False
        assert "private IP address" in error

    def test_private_ip_192_168_blocked(self):
        """Private IP addresses (192.168.x.x) should be blocked."""
        is_valid, error = validate_feed_url("http://192.168.1.1/feed.xml")
        assert is_valid is False
        assert "private IP address" in error

    def test_private_ip_172_16_blocked(self):
        """Private IP addresses (172.16-31.x.x) should be blocked."""
        is_valid, error = validate_feed_url("http://172.16.0.1/feed.xml")
        assert is_valid is False
        assert "private IP address" in error

        is_valid, error = validate_feed_url("http://172.31.255.255/feed.xml")
        assert is_valid is False
        assert "private IP address" in error

    def test_link_local_ip_blocked(self):
        """Link-local IP addresses (169.254.x.x) should be blocked."""
        is_valid, error = validate_feed_url("http://169.254.1.1/feed.xml")
        assert is_valid is False
        assert "private IP address" in error

    def test_file_protocol_blocked(self):
        """File protocol should be blocked."""
        is_valid, error = validate_feed_url("file:///etc/passwd")
        assert is_valid is False
        assert "Invalid URL scheme: file" in error

    def test_ftp_protocol_blocked(self):
        """FTP protocol should be blocked."""
        is_valid, error = validate_feed_url("ftp://example.com/feed.xml")
        assert is_valid is False
        assert "Invalid URL scheme: ftp" in error

    def test_javascript_protocol_blocked(self):
        """JavaScript protocol should be blocked."""
        is_valid, error = validate_feed_url("javascript:alert('xss')")
        assert is_valid is False
        assert "Invalid URL scheme: javascript" in error

    def test_empty_netloc_rejected(self):
        """URLs with empty netloc should be rejected."""
        is_valid, error = validate_feed_url("http://")
        assert is_valid is False
        assert "no domain/host" in error

    def test_invalid_url_format(self):
        """Invalid URL format should be rejected."""
        is_valid, error = validate_feed_url("not-a-url")
        assert is_valid is False
        # Should either be scheme error or format error
        assert error is not None

    def test_url_with_subdomain(self):
        """URLs with subdomains should be allowed."""
        is_valid, error = validate_feed_url("https://blog.example.com/feed.xml")
        assert is_valid is True
        assert error is None

    def test_url_with_port(self):
        """URLs with ports should be allowed for public domains."""
        is_valid, error = validate_feed_url("https://example.com:8443/feed.xml")
        assert is_valid is True
        assert error is None

    def test_url_with_query_params(self):
        """URLs with query parameters should be allowed."""
        is_valid, error = validate_feed_url("https://example.com/feed.xml?format=rss&lang=en")
        assert is_valid is True
        assert error is None

    def test_url_with_fragment(self):
        """URLs with fragments should be allowed."""
        is_valid, error = validate_feed_url("https://example.com/feed.xml#section")
        assert is_valid is True
        assert error is None

    def test_url_with_auth(self):
        """URLs with authentication should be allowed."""
        is_valid, error = validate_feed_url("https://user:pass@example.com/feed.xml")
        assert is_valid is True
        assert error is None

    @patch("app.utils.url.url_validator.get_settings")
    def test_rsshub_production_url_allowed(self, mock_settings: MagicMock):
        """Production RSSHub URLs should be allowed."""
        mock_settings_obj = MagicMock()
        mock_settings_obj.RSSHUB_URL = "https://rsshub.app"
        mock_settings.return_value = mock_settings_obj

        is_valid, error = validate_feed_url("https://rsshub.app/twitter/user/elonmusk", allow_rsshub=False)
        assert is_valid is True
        assert error is None

    @patch("app.utils.url.url_validator.get_settings")
    def test_rsshub_custom_domain_allowed(self, mock_settings: MagicMock):
        """Custom RSSHub domain should be allowed."""
        mock_settings_obj = MagicMock()
        mock_settings_obj.RSSHUB_URL = "https://custom-rsshub.example.com"
        mock_settings.return_value = mock_settings_obj

        is_valid, error = validate_feed_url("https://custom-rsshub.example.com/route/path", allow_rsshub=False)
        assert is_valid is True
        assert error is None


@pytest.mark.unit
class TestValidateFolderName:
    """Tests for validate_folder_name function."""

    def test_valid_folder_name(self):
        """Valid folder names should pass validation."""
        is_valid, error = validate_folder_name("My Folder")
        assert is_valid is True
        assert error is None

    def test_folder_name_with_numbers(self):
        """Folder names with numbers should be allowed."""
        is_valid, error = validate_folder_name("Tech News 2025")
        assert is_valid is True
        assert error is None

    def test_folder_name_with_hyphens(self):
        """Folder names with hyphens should be allowed."""
        is_valid, error = validate_folder_name("Tech-News-Updates")
        assert is_valid is True
        assert error is None

    def test_folder_name_with_underscores(self):
        """Folder names with underscores should be allowed."""
        is_valid, error = validate_folder_name("Tech_News_Updates")
        assert is_valid is True
        assert error is None

    def test_folder_name_with_parentheses(self):
        """Folder names with parentheses should be allowed."""
        is_valid, error = validate_folder_name("Tech News (Archive)")
        assert is_valid is True
        assert error is None

    def test_folder_name_with_brackets(self):
        """Folder names with brackets should be allowed."""
        is_valid, error = validate_folder_name("Tech News [2025]")
        assert is_valid is True
        assert error is None

    def test_empty_folder_name_rejected(self):
        """Empty folder names should be rejected."""
        is_valid, error = validate_folder_name("")
        assert is_valid is False
        assert "cannot be empty" in error

    def test_whitespace_only_folder_name_rejected(self):
        """Whitespace-only folder names should be rejected."""
        is_valid, error = validate_folder_name("   ")
        assert is_valid is False
        assert "cannot be empty" in error

    def test_folder_name_too_long_rejected(self):
        """Folder names longer than 100 characters should be rejected."""
        is_valid, error = validate_folder_name("x" * 101)
        assert is_valid is False
        assert "100 characters or less" in error

    def test_folder_name_with_leading_whitespace_rejected(self):
        """Folder names with leading whitespace should be rejected."""
        is_valid, error = validate_folder_name(" Leading Space")
        assert is_valid is False
        assert "cannot start or end with whitespace" in error

    def test_folder_name_with_trailing_whitespace_rejected(self):
        """Folder names with trailing whitespace should be rejected."""
        is_valid, error = validate_folder_name("Trailing Space ")
        assert is_valid is False
        assert "cannot start or end with whitespace" in error

    def test_folder_name_with_slashes_rejected(self):
        """Folder names with slashes should be rejected."""
        is_valid, error = validate_folder_name("Tech/News")
        assert is_valid is False
        assert "invalid characters" in error

    def test_folder_name_with_special_chars_rejected(self):
        """Folder names with special characters should be rejected."""
        is_valid, error = validate_folder_name("Tech@News!")
        assert is_valid is False
        assert "invalid characters" in error

    def test_folder_name_unicode_allowed(self):
        """Folder names with Unicode characters should be allowed."""
        is_valid, error = validate_folder_name("科技新闻")
        assert is_valid is True
        assert error is None

        is_valid, error = validate_folder_name("Технологии")
        assert is_valid is True
        assert error is None
