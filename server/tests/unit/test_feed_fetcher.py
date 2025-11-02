"""Unit tests for FeedFetcher service."""

from unittest.mock import AsyncMock, Mock, patch

import httpx
import pytest

from app.core.redis_cache import RedisCache
from app.services.feed_fetcher import FeedFetcher, get_http_client, normalize_feed_url


@pytest.mark.unit
class TestFeedFetcher:
    """Test FeedFetcher functionality."""

    def setup_method(self):
        self.redis_cache = Mock(spec=RedisCache)
        self.redis_cache.get = AsyncMock()
        self.redis_cache.set = AsyncMock()
        self.redis_cache.delete = AsyncMock()
        self.fetcher = FeedFetcher(self.redis_cache)

    @pytest.mark.asyncio
    async def test_fetch_content_success(self):
        """Test successful feed fetching."""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.text = "<rss>test content</rss>"
        mock_response.headers = {"content-type": "application/rss+xml"}

        self.redis_cache.get.return_value = None  # No cached data

        # Mock the singleton client's get method
        client = get_http_client()
        with patch.object(client, "get", return_value=mock_response) as mock_get:
            result = await self.fetcher.fetch_content("http://example.com/feed.xml")

        assert result.status_code == 200
        assert result.content == "<rss>test content</rss>"
        assert "content-type" in result.headers
        assert not result.error

        # Verify caching was called
        self.redis_cache.set.assert_called_once()
        # Verify the HTTP client was used
        mock_get.assert_called_once()

    @pytest.mark.asyncio
    async def test_fetch_content_not_modified(self):
        """Test 304 Not Modified response."""
        mock_response = Mock()
        mock_response.status_code = 304
        mock_response.headers = {"etag": "test-etag"}

        cached_data = {
            "content": "<rss>cached content</rss>",
            "headers": {"etag": "test-etag"},
        }
        self.redis_cache.get.return_value = cached_data

        # Mock the singleton client's get method
        client = get_http_client()
        with patch.object(client, "get", return_value=mock_response) as mock_get:
            result = await self.fetcher.fetch_content("http://example.com/feed.xml", etag="test-etag")

        assert result.status_code == 304
        assert result.not_modified
        assert result.content == "<rss>cached content</rss>"
        mock_get.assert_called_once()

    @pytest.mark.asyncio
    async def test_fetch_content_timeout(self):
        """Test timeout handling."""
        self.redis_cache.get.return_value = None

        # Mock the singleton client's get method to raise timeout
        client = get_http_client()
        with patch.object(client, "get", side_effect=httpx.ConnectTimeout("Timeout")):
            result = await self.fetcher.fetch_content("http://example.com/feed.xml")

        assert result.error == "timeout"
        assert result.status_code == 408
        assert result.content == ""

    @pytest.mark.asyncio
    async def test_fetch_content_http_error(self):
        """Test HTTP error handling."""
        mock_response = Mock()
        mock_response.status_code = 404

        self.redis_cache.get.return_value = None

        # Mock the singleton client's get method to raise HTTP error
        client = get_http_client()
        with patch.object(
            client,
            "get",
            side_effect=httpx.HTTPStatusError("Not found", request=Mock(), response=mock_response),
        ):
            result = await self.fetcher.fetch_content("http://example.com/feed.xml")

        assert result.error == "http_404"
        assert result.status_code == 404
        assert result.content == ""

    @pytest.mark.asyncio
    async def test_build_request_headers(self):
        """Test request header building."""
        headers = self.fetcher._build_request_headers("test-etag", "test-modified", None)

        assert headers["User-Agent"] == "Mozilla/5.0 (compatible; Readspace/1.0; +https://readspace.app/bot)"
        assert headers["If-None-Match"] == "test-etag"
        assert headers["If-Modified-Since"] == "test-modified"

    @pytest.mark.asyncio
    async def test_build_request_headers_with_cache(self):
        """Test request header building with cached data."""
        cached_data = {"headers": {"ETag": "cached-etag", "Last-Modified": "cached-modified"}}

        headers = self.fetcher._build_request_headers(None, None, cached_data)

        assert headers["If-None-Match"] == "cached-etag"
        assert headers["If-Modified-Since"] == "cached-modified"

    @pytest.mark.asyncio
    async def test_fetch_content_uses_singleton_client(self):
        """Test that fetch_content uses the singleton HTTP client."""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.text = "<rss>test content</rss>"
        mock_response.headers = {"content-type": "application/rss+xml"}

        self.redis_cache.get.return_value = None

        # Get the singleton client to verify it's being used
        client = get_http_client()

        with patch.object(client, "get", return_value=mock_response) as mock_get:
            result = await self.fetcher.fetch_content("http://example.com/feed.xml")

        assert result.status_code == 200
        mock_get.assert_called_once()

    @pytest.mark.asyncio
    async def test_cache_key_normalization_http_to_https(self):
        """Test that HTTP and HTTPS URLs share the same cache after normalization."""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.text = "<rss>test content</rss>"
        mock_response.headers = {"content-type": "application/rss+xml"}

        self.redis_cache.get.return_value = None

        # Mock the singleton client's get method
        client = get_http_client()
        with patch.object(client, "get", return_value=mock_response):
            # Fetch with http://
            await self.fetcher.fetch_content("http://example.com/feed.xml")

        # Verify cache key uses normalized (https://) URL
        cache_key = self.redis_cache.set.call_args[0][0]
        assert cache_key == "feed_content:https://example.com/feed.xml"

    @pytest.mark.asyncio
    async def test_cache_key_normalization_trailing_slash(self):
        """Test that URLs with/without trailing slashes share the same cache."""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.text = "<rss>test content</rss>"
        mock_response.headers = {"content-type": "application/rss+xml"}

        self.redis_cache.get.return_value = None

        # Mock the singleton client's get method
        client = get_http_client()
        with patch.object(client, "get", return_value=mock_response):
            # Fetch with trailing slash
            await self.fetcher.fetch_content("https://example.com/feed.xml/")

        # Verify cache key uses normalized URL without trailing slash
        cache_key = self.redis_cache.set.call_args[0][0]
        assert cache_key == "feed_content:https://example.com/feed.xml"


@pytest.mark.unit
class TestNormalizeFeedUrl:
    """Test URL normalization functionality."""

    def test_normalize_http_to_https(self):
        """Test that HTTP URLs are converted to HTTPS."""
        url = "http://example.com/feed.xml"
        normalized = normalize_feed_url(url)
        assert normalized == "https://example.com/feed.xml"

    def test_normalize_https_unchanged(self):
        """Test that HTTPS URLs remain unchanged."""
        url = "https://example.com/feed.xml"
        normalized = normalize_feed_url(url)
        assert normalized == "https://example.com/feed.xml"

    def test_normalize_removes_trailing_slash(self):
        """Test that trailing slashes are removed."""
        url = "https://example.com/feed.xml/"
        normalized = normalize_feed_url(url)
        assert normalized == "https://example.com/feed.xml"

    def test_normalize_removes_fragment(self):
        """Test that URL fragments are removed."""
        url = "https://example.com/feed.xml#section"
        normalized = normalize_feed_url(url)
        assert normalized == "https://example.com/feed.xml"

    def test_normalize_preserves_query_params(self):
        """Test that query parameters are preserved."""
        url = "https://example.com/feed.xml?format=rss&limit=10"
        normalized = normalize_feed_url(url)
        assert normalized == "https://example.com/feed.xml?format=rss&limit=10"

    def test_normalize_lowercases_domain(self):
        """Test that domain is lowercased."""
        url = "https://EXAMPLE.COM/Feed.xml"
        normalized = normalize_feed_url(url)
        assert normalized == "https://example.com/Feed.xml"

    def test_normalize_preserves_path_case(self):
        """Test that path case is preserved."""
        url = "https://example.com/Feed/RSS.xml"
        normalized = normalize_feed_url(url)
        assert normalized == "https://example.com/Feed/RSS.xml"

    def test_normalize_rsshub_url(self):
        """Test that rsshub:// URLs are not normalized."""
        url = "rsshub://android/security-bulletin"
        normalized = normalize_feed_url(url)
        assert normalized == "rsshub://android/security-bulletin"

    def test_normalize_complex_url(self):
        """Test normalization of a complex URL with multiple issues."""
        url = "http://EXAMPLE.com/Feed/RSS.xml?format=rss#comments/"
        normalized = normalize_feed_url(url)
        assert normalized == "https://example.com/Feed/RSS.xml?format=rss"


@pytest.mark.unit
class TestHttpClientSingleton:
    """Test HTTP client singleton behavior."""

    def test_get_http_client_returns_same_instance(self):
        """Test that get_http_client returns the same instance."""
        client1 = get_http_client()
        client2 = get_http_client()
        assert client1 is client2

    def test_http_client_has_connection_pooling(self):
        """Test that HTTP client has proper connection pooling configured."""
        # Reset the singleton to ensure we get a fresh client in tests
        import app.services.feed_fetcher as feed_fetcher_module

        original_client = feed_fetcher_module._http_client
        feed_fetcher_module._http_client = None

        try:
            client = get_http_client()
            assert isinstance(client, httpx.AsyncClient)
            # Access connection pool limits through the transport
            assert client._transport._pool._max_connections == 100
            assert client._transport._pool._max_keepalive_connections == 20
        finally:
            # Restore the original client
            feed_fetcher_module._http_client = original_client

    def test_http_client_follows_redirects(self):
        """Test that HTTP client is configured to follow redirects."""
        # Reset the singleton to ensure we get a fresh client in tests
        import app.services.feed_fetcher as feed_fetcher_module

        original_client = feed_fetcher_module._http_client
        feed_fetcher_module._http_client = None

        try:
            client = get_http_client()
            assert client.follow_redirects is True
        finally:
            # Restore the original client
            feed_fetcher_module._http_client = original_client
