"""Unit tests for response compression middleware."""

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.core.constants import COMPRESSION_CONTENT_TYPES, COMPRESSION_MIN_SIZE
from app.middleware.compression import CompressionMiddleware


@pytest.fixture
def app_with_compression() -> FastAPI:
    """Create a FastAPI app with compression middleware."""
    app = FastAPI()

    # Add compression middleware
    app.add_middleware(CompressionMiddleware)

    @app.get("/small")
    def small_response():
        """Return a small response that shouldn't be compressed."""
        return {"message": "ok"}

    @app.get("/large")
    def large_response():
        """Return a large response that should be compressed."""
        return {"data": "x" * 2000, "items": [{"id": i, "value": f"item_{i}"} for i in range(100)]}

    @app.get("/text")
    def text_response():
        """Return a plain text response."""
        return "This is a long text response that should be compressed when large enough. " * 50

    @app.get("/image")
    def image_response():
        """Return a non-compressible content type."""
        from fastapi.responses import Response

        return Response(content=b"fake image data", media_type="image/png")

    return app


@pytest.mark.unit
def test_compression_middleware_compresses_large_json(app_with_compression: FastAPI) -> None:
    """Test that large JSON responses are compressed with brotli."""
    client = TestClient(app_with_compression)

    # Request with accept-encoding header
    response = client.get("/large", headers={"Accept-Encoding": "br, gzip, deflate"})

    assert response.status_code == 200
    # Check that response is compressed
    assert "Content-Encoding" in response.headers
    assert response.headers["Content-Encoding"] == "br"
    # Verify content is valid JSON
    data = response.json()
    assert "data" in data
    assert len(data["items"]) == 100


@pytest.mark.unit
def test_compression_middleware_skips_small_responses(app_with_compression: FastAPI) -> None:
    """Test that small responses are not compressed."""
    client = TestClient(app_with_compression)

    response = client.get("/small", headers={"Accept-Encoding": "br"})

    assert response.status_code == 200
    # Small responses should not be compressed
    assert "Content-Encoding" not in response.headers or response.headers.get("Content-Encoding") != "br"
    data = response.json()
    assert data["message"] == "ok"


@pytest.mark.unit
def test_compression_middleware_respects_accept_encoding(app_with_compression: FastAPI) -> None:
    """Test that compression is only applied when client supports it."""
    client = TestClient(app_with_compression)

    # Request explicitly without brotli encoding (gzip only)
    response = client.get("/large", headers={"Accept-Encoding": "gzip"})

    assert response.status_code == 200
    # Should not use brotli if client doesn't support it
    if "Content-Encoding" in response.headers:
        # Should not be brotli-compressed if client doesn't support it
        assert response.headers.get("Content-Encoding") != "br"


@pytest.mark.unit
def test_compression_middleware_skips_non_compressible_types(app_with_compression: FastAPI) -> None:
    """Test that non-compressible content types are not compressed."""
    client = TestClient(app_with_compression)

    response = client.get("/image", headers={"Accept-Encoding": "br"})

    assert response.status_code == 200
    # Image responses should not be compressed
    assert response.headers.get("Content-Type") == "image/png"
    # Brotli should not be applied to images
    assert "Content-Encoding" not in response.headers or response.headers.get("Content-Encoding") != "br"


@pytest.mark.unit
def test_compression_constants() -> None:
    """Test that compression constants are properly defined."""
    # Verify constants exist and have sensible values
    assert COMPRESSION_MIN_SIZE > 0
    assert COMPRESSION_MIN_SIZE <= 1024  # Should be reasonable threshold
    assert isinstance(COMPRESSION_CONTENT_TYPES, set)
    assert "application/json" in COMPRESSION_CONTENT_TYPES
    assert "text/html" in COMPRESSION_CONTENT_TYPES


@pytest.mark.unit
def test_compression_middleware_preserves_headers(app_with_compression: FastAPI) -> None:
    """Test that compression middleware preserves other response headers."""
    client = TestClient(app_with_compression)

    response = client.get("/large", headers={"Accept-Encoding": "br"})

    assert response.status_code == 200
    # Check that standard headers are preserved
    assert "Content-Type" in response.headers
    assert "application/json" in response.headers["Content-Type"]
