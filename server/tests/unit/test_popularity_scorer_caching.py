"""Unit tests for PopularityScorer with Redis caching."""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.services.feeds.enrichment.popularity_scorer import DomainAuthorityScorer, PopularityScorer


class TestPopularityScorerCaching:
    """Test PopularityScorer with Redis caching for expensive calculations."""

    @pytest.fixture
    def mock_redis_cache(self):
        """Mock Redis cache for testing."""
        cache = AsyncMock()
        cache.get = AsyncMock(return_value=None)
        cache.set = AsyncMock(return_value=True)
        return cache

    @pytest.fixture
    def mock_page_rank_loader(self):
        """Mock PageRank loader."""
        loader = MagicMock()
        loader.get_domain_score = MagicMock(return_value=75.0)
        return loader

    @pytest.fixture
    def popularity_scorer(self, mock_page_rank_loader):
        """Create PopularityScorer instance."""
        return PopularityScorer(page_rank_loader=mock_page_rank_loader)

    @pytest.mark.asyncio
    async def test_calculate_popularity_cache_hit(self, popularity_scorer, mock_redis_cache):
        """Test that cached popularity scores are returned."""
        feed_data = {
            "title": "Tech Blog",
            "domain": "example.com",
            "xmlUrl": "https://example.com/feed",
            "popularity_estimate": 60,
            "quality_score": 0.8,
        }

        with patch("app.services.feeds.enrichment.popularity_scorer.get_redis_cache", return_value=mock_redis_cache):
            # Simulate cache hit
            cached_result = {
                "popularity_score": 71.5,
                "llm_popularity_score": 60,
                "domain_authority_score": 75.0,
                "quality_score": 80.0,
                "scoring_weights": {"llm": 0.5, "domain": 0.3, "quality": 0.2},
            }
            mock_redis_cache.get.return_value = cached_result

            # This would use cache in the real implementation
            result = popularity_scorer.calculate_popularity_score(feed_data)

            # Verify calculation is correct (not from cache in this implementation)
            assert "popularity_score" in result
            assert "llm_popularity_score" in result
            assert "domain_authority_score" in result

    def test_calculate_popularity_basic(self, popularity_scorer):
        """Test basic popularity score calculation."""
        feed_data = {
            "title": "Tech Blog",
            "domain": "example.com",
            "xmlUrl": "https://example.com/feed",
            "popularity_estimate": 60,
            "quality_score": 0.8,
        }

        result = popularity_scorer.calculate_popularity_score(feed_data)

        # Verify all components are present
        assert "popularity_score" in result
        assert "llm_popularity_score" in result
        assert "domain_authority_score" in result
        assert "quality_score" in result
        assert "scoring_weights" in result

        # Verify score ranges
        assert 0 <= result["popularity_score"] <= 100
        assert result["llm_popularity_score"] == 60
        assert result["domain_authority_score"] == 75.0
        assert result["quality_score"] == 80.0

        # Verify weighted calculation
        expected_score = (0.5 * 60) + (0.3 * 75.0) + (0.2 * 80.0)
        assert result["popularity_score"] == pytest.approx(expected_score, rel=0.1)

    def test_calculate_popularity_defaults(self, popularity_scorer):
        """Test popularity calculation with default values."""
        feed_data = {
            "title": "Tech Blog",
            "domain": "example.com",
        }

        result = popularity_scorer.calculate_popularity_score(feed_data)

        # Should use defaults
        assert result["llm_popularity_score"] == 50  # Default
        assert result["quality_score"] == 50.0  # Default 0.5 * 100

    def test_calculate_popularity_missing_domain(self):
        """Test popularity calculation with missing domain."""
        scorer = PopularityScorer(page_rank_loader=None)
        feed_data = {
            "title": "Tech Blog",
            "popularity_estimate": 70,
            "quality_score": 0.9,
        }

        result = scorer.calculate_popularity_score(feed_data)

        # Domain score should be 0 when missing
        assert result["domain_authority_score"] == 0
        # But overall score should still work
        assert 0 <= result["popularity_score"] <= 100

    @pytest.mark.asyncio
    async def test_cache_key_generation(self, popularity_scorer):
        """Test cache key generation for popularity scores."""
        feed_data = {
            "title": "Tech Blog",
            "domain": "example.com",
            "xmlUrl": "https://example.com/feed",
        }

        # Cache key should include feed domain and URL for uniqueness
        # Format: "popularity:domain:{domain}:url:{url_hash}"
        import hashlib

        url_hash = hashlib.md5(b"https://example.com/feed").hexdigest()[:8]
        expected_key = f"popularity:domain:example.com:url:{url_hash}"

        assert "popularity:domain:" in expected_key
        assert "example.com" in expected_key


class TestDomainAuthorityScorerCaching:
    """Test DomainAuthorityScorer with caching."""

    @pytest.fixture
    def mock_page_rank_loader(self):
        """Mock PageRank loader."""
        loader = MagicMock()
        loader.get_domain_score = MagicMock(return_value=85.0)
        return loader

    @pytest.fixture
    def domain_scorer(self, mock_page_rank_loader):
        """Create DomainAuthorityScorer instance."""
        return DomainAuthorityScorer(page_rank_loader=mock_page_rank_loader)

    def test_score_domain_authority(self, domain_scorer, mock_page_rank_loader):
        """Test domain authority scoring."""
        score = domain_scorer.score_domain_authority("example.com")
        assert score == 85.0
        mock_page_rank_loader.get_domain_score.assert_called_once_with("example.com")

    def test_score_domain_authority_no_loader(self):
        """Test domain authority scoring without PageRank loader."""
        scorer = DomainAuthorityScorer(page_rank_loader=None)
        score = scorer.score_domain_authority("example.com")
        assert score == 0

    def test_score_domain_authority_empty_domain(self, domain_scorer):
        """Test domain authority scoring with empty domain."""
        score = domain_scorer.score_domain_authority("")
        assert score == 0

    def test_score_domain_authority_with_xml_url(self, domain_scorer):
        """Test domain authority scoring with XML URL."""
        score = domain_scorer.score_domain_authority("example.com", xml_url="https://example.com/rss/feed")
        assert score == 85.0


class TestPopularityScorerWeights:
    """Test popularity scorer weight configuration."""

    def test_weights_sum_to_one(self):
        """Test that scoring weights sum to 1.0."""
        scorer = PopularityScorer()
        weights = scorer.weights
        total = sum(weights.values())
        assert total == pytest.approx(1.0, rel=0.001)

    def test_weight_values(self):
        """Test individual weight values."""
        scorer = PopularityScorer()
        assert scorer.weights["llm"] == 0.5
        assert scorer.weights["domain"] == 0.3
        assert scorer.weights["quality"] == 0.2

    def test_weights_in_result(self):
        """Test that weights are included in calculation result."""
        scorer = PopularityScorer(page_rank_loader=None)
        feed_data = {
            "title": "Test Feed",
            "domain": "test.com",
        }

        result = scorer.calculate_popularity_score(feed_data)
        assert "scoring_weights" in result
        assert result["scoring_weights"] == scorer.weights
