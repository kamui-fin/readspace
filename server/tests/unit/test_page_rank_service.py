"""Unit tests for PageRank domain scoring service."""

import pytest

from app.services.feeds.enrichment.page_rank import PageRankService


@pytest.mark.unit
class TestPageRankDomainScoring:
    """Test domain scoring logic without Redis dependencies."""

    def test_get_domain_score_for_unknown_domain(self):
        """Test that unknown domains return 0.0 score."""
        service = PageRankService()

        score = service.get_domain_score("unknown-domain-12345.com")

        assert score == 0.0

    def test_get_domain_score_with_empty_domain(self):
        """Test that empty domain returns 0.0 score."""
        service = PageRankService()

        assert service.get_domain_score("") == 0.0
        assert service.get_domain_score(None) == 0.0  # type: ignore[arg-type]

    def test_subdomain_fallback_scoring(self):
        """Test that subdomains fallback to parent domain with reduced score."""
        service = PageRankService()

        # Manually inject a test domain score
        if service._domain_scores is not None:
            service._domain_scores["example.com"] = 100.0

            # Subdomain should get 80% of parent domain score
            score = service.get_domain_score("blog.example.com")

            assert score == 80.0  # 100 * 0.8

    def test_direct_domain_lookup(self):
        """Test direct domain lookup when domain exists in dataset."""
        service = PageRankService()

        if service._domain_scores is not None:
            service._domain_scores["test.com"] = 50.0

            score = service.get_domain_score("test.com")

            assert score == 50.0

    def test_domain_cleaning(self):
        """Test that domains are cleaned before lookup."""
        service = PageRankService()

        if service._domain_scores is not None:
            service._domain_scores["example.com"] = 75.0

            # Should clean www and lowercase
            score = service.get_domain_score("WWW.EXAMPLE.COM")

            # Should find the cleaned domain
            assert score > 0

    def test_stats_with_empty_dataset(self):
        """Test stats when dataset is empty."""
        service = PageRankService()
        service._domain_scores = {}

        stats = service.get_stats()

        assert stats["loaded"] is False
        assert stats["total_domains"] == 0

    def test_stats_with_loaded_dataset(self):
        """Test stats with loaded dataset."""
        service = PageRankService()
        service._domain_scores = {
            "example1.com": 10.0,
            "example2.com": 20.0,
            "example3.com": 30.0,
        }

        stats = service.get_stats()

        assert stats["loaded"] is True
        assert stats["total_domains"] == 3
        assert stats["min_score"] == 10.0
        assert stats["max_score"] == 30.0
        assert stats["avg_score"] == 20.0

    def test_is_loaded_with_dataset(self):
        """Test is_loaded returns True when dataset is loaded."""
        service = PageRankService()
        service._domain_scores = {"example.com": 50.0}

        assert service.is_loaded() is True

    def test_is_loaded_with_empty_dataset(self):
        """Test is_loaded returns False when dataset is empty."""
        service = PageRankService()
        service._domain_scores = {}

        assert service.is_loaded() is False

    def test_is_loaded_with_none_dataset(self):
        """Test is_loaded returns False when dataset is None."""
        service = PageRankService()
        service._domain_scores = None

        assert service.is_loaded() is False


@pytest.mark.unit
class TestPageRankURLFormats:
    """Test PageRank scoring with various URL formats."""

    def test_score_with_full_url(self):
        """Test scoring with full URL (should extract domain)."""
        service = PageRankService()

        if service._domain_scores is not None:
            service._domain_scores["example.com"] = 60.0

            score = service.get_domain_score("https://www.example.com/feed.xml")

            assert score > 0

    def test_score_with_uppercase_domain(self):
        """Test scoring with uppercase domain."""
        service = PageRankService()

        if service._domain_scores is not None:
            service._domain_scores["example.com"] = 60.0

            score = service.get_domain_score("EXAMPLE.COM")

            assert score > 0

    def test_score_with_www_prefix(self):
        """Test scoring with www prefix."""
        service = PageRankService()

        if service._domain_scores is not None:
            service._domain_scores["example.com"] = 60.0

            score = service.get_domain_score("www.example.com")

            assert score > 0

    def test_deep_subdomain_fallback(self):
        """Test fallback for deep subdomains."""
        service = PageRankService()

        if service._domain_scores is not None:
            service._domain_scores["example.com"] = 100.0

            # Deep subdomain should still fallback to parent
            score = service.get_domain_score("deep.blog.example.com")

            assert score == 80.0  # 100 * 0.8

    def test_no_fallback_for_single_level_domain(self):
        """Test that single-level domains don't fallback."""
        service = PageRankService()

        if service._domain_scores is not None:
            service._domain_scores = {}  # Empty dataset

            score = service.get_domain_score("localhost")

            assert score == 0.0
