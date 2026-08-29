"""Unit tests for domain authority scoring."""


from app.services.feeds.domain_authority import (
    get_domain_authority_score,
)


def test_get_domain_authority_score_empty_domain():
    """Test that empty domain returns 0."""
    assert get_domain_authority_score("").score == 0.0
    assert get_domain_authority_score(None).score == 0.0


def test_get_domain_authority_score_top_domains():
    """Test scoring for well-known top domains."""
    # These domains should have high scores (top 100 = 0.95-1.0)
    google_score = get_domain_authority_score("google.com").score
    assert google_score >= 0.95, f"google.com should score >= 0.95, got {google_score}"

    youtube_score = get_domain_authority_score("youtube.com").score
    assert youtube_score >= 0.95, f"youtube.com should score >= 0.95, got {youtube_score}"


def test_get_domain_authority_score_unknown_domain():
    """Test that unknown domains return 0."""
    score = get_domain_authority_score("this-domain-definitely-does-not-exist-12345.com").score
    assert score == 0.0
