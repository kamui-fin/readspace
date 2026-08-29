"""E2E tests for feed discovery preview route."""

from unittest.mock import patch

import pytest
from httpx import AsyncClient


class TestPreviewFeed:
    """Test feed preview endpoint."""

    @pytest.mark.asyncio
    async def test_preview_feed_success(self, async_client: AsyncClient):
        """Test previewing a real RSS feed."""
        # Mock the external feed fetching and parsing
        with (
            patch("app.services.feeds.fetching.fetch_feed_content") as mock_fetch,
            patch("app.services.feeds.parsing.parse_feed_content") as mock_parse,
        ):
            from datetime import datetime, timezone

            from app.typing.entries import ArticleCreate
            from app.typing.feeds import ParsedFeed

            mock_fetch.return_value = {"content": b"dummy content", "error": None}
            mock_parse.return_value = ParsedFeed(
                title="Hacker News: Newest",
                description="Hacker News RSS",
                link="https://news.ycombinator.com",
                articles=[
                    ArticleCreate(
                        title="Test Article",
                        link="http://example.com",
                        guid="test-guid",
                        published_at=datetime.now(timezone.utc),
                    )
                ],
            )

            response = await async_client.get("/api/discover/preview?url=https://hnrss.org/newest")

            assert response.status_code == 200
            data = response.json()

            # Verify response structure
            assert "title" in data
            assert "description" in data
            assert "articles" in data
            assert len(data["articles"]) > 0

    @pytest.mark.asyncio
    async def test_preview_feed_missing_url(self, async_client: AsyncClient):
        """Test previewing without URL parameter."""
        response = await async_client.get("/api/discover/preview")

        assert response.status_code == 422  # Validation error

    @pytest.mark.asyncio
    async def test_preview_feed_invalid_url(self, async_client: AsyncClient):
        """Test previewing with invalid URL."""
        response = await async_client.get("/api/discover/preview?url=not-a-valid-url")

        # Should fail with either 503 (can't fetch) or 500 (error)
        assert response.status_code in [500, 503]

    @pytest.mark.asyncio
    async def test_preview_feed_unreachable(self, async_client: AsyncClient):
        """Test previewing unreachable feed."""
        response = await async_client.get("/api/discover/preview?url=https://nonexistent-domain-12345.com/feed.xml")

        # Should fail with either 503 (can't fetch) or 500 (error)
        assert response.status_code in [500, 503]

    @pytest.mark.asyncio
    async def test_preview_feed_with_rsshub_url(self, async_client: AsyncClient):
        """Test previewing with rsshub:// URL transformation."""
        # Test that rsshub:// URLs are accepted (may fail to fetch, but shouldn't error on URL format)
        response = await async_client.get("/api/discover/preview?url=rsshub://test")

        # Should either succeed or fail gracefully (not 422 validation error)
        assert response.status_code in [200, 500, 503]
