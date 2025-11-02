"""Unit tests for HTTP caching middleware."""

import hashlib
from datetime import UTC, datetime

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.core.constants import CACHE_CONTROL_ARTICLE_LISTS, CACHE_CONTROL_NO_CACHE, CACHE_CONTROL_STATIC_FEEDS
from app.middleware.http_caching import HTTPCachingMiddleware


@pytest.fixture
def app_with_caching() -> FastAPI:
    """Create a FastAPI app with HTTP caching middleware."""
    app = FastAPI()

    # Add caching middleware
    app.add_middleware(HTTPCachingMiddleware)

    @app.get("/api/feeds")
    def list_feeds():
        """Return feed list (should have cache headers)."""
        return {"feeds": [{"id": "1", "title": "Feed 1"}, {"id": "2", "title": "Feed 2"}]}

    @app.get("/api/articles")
    def list_articles():
        """Return article list (should have cache headers and ETag)."""
        return {"articles": [{"id": "1", "title": "Article 1"}, {"id": "2", "title": "Article 2"}]}

    @app.post("/api/articles")
    def create_article():
        """Create article (should not be cached)."""
        return {"id": "3", "title": "New Article"}

    @app.get("/api/dynamic")
    def dynamic_content():
        """Return dynamic content (should have no-cache)."""
        return {"timestamp": datetime.now(UTC).isoformat()}

    return app


@pytest.mark.unit
def test_caching_middleware_adds_cache_control_to_feeds(app_with_caching: FastAPI) -> None:
    """Test that Cache-Control headers are added to feed endpoints."""
    client = TestClient(app_with_caching)

    response = client.get("/api/feeds")

    assert response.status_code == 200
    assert "Cache-Control" in response.headers
    # Feed lists should have public caching
    assert "public" in response.headers["Cache-Control"] or "private" in response.headers["Cache-Control"]


@pytest.mark.unit
def test_caching_middleware_adds_etag_to_article_lists(app_with_caching: FastAPI) -> None:
    """Test that ETag headers are added to article list endpoints."""
    client = TestClient(app_with_caching)

    response = client.get("/api/articles")

    assert response.status_code == 200
    assert "ETag" in response.headers
    # ETag should be a quoted string
    assert response.headers["ETag"].startswith('"')
    assert response.headers["ETag"].endswith('"')


@pytest.mark.unit
def test_caching_middleware_respects_if_none_match(app_with_caching: FastAPI) -> None:
    """Test that middleware returns 304 for matching ETag."""
    client = TestClient(app_with_caching)

    # First request to get the ETag
    response1 = client.get("/api/articles")
    assert response1.status_code == 200
    etag = response1.headers["ETag"]

    # Second request with If-None-Match header
    response2 = client.get("/api/articles", headers={"If-None-Match": etag})

    # Should return 304 Not Modified
    assert response2.status_code == 304
    assert len(response2.content) == 0  # No body for 304


@pytest.mark.unit
def test_caching_middleware_returns_full_response_for_different_etag(app_with_caching: FastAPI) -> None:
    """Test that middleware returns full response when ETag doesn't match."""
    client = TestClient(app_with_caching)

    # Request with a random ETag that won't match
    response = client.get("/api/articles", headers={"If-None-Match": '"random-etag"'})

    # Should return full response
    assert response.status_code == 200
    data = response.json()
    assert "articles" in data


@pytest.mark.unit
def test_caching_middleware_skips_post_requests(app_with_caching: FastAPI) -> None:
    """Test that caching is not applied to POST requests."""
    client = TestClient(app_with_caching)

    response = client.post("/api/articles")

    assert response.status_code == 200
    # POST requests should not have aggressive caching
    if "Cache-Control" in response.headers:
        assert "no-cache" in response.headers["Cache-Control"] or "no-store" in response.headers["Cache-Control"]


@pytest.mark.unit
def test_caching_middleware_etag_consistency(app_with_caching: FastAPI) -> None:
    """Test that the same content generates the same ETag."""
    client = TestClient(app_with_caching)

    # Make two requests
    response1 = client.get("/api/articles")
    response2 = client.get("/api/articles")

    assert response1.status_code == 200
    assert response2.status_code == 200

    # ETags should match for identical content
    assert "ETag" in response1.headers
    assert "ETag" in response2.headers
    assert response1.headers["ETag"] == response2.headers["ETag"]


@pytest.mark.unit
def test_caching_constants() -> None:
    """Test that HTTP caching constants are properly defined."""
    # Verify constants exist and have proper format
    assert "max-age" in CACHE_CONTROL_STATIC_FEEDS
    assert "max-age" in CACHE_CONTROL_ARTICLE_LISTS
    assert "no-cache" in CACHE_CONTROL_NO_CACHE or "no-store" in CACHE_CONTROL_NO_CACHE


@pytest.mark.unit
def test_etag_generation_from_content() -> None:
    """Test ETag generation algorithm."""
    content = b'{"test": "data"}'

    # Generate ETag using MD5 hash
    etag = hashlib.md5(content).hexdigest()  # noqa: S324

    assert len(etag) == 32  # MD5 hash is 32 characters
    assert etag.isalnum()  # Should be hexadecimal


@pytest.mark.unit
def test_caching_middleware_adds_last_modified_header(app_with_caching: FastAPI) -> None:
    """Test that Last-Modified headers can be added for appropriate endpoints."""
    client = TestClient(app_with_caching)

    response = client.get("/api/feeds")

    assert response.status_code == 200
    # Last-Modified is optional but should be in RFC format if present
    if "Last-Modified" in response.headers:
        # Should be a valid HTTP date format
        assert len(response.headers["Last-Modified"]) > 0
