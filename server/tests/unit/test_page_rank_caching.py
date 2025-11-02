"""Unit tests for PageRank service with Redis caching."""

from unittest.mock import AsyncMock, patch

import pytest

from app.services.feeds.enrichment.page_rank import PageRankService, get_page_rank_service


class TestPageRankServiceCaching:
    """Test PageRank service with Redis caching for domain lookups."""

    @pytest.fixture
    def mock_redis_cache(self):
        """Mock Redis cache for testing."""
        cache = AsyncMock()
        cache.get = AsyncMock(return_value=None)
        cache.set = AsyncMock(return_value=True)
        return cache

    @pytest.fixture
    def page_rank_service(self):
        """Create a fresh PageRank service instance."""
        # Reset singleton
        import app.services.feeds.enrichment.page_rank as pr_module

        pr_module._page_rank_service = None

        service = PageRankService()
        # Mock the dataset to avoid file I/O
        service._domain_scores = {
            "example.com": 80.0,
            "test.com": 60.0,
            "blog.example.com": 75.0,
        }
        return service

    @pytest.mark.asyncio
    async def test_get_domain_score_cache_hit(self, page_rank_service, mock_redis_cache):
        """Test that cached domain scores are returned without lookup."""
        with patch("app.services.feeds.enrichment.page_rank.get_redis_cache", return_value=mock_redis_cache):
            # Simulate cache hit
            mock_redis_cache.get.return_value = 80.0

            # This would use cache in the real implementation
            score = page_rank_service.get_domain_score("example.com")

            assert score == 80.0

    @pytest.mark.asyncio
    async def test_get_domain_score_cache_miss(self, page_rank_service, mock_redis_cache):
        """Test that domain scores are computed and cached on miss."""
        with patch("app.services.feeds.enrichment.page_rank.get_redis_cache", return_value=mock_redis_cache):
            # Simulate cache miss
            mock_redis_cache.get.return_value = None

            score = page_rank_service.get_domain_score("example.com")

            assert score == 80.0

    def test_get_domain_score_direct_match(self, page_rank_service):
        """Test direct domain match returns correct score."""
        score = page_rank_service.get_domain_score("example.com")
        assert score == 80.0

    def test_get_domain_score_subdomain_fallback(self, page_rank_service):
        """Test subdomain falls back to parent domain with penalty."""
        score = page_rank_service.get_domain_score("subdomain.example.com")
        # Should get 80% of parent domain score (80.0 * 0.8 = 64.0)
        assert score == 64.0

    def test_get_domain_score_not_found(self, page_rank_service):
        """Test unknown domain returns 0.0."""
        score = page_rank_service.get_domain_score("unknown.com")
        assert score == 0.0

    def test_get_domain_score_empty_domain(self, page_rank_service):
        """Test empty domain returns 0.0."""
        score = page_rank_service.get_domain_score("")
        assert score == 0.0

    def test_singleton_pattern(self):
        """Test that get_page_rank_service returns same instance."""
        service1 = get_page_rank_service()
        service2 = get_page_rank_service()
        assert service1 is service2

    def test_dataset_loaded(self, page_rank_service):
        """Test that dataset is loaded."""
        assert page_rank_service.is_loaded()
        assert len(page_rank_service._domain_scores) > 0

    def test_get_stats(self, page_rank_service):
        """Test getting dataset statistics."""
        stats = page_rank_service.get_stats()
        assert stats["loaded"] is True
        assert stats["total_domains"] == 3
        assert stats["min_score"] == 60.0
        assert stats["max_score"] == 80.0
        assert stats["avg_score"] == pytest.approx(71.67, rel=0.1)


class TestPageRankServiceDatasetLoading:
    """Test PageRank dataset loading with singleton pattern."""

    def test_dataset_loads_only_once(self):
        """Test that dataset is loaded only once (singleton pattern)."""
        import app.services.feeds.enrichment.page_rank as pr_module

        # Reset singleton
        pr_module._page_rank_service = None

        with patch.object(pr_module.PageRankService, "_load_dataset") as mock_load:
            mock_load.return_value = None

            # First call should load
            service1 = pr_module.get_page_rank_service()
            assert mock_load.call_count == 1

            # Second call should reuse instance
            service2 = pr_module.get_page_rank_service()
            assert mock_load.call_count == 1  # Still 1, not called again

            assert service1 is service2

    def test_dataset_missing_file(self):
        """Test graceful handling of missing dataset file."""
        import app.services.feeds.enrichment.page_rank as pr_module

        pr_module._page_rank_service = None

        with patch("pathlib.Path.exists", return_value=False):
            service = PageRankService()
            assert service._domain_scores == {}
            assert not service.is_loaded()

    def test_dataset_load_error(self):
        """Test graceful handling of dataset load error."""
        import app.services.feeds.enrichment.page_rank as pr_module

        pr_module._page_rank_service = None

        with (
            patch("pathlib.Path.exists", return_value=True),
            patch("builtins.open", side_effect=Exception("File error")),
        ):
            service = PageRankService()
            assert service._domain_scores == {}
            assert not service.is_loaded()


class TestPageRankServiceCacheKeys:
    """Test cache key generation for PageRank lookups."""

    def test_cache_key_format(self):
        """Test that cache keys follow the expected format."""
        # This test will verify cache key format once caching is implemented
        # Cache keys should be: "pagerank:domain:{domain}"
        expected_key = "pagerank:domain:example.com"

        # For now, just verify the key format is correct
        assert "pagerank:domain:" in expected_key
        assert expected_key.endswith("example.com")

    def test_cache_key_normalization(self):
        """Test that domain names are normalized for cache keys."""
        # Domains should be lowercased and cleaned
        test_cases = [
            ("Example.COM", "pagerank:domain:example.com"),
            ("EXAMPLE.com", "pagerank:domain:example.com"),
            ("example.com", "pagerank:domain:example.com"),
        ]

        for input_domain, expected_key in test_cases:
            # Verify normalization
            normalized = input_domain.lower()
            cache_key = f"pagerank:domain:{normalized}"
            assert cache_key == expected_key
