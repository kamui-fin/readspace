import pytest
from unittest.mock import AsyncMock, MagicMock, patch
import httpx
from app.utils.urls import resolve_canonical_url, normalize_feed_url
from app.services.feeds.fetching import fetch_feed_content, MAX_FEED_SIZE_BYTES
from app.core import redis_cache


@pytest.mark.asyncio
async def test_normalize_feed_url():
    # Test basic normalization
    assert normalize_feed_url("HTTP://EXAMPLE.COM/Feed") == "http://example.com/Feed"

    # Test RSSHub preservation
    assert (
        normalize_feed_url("rsshub://twitter/user/test") == "rsshub://twitter/user/test"
    )

    # Test url-normalize features (e.g. default port removal)
    assert normalize_feed_url("http://example.com:80/feed") == "http://example.com/feed"


@pytest.mark.asyncio
async def test_resolve_canonical_url_head_success():
    with patch("httpx.AsyncClient") as mock_client_cls:
        mock_client = AsyncMock()
        mock_client_cls.return_value.__aenter__.return_value = mock_client

        # HEAD returns 200 OK
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.url = httpx.URL("https://final.com/feed")
        mock_response.headers = {"content-type": "application/rss+xml"}
        mock_client.head.return_value = mock_response

        result = await resolve_canonical_url("http://initial.com")
        assert result == "https://final.com/feed"
        mock_client.head.assert_called_once()
        mock_client.get.assert_not_called()


@pytest.mark.asyncio
async def test_resolve_canonical_url_head_failure():
    with patch("httpx.AsyncClient") as mock_client_cls:
        mock_client = AsyncMock()
        mock_client_cls.return_value.__aenter__.return_value = mock_client

        # HEAD returns 405 Method Not Allowed
        mock_head_response = MagicMock()
        mock_head_response.status_code = 405
        mock_client.head.return_value = mock_head_response

        # Should NOT fallback to GET, just return normalized original
        result = await resolve_canonical_url("http://initial.com")
        assert result == "http://initial.com/"
        mock_client.head.assert_called_once()
        mock_client.get.assert_not_called()


@pytest.mark.asyncio
async def test_fetch_feed_content_cache_hit():
    with patch("app.core.redis_cache.get", new_callable=AsyncMock) as mock_get:
        mock_get.return_value = {"content": "cached", "status_code": 200}

        result = await fetch_feed_content("http://example.com/feed")
        assert result == {"content": "cached", "status_code": 200}
        mock_get.assert_called_once()


@pytest.mark.asyncio
async def test_fetch_feed_content_size_limit():
    with patch("app.core.redis_cache.get", new_callable=AsyncMock) as mock_get:
        mock_get.return_value = None

        with patch("app.services.feeds.fetching._get_client") as mock_get_client:
            mock_client = MagicMock()  # Use MagicMock for stream() which is not async
            mock_get_client.return_value = mock_client

            # Mock stream response with Content-Length too large
            mock_response = AsyncMock()
            mock_response.headers = {"content-length": str(MAX_FEED_SIZE_BYTES + 1)}
            mock_response.status_code = 200

            # Fix aiter_bytes mocking
            async def async_iter():
                yield b"chunk"

            mock_response.aiter_bytes.return_value = async_iter()

            mock_client.stream.return_value.__aenter__.return_value = mock_response

            result = await fetch_feed_content("http://example.com/feed")
            assert result["status_code"] == 413
            assert result["error"] == "Feed too large"
