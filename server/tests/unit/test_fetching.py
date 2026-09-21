from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.crud.feed.core import normalize_url
from app.services.feeds.fetching import MAX_FEED_SIZE_BYTES, fetch_feed_content
from app.utils.urls import normalize_feed_url, resolve_canonical_url


@pytest.mark.unit
@pytest.mark.asyncio
async def test_normalize_feed_url():
    # Test basic normalization
    assert normalize_feed_url("HTTP://EXAMPLE.COM/Feed") == "http://example.com/Feed"

    # Test RSSHub preservation
    assert normalize_feed_url("rsshub://twitter/user/test") == "rsshub://twitter/user/test"

    # Test url-normalize features (e.g. default port removal)
    assert normalize_feed_url("http://example.com:80/feed") == "http://example.com/feed"


@pytest.mark.unit
def test_normalize_url_matches_normalize_feed_url():
    """normalize_url (storage/dedup key) must canonicalize identically to
    normalize_feed_url, so the existence check and the stored value agree."""
    for raw in (
        "https://feed.infoq.com/?token=ABC",
        "https://feed.infoq.com?token=ABC",
        "http://Example.com:80/feed/",
        "https://example.com/path",
    ):
        assert normalize_url(raw) == normalize_feed_url(raw)


@pytest.mark.unit
def test_normalize_url_dedupes_root_slash_before_query():
    """Regression: `host/?token=x` and `host?token=x` are the same feed and must
    normalize to one key (previously created duplicate rows, dropping the icon)."""
    with_slash = normalize_url("https://feed.infoq.com/?token=ABC")
    without_slash = normalize_url("https://feed.infoq.com?token=ABC")
    assert with_slash == without_slash


@pytest.mark.unit
def test_normalize_url_passes_through_virtual_schemes():
    """newsletter:// and rsshub:// are not HTTP URLs; url_normalize would corrupt
    them, so normalize_url must leave them intact."""
    assert normalize_url("newsletter://abc-123/sender@example.com") == "newsletter://abc-123/sender@example.com"
    assert normalize_url("rsshub://twitter/user/foo") == "rsshub://twitter/user/foo"
    assert normalize_url("") == ""


@pytest.mark.unit
@pytest.mark.asyncio
async def test_resolve_canonical_url_head_success():
    with patch("aiohttp.ClientSession") as mock_session_cls:
        mock_session = MagicMock()
        mock_session_cls.return_value.__aenter__.return_value = mock_session

        # HEAD returns 200 OK
        mock_response = AsyncMock()
        mock_response.status = 200
        mock_response.url = "https://final.com/feed"
        mock_response.headers = {"content-type": "application/rss+xml"}

        # session.head returns context manager
        head_ctx = MagicMock()
        head_ctx.__aenter__ = AsyncMock(return_value=mock_response)
        head_ctx.__exit__ = AsyncMock(return_value=None)
        mock_session.head.return_value = head_ctx

        result = await resolve_canonical_url("http://initial.com")
        assert result == "https://final.com/feed"
        mock_session.head.assert_called_once()


@pytest.mark.unit
@pytest.mark.asyncio
async def test_resolve_canonical_url_head_failure():
    with patch("aiohttp.ClientSession") as mock_session_cls:
        mock_session = MagicMock()
        mock_session_cls.return_value.__aenter__.return_value = mock_session

        # HEAD returns 405 Method Not Allowed
        mock_response = AsyncMock()
        mock_response.status = 405

        head_ctx = MagicMock()
        head_ctx.__aenter__ = AsyncMock(return_value=mock_response)
        head_ctx.__exit__ = AsyncMock(return_value=None)
        mock_session.head.return_value = head_ctx

        # Should NOT fallback to GET, just return normalized original
        result = await resolve_canonical_url("http://initial.com")
        assert result == "http://initial.com/"
        mock_session.head.assert_called_once()


@pytest.mark.unit
@pytest.mark.asyncio
async def test_fetch_feed_content_cache_hit():
    with patch("app.core.redis_cache.get", new_callable=AsyncMock) as mock_get:
        mock_get.return_value = {"content": "cached", "status_code": 200}

        result = await fetch_feed_content("http://example.com/feed")
        assert result == {"content": "cached", "status_code": 200}
        mock_get.assert_called_once()


@pytest.mark.unit
@pytest.mark.asyncio
async def test_fetch_feed_content_size_limit():
    with patch("app.core.redis_cache.get", new_callable=AsyncMock) as mock_get:
        mock_get.return_value = None

        with patch("app.services.feeds.fetching._get_client_session", new_callable=AsyncMock) as mock_get_session:
            mock_session = MagicMock()
            mock_get_session.return_value = mock_session

            # Mock response with Content-Length too large
            mock_response = AsyncMock()
            mock_response.headers = {"Content-Length": str(MAX_FEED_SIZE_BYTES + 1)}
            mock_response.status = 200

            # session.get returns context manager whose __aenter__ must be async
            get_ctx = MagicMock()
            get_ctx.__aenter__ = AsyncMock(return_value=mock_response)
            get_ctx.__exit__ = AsyncMock(return_value=None)

            mock_session.get.return_value = get_ctx

            result = await fetch_feed_content("http://example.com/feed")
            assert result["status_code"] == 413
            assert "too large" in result["error"]


@pytest.mark.unit
@pytest.mark.asyncio
async def test_client_session_uses_verified_ssl():
    """Verify that _get_client_session initializes connector with a standard verified SSL context."""
    import ssl

    from app.services.feeds import fetching

    # Reset any existing session
    fetching._session = None
    fetching._session_loop = None

    session = await fetching._get_client_session()
    connector = session.connector
    assert connector is not None
    # Connector's SSL context should have verification enabled
    assert connector._ssl is not None
    assert connector._ssl.verify_mode == ssl.CERT_REQUIRED
    assert connector._ssl.check_hostname is True
    await session.close()


@pytest.mark.unit
@pytest.mark.asyncio
async def test_fetch_feed_content_ssl_error_fallback():
    """Verify that when an HTTPS request fails with ClientSSLError, it retries with ssl=False."""
    import ssl

    import aiohttp

    with patch("app.core.redis_cache.get", new_callable=AsyncMock) as mock_get:
        mock_get.return_value = None

        with patch("app.services.feeds.fetching._get_client_session", new_callable=AsyncMock) as mock_get_session:
            mock_session = MagicMock()
            mock_get_session.return_value = mock_session

            # First call raises ClientConnectorCertificateError, second call with ssl=False succeeds
            mock_success_response = AsyncMock()
            mock_success_response.status = 200
            mock_success_response.headers = {"Content-Type": "application/rss+xml"}
            mock_success_response.read = AsyncMock(return_value=b"<rss><channel><title>Test</title></channel></rss>")
            mock_success_response.get_encoding = MagicMock(return_value="utf-8")
            mock_success_response.history = ()
            mock_success_response.url = "https://legacy-blog.com/feed.xml"

            success_ctx = MagicMock()
            success_ctx.__aenter__ = AsyncMock(return_value=mock_success_response)
            success_ctx.__aexit__ = AsyncMock(return_value=None)

            cert_err = ssl.SSLCertVerificationError(1, "certificate verify failed")
            error_ctx = MagicMock()

            async def mock_error_enter(*args, **kwargs):
                raise aiohttp.ClientConnectorCertificateError(MagicMock(), cert_err)

            error_ctx.__aenter__ = mock_error_enter
            error_ctx.__aexit__ = AsyncMock(return_value=None)

            # mock_session.get side effect: first call error_ctx, second call success_ctx
            mock_session.get.side_effect = [error_ctx, success_ctx]

            with patch("app.core.redis_cache.set", new_callable=AsyncMock):
                result = await fetch_feed_content("https://legacy-blog.com/feed.xml")

            assert result["status_code"] == 200
            assert "<title>Test</title>" in result["content"]
            assert mock_session.get.call_count == 2
            # Second call should have ssl=False
            second_call_kwargs = mock_session.get.call_args_list[1][1]
            assert second_call_kwargs.get("ssl") is False


@pytest.mark.unit
@pytest.mark.asyncio
async def test_resolve_canonical_url_ssl_error_fallback():
    """Verify that resolve_canonical_url retries with ssl=False when ClientSSLError occurs."""
    import ssl

    import aiohttp

    with patch("aiohttp.ClientSession") as mock_session_cls:
        mock_session = MagicMock()
        mock_session_cls.return_value.__aenter__.return_value = mock_session

        mock_success_response = AsyncMock()
        mock_success_response.status = 200
        mock_success_response.url = "https://legacy-blog.com/canonical-feed"
        mock_success_response.headers = {"content-type": "application/rss+xml"}

        success_ctx = MagicMock()
        success_ctx.__aenter__ = AsyncMock(return_value=mock_success_response)
        success_ctx.__aexit__ = AsyncMock(return_value=None)

        cert_err = ssl.SSLCertVerificationError(1, "self signed certificate")
        error_ctx = MagicMock()

        async def mock_head_error_enter(*args, **kwargs):
            raise aiohttp.ClientConnectorCertificateError(MagicMock(), cert_err)

        error_ctx.__aenter__ = mock_head_error_enter
        error_ctx.__aexit__ = AsyncMock(return_value=None)

        mock_session.head.side_effect = [error_ctx, success_ctx]

        result = await resolve_canonical_url("https://legacy-blog.com/feed")
        assert result == "https://legacy-blog.com/canonical-feed"
        assert mock_session.head.call_count == 2
        # Second call should have ssl=False
        second_call_kwargs = mock_session.head.call_args_list[1][1]
        assert second_call_kwargs.get("ssl") is False
