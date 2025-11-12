"""Unit tests for popularity scoring calculations."""

from unittest.mock import MagicMock

import pytest

from app.services.feeds.enrichment.popularity_scorer import DomainAuthorityScorer, PopularityScorer


@pytest.mark.unit
class TestDomainAuthorityScorer:
    """Tests for DomainAuthorityScorer class."""

    def test_empty_domain_returns_zero(self):
        """Empty domain should return 0 score."""
        scorer = DomainAuthorityScorer()
        assert scorer.score_domain_authority("") == 0
        assert scorer.score_domain_authority("", xml_url="http://example.com/feed") == 0

    def test_none_domain_returns_zero(self):
        """None domain should return 0 score."""
        scorer = DomainAuthorityScorer()
        assert scorer.score_domain_authority(None) == 0  # type: ignore

    def test_domain_without_page_rank_loader_returns_zero(self):
        """Domain without PageRank loader should default to 0."""
        scorer = DomainAuthorityScorer(page_rank_loader=None)
        assert scorer.score_domain_authority("example.com") == 0

    def test_domain_with_page_rank_loader_returns_score(self):
        """Domain with PageRank loader should return score from loader."""
        mock_loader = MagicMock()
        mock_loader.get_domain_score.return_value = 75.5

        scorer = DomainAuthorityScorer(page_rank_loader=mock_loader)
        result = scorer.score_domain_authority("example.com")

        assert result == 75
        mock_loader.get_domain_score.assert_called_once_with("example.com")

    def test_domain_with_page_rank_loader_not_found(self):
        """Domain not found in PageRank should return 0."""
        mock_loader = MagicMock()
        mock_loader.get_domain_score.return_value = 0.0

        scorer = DomainAuthorityScorer(page_rank_loader=mock_loader)
        result = scorer.score_domain_authority("unknown-domain.com")

        assert result == 0
        mock_loader.get_domain_score.assert_called_once_with("unknown-domain.com")

    def test_domain_cleaning_applied(self):
        """Domain should be cleaned before lookup."""
        mock_loader = MagicMock()
        mock_loader.get_domain_score.return_value = 85.0

        scorer = DomainAuthorityScorer(page_rank_loader=mock_loader)

        # Test with www prefix (should be removed by extract_clean_domain)
        result = scorer.score_domain_authority("www.example.com")

        assert result == 85
        # Should be called with cleaned domain (www removed)
        mock_loader.get_domain_score.assert_called_once_with("example.com")

    def test_uppercase_domain_cleaned(self):
        """Uppercase domain should be lowercased before lookup."""
        mock_loader = MagicMock()
        mock_loader.get_domain_score.return_value = 90.0

        scorer = DomainAuthorityScorer(page_rank_loader=mock_loader)
        result = scorer.score_domain_authority("EXAMPLE.COM")

        assert result == 90
        mock_loader.get_domain_score.assert_called_once_with("example.com")

    def test_score_rounding(self):
        """Float scores should be converted to integers."""
        mock_loader = MagicMock()
        mock_loader.get_domain_score.return_value = 67.8

        scorer = DomainAuthorityScorer(page_rank_loader=mock_loader)
        result = scorer.score_domain_authority("example.com")

        assert result == 67
        assert isinstance(result, int)

    @pytest.mark.parametrize(
        "page_rank_score,expected_int",
        [
            (100.0, 100),
            (75.5, 75),
            (50.9, 50),
            (25.1, 25),
            (0.0, 0),
            (0.9, 0),
        ],
    )
    def test_parametrized_score_rounding(self, page_rank_score: float, expected_int: int):
        """Test score rounding for various values."""
        mock_loader = MagicMock()
        mock_loader.get_domain_score.return_value = page_rank_score

        scorer = DomainAuthorityScorer(page_rank_loader=mock_loader)
        result = scorer.score_domain_authority("test.com")

        assert result == expected_int


@pytest.mark.unit
class TestPopularityScorer:
    """Tests for PopularityScorer class."""

    def test_default_weights_sum_to_one(self):
        """Scorer weights should sum to 1.0."""
        scorer = PopularityScorer()
        weight_sum = sum(scorer.weights.values())
        assert abs(weight_sum - 1.0) < 0.001  # Float comparison with tolerance

    def test_weights_correct_values(self):
        """Weights should have expected values."""
        scorer = PopularityScorer()
        assert scorer.weights["llm"] == 0.5
        assert scorer.weights["domain"] == 0.3
        assert scorer.weights["quality"] == 0.2

    def test_minimal_feed_data_uses_defaults(self):
        """Minimal feed data should use default values."""
        scorer = PopularityScorer()
        feed_data = {}

        result = scorer.calculate_popularity_score(feed_data)

        # With defaults: llm=50, domain=0, quality=50 (0.5 * 100)
        # Score = 0.5*50 + 0.3*0 + 0.2*50 = 25 + 0 + 10 = 35
        assert result["popularity_score"] == 35.0
        assert result["llm_popularity_score"] == 50
        assert result["domain_authority_score"] == 0
        assert result["quality_score"] == 50.0

    def test_all_scores_provided(self):
        """All scores provided should be used in calculation."""
        scorer = PopularityScorer()
        feed_data = {
            "popularity_estimate": 80,  # LLM score
            "domain": "example.com",
            "quality_score": 0.9,  # 0-1 scale
        }

        result = scorer.calculate_popularity_score(feed_data)

        # Score = 0.5*80 + 0.3*0 + 0.2*90 = 40 + 0 + 18 = 58
        assert result["popularity_score"] == 58.0
        assert result["llm_popularity_score"] == 80
        assert result["quality_score"] == 90.0

    def test_quality_score_conversion(self):
        """Quality score should be converted from 0-1 to 0-100 scale."""
        scorer = PopularityScorer()
        feed_data = {"quality_score": 0.75}

        result = scorer.calculate_popularity_score(feed_data)

        assert result["quality_score"] == 75.0

    def test_with_page_rank_loader(self):
        """PopularityScorer with PageRank loader should use domain scores."""
        mock_loader = MagicMock()
        mock_loader.get_domain_score.return_value = 85.0

        scorer = PopularityScorer(page_rank_loader=mock_loader)
        feed_data = {
            "popularity_estimate": 70,
            "domain": "example.com",
            "quality_score": 0.8,
        }

        result = scorer.calculate_popularity_score(feed_data)

        # Score = 0.5*70 + 0.3*85 + 0.2*80 = 35 + 25.5 + 16 = 76.5
        assert result["popularity_score"] == 76.5
        assert result["domain_authority_score"] == 85

    def test_score_rounding_to_one_decimal(self):
        """Final score should be rounded to 1 decimal place."""
        scorer = PopularityScorer()
        feed_data = {
            "popularity_estimate": 77,
            "quality_score": 0.77,
        }

        result = scorer.calculate_popularity_score(feed_data)

        # Score = 0.5*77 + 0.3*0 + 0.2*77 = 38.5 + 0 + 15.4 = 53.9
        assert result["popularity_score"] == 53.9
        assert isinstance(result["popularity_score"], float)

    def test_result_structure(self):
        """Result should contain all expected keys."""
        scorer = PopularityScorer()
        feed_data = {}

        result = scorer.calculate_popularity_score(feed_data)

        assert "popularity_score" in result
        assert "llm_popularity_score" in result
        assert "domain_authority_score" in result
        assert "quality_score" in result
        assert "scoring_weights" in result

    def test_scoring_weights_copy_returned(self):
        """Result should include a copy of scoring weights."""
        scorer = PopularityScorer()
        feed_data = {}

        result = scorer.calculate_popularity_score(feed_data)

        assert result["scoring_weights"] == scorer.weights
        # Should be a copy, not the same object
        assert result["scoring_weights"] is not scorer.weights

    def test_maximum_score(self):
        """Maximum possible score should be 100."""
        scorer = PopularityScorer()
        feed_data = {
            "popularity_estimate": 100,
            "domain": "high-authority.com",
            "quality_score": 1.0,
        }

        mock_loader = MagicMock()
        mock_loader.get_domain_score.return_value = 100.0
        scorer.domain_scorer.page_rank_loader = mock_loader

        result = scorer.calculate_popularity_score(feed_data)

        # Score = 0.5*100 + 0.3*100 + 0.2*100 = 50 + 30 + 20 = 100
        assert result["popularity_score"] == 100.0

    def test_minimum_score(self):
        """Minimum possible score should be 0."""
        scorer = PopularityScorer()
        feed_data = {
            "popularity_estimate": 0,
            "domain": "",
            "quality_score": 0.0,
        }

        result = scorer.calculate_popularity_score(feed_data)

        # Score = 0.5*0 + 0.3*0 + 0.2*0 = 0
        assert result["popularity_score"] == 0.0

    def test_xml_url_passed_to_domain_scorer(self):
        """xmlUrl should be passed to domain scorer."""
        mock_loader = MagicMock()
        mock_loader.get_domain_score.return_value = 50.0

        scorer = PopularityScorer(page_rank_loader=mock_loader)
        feed_data = {
            "domain": "example.com",
            "xmlUrl": "https://example.com/feed.xml",
        }

        result = scorer.calculate_popularity_score(feed_data)

        # Domain scorer should have been called
        assert result["domain_authority_score"] == 50

    @pytest.mark.parametrize(
        "llm_score,domain_score,quality_score,expected",
        [
            (100, 100, 1.0, 100.0),  # Maximum: 0.5*100 + 0.3*100 + 0.2*100 = 100
            (0, 0, 0.0, 0.0),  # Minimum: 0.5*0 + 0.3*0 + 0.2*0 = 0
            (50, 50, 0.5, 50.0),  # Middle: 0.5*50 + 0.3*50 + 0.2*50 = 50
            (80, 60, 0.8, 74.0),  # High scores: 0.5*80 + 0.3*60 + 0.2*80 = 74
            (20, 10, 0.2, 17.0),  # Low scores: 0.5*20 + 0.3*10 + 0.2*20 = 10 + 3 + 4 = 17
        ],
    )
    def test_parametrized_score_calculations(
        self,
        llm_score: int,
        domain_score: int,
        quality_score: float,
        expected: float,
    ):
        """Test various score combinations."""
        mock_loader = MagicMock()
        mock_loader.get_domain_score.return_value = float(domain_score)

        scorer = PopularityScorer(page_rank_loader=mock_loader)
        feed_data = {
            "popularity_estimate": llm_score,
            "domain": "test.com",
            "quality_score": quality_score,
        }

        result = scorer.calculate_popularity_score(feed_data)

        # Calculate expected manually
        manual_expected = 0.5 * llm_score + 0.3 * domain_score + 0.2 * (quality_score * 100)
        assert result["popularity_score"] == round(manual_expected, 1)
        assert result["popularity_score"] == expected

    def test_missing_title_in_feed_data(self):
        """Missing title should not cause errors."""
        scorer = PopularityScorer()
        feed_data = {"domain": "example.com"}  # No title

        result = scorer.calculate_popularity_score(feed_data)

        assert "popularity_score" in result

    def test_quality_score_edge_cases(self):
        """Test quality score edge cases."""
        scorer = PopularityScorer()

        # Quality score of 0
        result = scorer.calculate_popularity_score({"quality_score": 0.0})
        assert result["quality_score"] == 0.0

        # Quality score of 1
        result = scorer.calculate_popularity_score({"quality_score": 1.0})
        assert result["quality_score"] == 100.0

        # Very small quality score
        result = scorer.calculate_popularity_score({"quality_score": 0.01})
        assert result["quality_score"] == 1.0

    def test_llm_score_edge_cases(self):
        """Test LLM score edge cases."""
        scorer = PopularityScorer()

        # LLM score of 0
        result = scorer.calculate_popularity_score({"popularity_estimate": 0})
        assert result["llm_popularity_score"] == 0

        # LLM score of 100
        result = scorer.calculate_popularity_score({"popularity_estimate": 100})
        assert result["llm_popularity_score"] == 100

        # LLM score missing (should default to 50)
        result = scorer.calculate_popularity_score({})
        assert result["llm_popularity_score"] == 50
