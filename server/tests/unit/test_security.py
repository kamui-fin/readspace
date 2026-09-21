"""Pure-logic tests for SSRF protection (no DB, no real network)."""

from unittest.mock import patch

import pytest

from app.core.custom_exceptions import ValidationError
from app.utils.security import is_blocked_ip, validate_url_security


@pytest.mark.unit
@pytest.mark.parametrize(
    "ip",
    [
        "127.0.0.1",
        "10.0.0.5",
        "172.16.3.4",
        "192.168.1.1",
        "169.254.169.254",
        "100.64.0.1",
        "::1",
        "::ffff:127.0.0.1",
        "0.0.0.0",  # noqa: S104
        "fe80::1",
    ],
)
def test_blocked_ips(ip: str) -> None:
    assert is_blocked_ip(ip)


@pytest.mark.unit
@pytest.mark.parametrize("ip", ["8.8.8.8", "1.1.1.1", "2606:4700:4700::1111"])
def test_public_ips_allowed(ip: str) -> None:
    assert not is_blocked_ip(ip)


@pytest.mark.unit
@pytest.mark.parametrize(
    "url",
    [
        "http://localhost/feed",
        "http://127.0.0.1:6379",
        "http://169.254.169.254/latest/meta-data/",
        "http://[::1]/",
        "ftp://example.com/feed",
        "file:///etc/passwd",
    ],
)
@pytest.mark.asyncio
async def test_rejects_internal_urls(url: str) -> None:
    with pytest.raises(ValidationError):
        await validate_url_security(url)


@pytest.mark.unit
@pytest.mark.asyncio
async def test_rejects_hostname_resolving_to_private_ip() -> None:
    fake = [(2, 1, 6, "", ("10.0.0.7", 80))]
    with patch("asyncio.BaseEventLoop.getaddrinfo", return_value=fake), pytest.raises(ValidationError):
        await validate_url_security("http://redis.internal.example.com/")


@pytest.mark.unit
@pytest.mark.asyncio
async def test_rsshub_scheme_only_when_allowed() -> None:
    await validate_url_security("rsshub://twitter/user/x")
    with pytest.raises(ValidationError):
        await validate_url_security("rsshub://twitter/user/x", allow_rsshub=False)


@pytest.mark.unit
@pytest.mark.asyncio
async def test_opml_chunked_streaming_rejects_oversized_payload() -> None:
    from io import BytesIO
    from fastapi import HTTPException, UploadFile
    from app.routers.opml.import_opml import validate_and_read_opml

    # Simulating a file upload without Content-Length (file.size = None)
    # where chunks stream past 50MB
    class MockOversizedFile:
        def __init__(self):
            self.filename = "large.opml"
            self.size = None
            self.read_count = 0

        async def read(self, size: int = -1) -> bytes:
            self.read_count += 1
            if self.read_count <= 51:
                return b"A" * (1024 * 1024)  # 1MB per chunk, total > 50MB
            return b""

        async def close(self) -> None:
            pass

    mock_file = MockOversizedFile()
    with pytest.raises(HTTPException) as exc_info:
        await validate_and_read_opml(mock_file)  # type: ignore

    assert exc_info.value.status_code == 413
    assert "too large" in exc_info.value.detail.lower()


@pytest.mark.unit
@pytest.mark.asyncio
async def test_opml_chunked_streaming_reads_valid_payload() -> None:
    from io import BytesIO
    from fastapi import UploadFile
    from app.routers.opml.import_opml import validate_and_read_opml

    content = b"<opml>test content</opml>"
    stream = BytesIO(content)
    upload_file = UploadFile(file=stream, filename="feeds.opml", size=None)

    result = await validate_and_read_opml(upload_file)
    assert result == "<opml>test content</opml>"

