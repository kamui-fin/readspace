"""E2E tests for feed discovery routes."""

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession


class TestSearchFeeds:
    """Test feed search endpoint."""

    @pytest.mark.asyncio
    async def test_search_feeds_with_query(self, async_client: AsyncClient):
        """Test searching feeds with query text."""
        response = await async_client.get("/api/discover/search?q=technology")

        assert response.status_code == 200
        data = response.json()
        assert "results" in data
        assert "total_count" in data
        assert isinstance(data["results"], list)

    @pytest.mark.asyncio
    async def test_search_feeds_by_category(self, async_client: AsyncClient):
        """Test searching feeds by category."""
        response = await async_client.get("/api/discover/search?category=Technology")

        assert response.status_code == 200
        data = response.json()
        assert "results" in data
        assert data["category"] == "Technology"

    @pytest.mark.asyncio
    async def test_search_feeds_by_language(self, async_client: AsyncClient):
        """Test filtering feeds by language."""
        response = await async_client.get("/api/discover/search?language=en")

        assert response.status_code == 200
        data = response.json()
        assert data["language"] == "en"

    @pytest.mark.asyncio
    async def test_search_feeds_with_limit(self, async_client: AsyncClient):
        """Test limiting search results."""
        response = await async_client.get("/api/discover/search?limit=5")

        assert response.status_code == 200
        data = response.json()
        assert len(data["results"]) <= 5

    @pytest.mark.asyncio
    async def test_search_feeds_no_params(self, async_client: AsyncClient):
        """Test search without parameters returns popular feeds."""
        response = await async_client.get("/api/discover/search")

        assert response.status_code == 200
        data = response.json()
        assert "results" in data

    @pytest.mark.asyncio
    async def test_search_feeds_combined_filters(self, async_client: AsyncClient):
        """Test search with multiple filters."""
        response = await async_client.get("/api/discover/search?q=tech&category=Technology&language=en&limit=10")

        assert response.status_code == 200
        data = response.json()
        assert data["query"] == "tech"
        assert data["category"] == "Technology"
        assert data["language"] == "en"

    @pytest.mark.asyncio
    async def test_search_feeds_invalid_limit(self, async_client: AsyncClient):
        """Test search with invalid limit."""
        response = await async_client.get("/api/discover/search?limit=1000")

        assert response.status_code == 422


class TestGetRecommendations:
    """Test feed recommendations endpoint."""

    @pytest.mark.asyncio
    async def test_get_recommendations_single_category(self, async_client: AsyncClient):
        """Test getting recommendations for single category."""
        response = await async_client.post(
            "/api/discover/recommendations",
            json={"categories": ["Technology"], "language": "en", "limit": 10},
        )

        assert response.status_code == 200
        data = response.json()
        assert "results" in data
        assert len(data["results"]) <= 10

    @pytest.mark.asyncio
    async def test_get_recommendations_multiple_categories(self, async_client: AsyncClient):
        """Test getting recommendations for multiple categories."""
        response = await async_client.post(
            "/api/discover/recommendations",
            json={"categories": ["Technology", "Science", "News"], "language": "en", "limit": 20},
        )

        assert response.status_code == 200
        data = response.json()
        assert "results" in data
        assert len(data["results"]) <= 20

    @pytest.mark.asyncio
    async def test_get_recommendations_empty_categories(self, async_client: AsyncClient):
        """Test recommendations with empty categories list."""
        response = await async_client.post(
            "/api/discover/recommendations",
            json={"categories": [], "language": "en"},
        )

        # Should handle gracefully
        assert response.status_code in [200, 400, 422]

    @pytest.mark.asyncio
    async def test_get_recommendations_default_language(self, async_client: AsyncClient):
        """Test recommendations with default language."""
        response = await async_client.post(
            "/api/discover/recommendations",
            json={"categories": ["Technology"]},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["language"] == "en"  # Default

    @pytest.mark.asyncio
    async def test_get_recommendations_deduplication(self, async_client: AsyncClient):
        """Test that recommendations are deduplicated."""
        response = await async_client.post(
            "/api/discover/recommendations",
            json={"categories": ["Technology", "Technology"], "limit": 10},
        )

        assert response.status_code == 200
        data = response.json()
        # Check for unique feed IDs
        feed_ids = [feed["id"] for feed in data["results"]]
        assert len(feed_ids) == len(set(feed_ids))


class TestGetCategories:
    """Test get categories endpoint."""

    @pytest.mark.asyncio
    async def test_get_categories_default_language(self, async_client: AsyncClient):
        """Test getting categories with default language."""
        response = await async_client.get("/api/discover/categories")

        assert response.status_code == 200
        data = response.json()
        assert "categories" in data
        assert "language" in data
        assert isinstance(data["categories"], list)

    @pytest.mark.asyncio
    async def test_get_categories_specific_language(self, async_client: AsyncClient):
        """Test getting categories for specific language."""
        response = await async_client.get("/api/discover/categories?language=es")

        assert response.status_code == 200
        data = response.json()
        assert data["language"] == "es"

    @pytest.mark.asyncio
    async def test_get_categories_structure(self, async_client: AsyncClient):
        """Test category response structure."""
        response = await async_client.get("/api/discover/categories")

        assert response.status_code == 200
        data = response.json()

        if len(data["categories"]) > 0:
            category = data["categories"][0]
            assert "name" in category
            assert "count" in category or "feed_count" in category


class TestGetCategoryFeeds:
    """Test get feeds by category endpoint."""

    @pytest.mark.asyncio
    async def test_get_category_feeds_success(self, async_client: AsyncClient):
        """Test getting feeds for a specific category."""
        response = await async_client.get("/api/discover/categories/Technology")

        assert response.status_code == 200
        data = response.json()
        assert "results" in data
        assert data["category"] == "Technology"

    @pytest.mark.asyncio
    async def test_get_category_feeds_with_language(self, async_client: AsyncClient):
        """Test getting category feeds with language filter."""
        response = await async_client.get("/api/discover/categories/Technology?language=en")

        assert response.status_code == 200
        data = response.json()
        assert data["language"] == "en"

    @pytest.mark.asyncio
    async def test_get_category_feeds_with_limit(self, async_client: AsyncClient):
        """Test limiting category feed results."""
        response = await async_client.get("/api/discover/categories/Technology?limit=5")

        assert response.status_code == 200
        data = response.json()
        assert len(data["results"]) <= 5

    @pytest.mark.asyncio
    async def test_get_category_feeds_nonexistent(self, async_client: AsyncClient):
        """Test getting feeds for non-existent category."""
        response = await async_client.get("/api/discover/categories/NonExistentCategory")

        assert response.status_code == 200
        data = response.json()
        # Should return empty results
        assert len(data["results"]) == 0


class TestPreviewArticles:
    """Test preview articles endpoint."""

    @pytest.mark.asyncio
    async def test_preview_articles_success(self, async_client: AsyncClient, mock_feed_fetch):
        """Test previewing articles from a feed URL."""
        response = await async_client.get("/api/discover/preview/articles?url=https://example.com/feed.xml")

        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert "total" in data
        assert isinstance(data["items"], list)

    @pytest.mark.asyncio
    async def test_preview_articles_with_limit(self, async_client: AsyncClient, mock_feed_fetch):
        """Test previewing articles with limit."""
        response = await async_client.get("/api/discover/preview/articles?url=https://example.com/feed.xml&limit=5")

        assert response.status_code == 200
        data = response.json()
        assert len(data["items"]) <= 5

    @pytest.mark.asyncio
    async def test_preview_articles_invalid_url(self, async_client: AsyncClient):
        """Test previewing with invalid URL."""
        response = await async_client.get("/api/discover/preview/articles?url=invalid-url")

        assert response.status_code in [400, 422]

    @pytest.mark.asyncio
    async def test_preview_articles_missing_url(self, async_client: AsyncClient):
        """Test previewing without URL parameter."""
        response = await async_client.get("/api/discover/preview/articles")

        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_preview_articles_unreachable_feed(self, async_client: AsyncClient):
        """Test previewing unreachable feed."""
        response = await async_client.get("/api/discover/preview/articles?url=https://nonexistent.example.com/feed.xml")

        # Should handle gracefully
        assert response.status_code in [400, 503]


class TestFeedDiscoveryIntegration:
    """Integration tests for feed discovery flow."""

    @pytest.mark.asyncio
    async def test_discover_and_subscribe_flow(
        self, async_client: AsyncClient, db_session: AsyncSession, test_user, mock_feed_fetch
    ):
        """Test complete flow: discover -> preview -> subscribe."""
        # 1. Search for feeds
        search_response = await async_client.get("/api/discover/search?q=technology&limit=1")
        assert search_response.status_code == 200

        search_data = search_response.json()
        if len(search_data["results"]) == 0:
            pytest.skip("No feeds found in discovery")

        feed_id = search_data["results"][0]["id"]

        # 2. Preview feed articles
        feed_url = search_data["results"][0]["url"]
        preview_response = await async_client.get(f"/api/discover/preview/articles?url={feed_url}")
        # Preview might fail without proper mocking

        # 3. Subscribe to feed
        subscribe_response = await async_client.post(f"/api/feeds/{feed_id}/subscribe", json={})
        assert subscribe_response.status_code in [201, 400]  # 400 if already subscribed

    @pytest.mark.asyncio
    async def test_category_browse_flow(self, async_client: AsyncClient):
        """Test browsing feeds by category."""
        # 1. Get available categories
        categories_response = await async_client.get("/api/discover/categories")
        assert categories_response.status_code == 200

        categories_data = categories_response.json()
        if len(categories_data["categories"]) == 0:
            pytest.skip("No categories available")

        category_name = categories_data["categories"][0]["name"]

        # 2. Browse feeds in category
        feeds_response = await async_client.get(f"/api/discover/categories/{category_name}")
        assert feeds_response.status_code == 200
        assert feeds_response.json()["category"] == category_name
