"""Unit tests for RSSHub URL transformation utilities."""

from unittest.mock import MagicMock, patch

import pytest

from app.utils.rsshub_url_transformer import transform_rsshub_url


@pytest.mark.unit
class TestTransformRsshubUrl:
    """Tests for transform_rsshub_url function."""

    @patch("app.utils.rsshub_url_transformer.get_settings")
    def test_non_rsshub_url_returned_unchanged(self, mock_settings: MagicMock):
        """Non-rsshub:// URLs should be returned unchanged."""
        url = "https://example.com/feed.xml"
        result = transform_rsshub_url(url)

        assert result == url
        # get_settings should not be called for non-rsshub URLs
        mock_settings.assert_not_called()

    @patch("app.utils.rsshub_url_transformer.get_settings")
    def test_http_url_returned_unchanged(self, mock_settings: MagicMock):
        """HTTP URLs should be returned unchanged."""
        url = "http://example.com/feed.xml"
        result = transform_rsshub_url(url)

        assert result == url
        mock_settings.assert_not_called()

    @patch("app.utils.rsshub_url_transformer.get_settings")
    def test_rsshub_url_transformed(self, mock_settings: MagicMock):
        """rsshub:// URLs should be transformed using RSSHUB_URL setting."""
        # Mock settings
        mock_settings_obj = MagicMock()
        mock_settings_obj.RSSHUB_URL = "https://rsshub.app"
        mock_settings.return_value = mock_settings_obj

        url = "rsshub://android/security-bulletin"
        result = transform_rsshub_url(url)

        assert result == "https://rsshub.app/android/security-bulletin"
        mock_settings.assert_called_once()

    @patch("app.utils.rsshub_url_transformer.get_settings")
    def test_rsshub_url_with_trailing_slash_in_base(self, mock_settings: MagicMock):
        """RSSHUB_URL with trailing slash should be handled correctly."""
        mock_settings_obj = MagicMock()
        mock_settings_obj.RSSHUB_URL = "https://rsshub.app/"
        mock_settings.return_value = mock_settings_obj

        url = "rsshub://android/security-bulletin"
        result = transform_rsshub_url(url)

        # Should not have double slash
        assert result == "https://rsshub.app/android/security-bulletin"
        assert "//" not in result.replace("https://", "")

    @patch("app.utils.rsshub_url_transformer.get_settings")
    def test_rsshub_url_with_complex_path(self, mock_settings: MagicMock):
        """rsshub:// URLs with complex paths should be transformed correctly."""
        mock_settings_obj = MagicMock()
        mock_settings_obj.RSSHUB_URL = "https://rsshub.app"
        mock_settings.return_value = mock_settings_obj

        url = "rsshub://twitter/user/someuser/with_replies"
        result = transform_rsshub_url(url)

        assert result == "https://rsshub.app/twitter/user/someuser/with_replies"

    @patch("app.utils.rsshub_url_transformer.get_settings")
    def test_rsshub_url_with_query_params(self, mock_settings: MagicMock):
        """rsshub:// URLs with query parameters should be preserved."""
        mock_settings_obj = MagicMock()
        mock_settings_obj.RSSHUB_URL = "https://rsshub.app"
        mock_settings.return_value = mock_settings_obj

        url = "rsshub://route/path?param=value&other=test"
        result = transform_rsshub_url(url)

        assert result == "https://rsshub.app/route/path?param=value&other=test"

    @patch("app.utils.rsshub_url_transformer.get_settings")
    def test_custom_rsshub_base_url(self, mock_settings: MagicMock):
        """Custom RSSHUB_URL should be used for transformation."""
        mock_settings_obj = MagicMock()
        mock_settings_obj.RSSHUB_URL = "https://custom-rsshub.example.com"
        mock_settings.return_value = mock_settings_obj

        url = "rsshub://android/security-bulletin"
        result = transform_rsshub_url(url)

        assert result == "https://custom-rsshub.example.com/android/security-bulletin"

    @patch("app.utils.rsshub_url_transformer.get_settings")
    def test_rsshub_url_with_port(self, mock_settings: MagicMock):
        """RSSHUB_URL with port should be handled correctly."""
        mock_settings_obj = MagicMock()
        mock_settings_obj.RSSHUB_URL = "http://localhost:1200"
        mock_settings.return_value = mock_settings_obj

        url = "rsshub://android/security-bulletin"
        result = transform_rsshub_url(url)

        assert result == "http://localhost:1200/android/security-bulletin"

    @patch("app.utils.rsshub_url_transformer.get_settings")
    def test_empty_rsshub_path(self, mock_settings: MagicMock):
        """rsshub:// with empty path should be handled."""
        mock_settings_obj = MagicMock()
        mock_settings_obj.RSSHUB_URL = "https://rsshub.app"
        mock_settings.return_value = mock_settings_obj

        url = "rsshub://"
        result = transform_rsshub_url(url)

        assert result == "https://rsshub.app/"

    @patch("app.utils.rsshub_url_transformer.get_settings")
    def test_rsshub_url_case_sensitive(self, mock_settings: MagicMock):
        """rsshub:// protocol check should be case-sensitive."""
        # RSSHUB:// (uppercase) should NOT be transformed
        url = "RSSHUB://android/security-bulletin"
        result = transform_rsshub_url(url)

        assert result == url
        mock_settings.assert_not_called()

    @patch("app.utils.rsshub_url_transformer.get_settings")
    def test_rsshub_in_middle_of_url(self, mock_settings: MagicMock):
        """rsshub:// in middle of URL should not trigger transformation."""
        url = "https://example.com/rsshub://path"
        result = transform_rsshub_url(url)

        assert result == url
        mock_settings.assert_not_called()

    @patch("app.utils.rsshub_url_transformer.get_settings")
    def test_rsshub_url_with_fragment(self, mock_settings: MagicMock):
        """rsshub:// URL with fragment should be preserved."""
        mock_settings_obj = MagicMock()
        mock_settings_obj.RSSHUB_URL = "https://rsshub.app"
        mock_settings.return_value = mock_settings_obj

        url = "rsshub://route/path#section"
        result = transform_rsshub_url(url)

        assert result == "https://rsshub.app/route/path#section"

    @patch("app.utils.rsshub_url_transformer.get_settings")
    def test_rsshub_url_with_multiple_slashes(self, mock_settings: MagicMock):
        """rsshub:// URL with multiple slashes in path should be preserved."""
        mock_settings_obj = MagicMock()
        mock_settings_obj.RSSHUB_URL = "https://rsshub.app"
        mock_settings.return_value = mock_settings_obj

        url = "rsshub://path//to//route"
        result = transform_rsshub_url(url)

        assert result == "https://rsshub.app/path//to//route"

    @patch("app.utils.rsshub_url_transformer.get_settings")
    def test_rsshub_base_url_with_path(self, mock_settings: MagicMock):
        """RSSHUB_URL with path should be handled correctly."""
        mock_settings_obj = MagicMock()
        mock_settings_obj.RSSHUB_URL = "https://example.com/rsshub"
        mock_settings.return_value = mock_settings_obj

        url = "rsshub://android/security-bulletin"
        result = transform_rsshub_url(url)

        assert result == "https://example.com/rsshub/android/security-bulletin"

    @pytest.mark.parametrize(
        "input_url,base_url,expected",
        [
            ("rsshub://test", "https://rsshub.app", "https://rsshub.app/test"),
            ("rsshub://test", "https://rsshub.app/", "https://rsshub.app/test"),
            ("https://example.com", "https://rsshub.app", "https://example.com"),
            ("rsshub://a/b/c", "http://localhost:1200", "http://localhost:1200/a/b/c"),
            ("rsshub://", "https://rsshub.app", "https://rsshub.app/"),
        ],
    )
    def test_parametrized_transformations(self, input_url: str, base_url: str, expected: str):
        """Test various transformation scenarios."""
        with patch("app.utils.rsshub_url_transformer.get_settings") as mock_settings:
            mock_settings_obj = MagicMock()
            mock_settings_obj.RSSHUB_URL = base_url
            mock_settings.return_value = mock_settings_obj

            result = transform_rsshub_url(input_url)
            assert result == expected
