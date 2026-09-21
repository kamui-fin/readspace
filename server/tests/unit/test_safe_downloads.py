"""Exercise real aiohttp streams and URL guards without making network requests."""

import asyncio
import io
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import aiohttp
import pytest
from multidict import CIMultiDict, CIMultiDictProxy
from PIL import Image
from yarl import URL

from app.core.custom_exceptions import ValidationError
from app.services.feeds import favicon, fetching
from app.utils.security import SSRFSafeResolver, build_ssrf_trace_config


def response_for(url, chunks, content_type="text/html"):
    loop = asyncio.get_running_loop()
    response = aiohttp.ClientResponse(
        "GET",
        URL(url),
        writer=None,
        continue100=None,
        timer=None,
        request_info=None,
        traces=[],
        loop=loop,
        session=None,
    )
    response.status = 200
    response._headers = CIMultiDictProxy(CIMultiDict({"Content-Type": content_type}))
    protocol = MagicMock()
    protocol._reading_paused = False
    response.content = aiohttp.StreamReader(protocol, 65536, loop=loop)
    response.content.feed_data(chunks[0])
    for chunk in chunks[1:]:
        loop.call_soon(response.content.feed_data, chunk)
    loop.call_soon(response.content.feed_eof)
    return response


def session_for(response):
    session = MagicMock()
    session.get.return_value.__aenter__ = AsyncMock(return_value=response)
    session.get.return_value.__aexit__ = AsyncMock(return_value=False)
    return session


@pytest.mark.asyncio
@pytest.mark.parametrize("content_type", ["text/html", "text/html; charset=utf-8", "text/html; charset=bogus"])
async def test_page_reads_later_chunks_and_handles_missing_or_invalid_charset(content_type):
    chunks = [b"<html><head></head>", "<body>café</body></html>".encode()]
    response = response_for("https://example.com/", chunks, content_type)
    with (
        patch.object(fetching, "validate_url_security", new=AsyncMock()),
        patch.object(fetching, "_get_client_session", new=AsyncMock(return_value=session_for(response))),
    ):
        assert await fetching.fetch_page_html("https://example.com/") == b"".join(chunks).decode()
    assert response.content.at_eof()


@pytest.mark.asyncio
async def test_page_honors_declared_charset():
    response = response_for("https://example.com/", [b"caf\xe9"], "text/html; charset=iso-8859-1")
    with (
        patch.object(fetching, "validate_url_security", new=AsyncMock()),
        patch.object(fetching, "_get_client_session", new=AsyncMock(return_value=session_for(response))),
    ):
        assert await fetching.fetch_page_html("https://example.com/") == "café"


@pytest.mark.asyncio
@pytest.mark.parametrize(("chunks", "expected"), [([b"123", b"45"], b"12345"), ([b"123", b"456"], None)])
async def test_download_caps_accumulated_stream_without_content_length(chunks, expected):
    response = response_for("https://example.com/", chunks)
    with (
        patch.object(fetching, "validate_url_security", new=AsyncMock()),
        patch.object(fetching, "_get_client_session", new=AsyncMock(return_value=session_for(response))),
    ):
        result = await fetching.fetch_public_resource("https://example.com/", max_bytes=5)
    assert (result["body"] if result else None) == expected


@pytest.mark.asyncio
async def test_favicon_does_not_request_discovered_private_url():
    public_url = "https://example.com/"
    html = b'<link rel="icon" sizes="32x32" href="http://169.254.169.254/probe.png">'
    requested = []

    def get(url, **kwargs):
        requested.append(url)
        response = response_for(url, [html if url == public_url else b"not an image"])
        return session_for(response).get.return_value

    session = MagicMock()
    session.get.side_effect = get
    with (
        patch("asyncio.BaseEventLoop.getaddrinfo", return_value=[(2, 1, 6, "", ("8.8.8.8", 443))]),
        patch.object(fetching, "_get_client_session", new=AsyncMock(return_value=session)),
    ):
        result = await favicon.extract_favicon_and_canonical_url(public_url)
    assert result.image_url is None
    assert public_url in requested
    assert all("169.254.169.254" not in url for url in requested)


@pytest.mark.asyncio
async def test_favicon_resolves_relative_icon_against_redirected_page_and_uploads():
    png = io.BytesIO()
    Image.new("RGB", (32, 32), "red").save(png, format="PNG")
    resources = [
        {"body": b'<link rel="icon" href="icon.png">', "final_url": "https://example.com/blog/", "charset": None},
        {"body": png.getvalue(), "final_url": "https://cdn.example.com/icon.png", "charset": None},
    ]
    with (
        patch.object(favicon, "validate_url_security", new=AsyncMock()),
        patch.object(favicon, "fetch_public_resource", new=AsyncMock(side_effect=resources)) as fetch,
        patch.object(favicon, "_get_async_supabase", new=AsyncMock()),
        patch.object(favicon, "put_favicon_png", new=AsyncMock(return_value="stored.png")) as upload,
    ):
        result = await favicon.extract_favicon_and_canonical_url("https://example.com/")
    assert fetch.call_args_list[1].args[0] == "https://example.com/blog/icon.png"
    assert result.image_url == "stored.png"
    assert result.canonical_link == "https://example.com/blog/"
    assert upload.await_args.args[1].startswith(b"\x89PNG")


@pytest.mark.asyncio
async def test_redirect_hook_blocks_private_redirect():
    trace = build_ssrf_trace_config()
    params = SimpleNamespace(
        url=URL("https://example.com/icon.png"),
        response=SimpleNamespace(headers={"Location": "http://169.254.169.254/icon.png"}),
    )
    with pytest.raises(ValidationError):
        await trace.on_request_redirect[0](None, None, params)


@pytest.mark.asyncio
async def test_resolver_blocks_rebinding_to_private_address():
    resolver = SSRFSafeResolver()
    try:
        with patch.object(resolver._inner, "resolve", new=AsyncMock(return_value=[{"host": "127.0.0.1"}])):
            with pytest.raises(OSError, match="Blocked private address"):
                await resolver.resolve("example.com", 443)
    finally:
        await resolver.close()


@pytest.mark.asyncio
async def test_inline_favicon_is_normalized_without_network_download():
    import base64

    png = io.BytesIO()
    Image.new("RGB", (16, 16), "blue").save(png, format="PNG")
    data_url = "data:image/png;base64," + base64.b64encode(png.getvalue()).decode()
    page = {
        "body": f'<link rel="icon" href="{data_url}">'.encode(),
        "final_url": "https://example.com/",
        "charset": None,
    }
    with (
        patch.object(favicon, "validate_url_security", new=AsyncMock()),
        patch.object(favicon, "fetch_public_resource", new=AsyncMock(return_value=page)) as fetch,
        patch.object(favicon, "_get_async_supabase", new=AsyncMock()),
        patch.object(favicon, "put_favicon_png", new=AsyncMock(return_value="inline.png")),
    ):
        result = await favicon.extract_favicon_and_canonical_url("https://example.com/")
    assert result.image_url == "inline.png"
    assert fetch.await_count == 1
