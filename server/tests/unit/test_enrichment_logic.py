from datetime import datetime, timezone
from unittest.mock import patch

import pytest

from app.models.enums import FeedCategory
from app.services.feeds import enrichment, favicon, scoring
from app.typing.feeds import ArticleStats, FeedEnrichmentResponse, FeedEnrichmentSnapshot, FeedScoringData

# ==============================================================================
# SCORING TESTS
# ==============================================================================


@pytest.mark.unit
def test_calculate_quality_score_basic():
    feed_data = FeedScoringData(
        title="My Tech Blog",
        description="A blog about tech",
        image_url="https://example.com/icon.png",
        language="en",
    )
    # FeedScoringData doesn't have author? Let's check definition.
    # If not, I'll omit it. The score calc adds 0.05 for language.
    # Logic:
    # Title (0.15) + Desc (0.15) + Image (0.15) + Lang (0.05) = 0.5
    score = scoring.calculate_quality_score(feed_data)
    assert score == pytest.approx(0.5)


@pytest.mark.unit
def test_calculate_quality_score_with_stats():
    feed_data = FeedScoringData(title="My Tech Blog")
    article_stats = ArticleStats(count=10, image_ratio=0.6, avg_content_length=1200, days_since_last_article=2)
    # Base: 0.15 (title)
    # Stats: 0.15 (visuals) + 0.15 (depth) + 0.1 (activity count >=5) + 0.1 (recency) = 0.5
    # Total: 0.65
    score = scoring.calculate_quality_score(feed_data, article_stats)
    assert score == pytest.approx(0.65)


@pytest.mark.unit
def test_calculate_hybrid_popularity_score():
    feed_data = FeedScoringData(title="Test")
    llm_estimate = 80  # 0.8
    domain_auth = 0.5
    article_stats = ArticleStats(count=10, image_ratio=0.6, avg_content_length=1200, days_since_last_article=2)
    # Quality score from above is 0.65 (0.15 base + 0.5 stats)

    # Weights: 40% LLM, 30% Domain, 30% Quality
    # Score = (0.8 * 0.4) + (0.5 * 0.3) + (0.65 * 0.3)
    #       = 0.32 + 0.15 + 0.195 = 0.665

    result = scoring.calculate_hybrid_popularity_score(feed_data, llm_estimate, domain_auth, article_stats)

    assert result["popularity_score"] == pytest.approx(0.665)
    assert result["llm_popularity_score"] == 0.8
    assert result["domain_authority_score"] == 0.5
    assert result["quality_score"] == pytest.approx(0.65)


# ==============================================================================
# ENRICHMENT LOGIC TESTS
# ==============================================================================


@pytest.mark.unit
def test_calculate_article_stats():
    now = datetime.now(timezone.utc)
    articles = [
        {"content": "a" * 500, "image_url": "http://img.com/1.jpg", "published_at": now},
        {"content": "b" * 1500, "image_url": None, "published_at": now},
    ]

    stats = enrichment._calculate_article_stats(articles)

    assert stats.count == 2
    assert stats.image_ratio == 0.5
    assert stats.avg_content_length == 1000
    assert stats.days_since_last_article == 0


@pytest.mark.unit
def test_build_feed_update_mapping():
    feed_snapshot = FeedEnrichmentSnapshot(
        id="123",
        title="Test Feed",
        description="Desc",
        article_stats=ArticleStats(count=5),
        domain="test.com",
        language="en",
        url="http://test.com",
    )
    llm_result = FeedEnrichmentResponse(
        category="software_engineering",
        tags=["tech", "news"],
        popularity_estimate=80,
        enhanced_description="Better desc",
    )

    mapping = enrichment.build_feed_update_mapping(
        feed_snapshot,
        language="en",
        llm_result=llm_result,
    )

    assert mapping["id"] == "123"
    assert mapping["language"] == "en"
    assert mapping["top_level_category"] == FeedCategory.SOFTWARE_ENGINEERING
    assert mapping["tags"] == ["tech", "news"]
    assert mapping["description"] == "Better desc"
    assert "popularity_score" in mapping
    assert "updated_at" in mapping


# ==============================================================================
# FAVICON TESTS
# ==============================================================================


@pytest.mark.asyncio
async def test_extract_favicon_success():
    from unittest.mock import AsyncMock

    with (
        patch.object(favicon, "validate_url_security", new=AsyncMock()),
        patch.object(
            favicon,
            "fetch_public_resource",
            new=AsyncMock(
                side_effect=[
                    None,
                    {"body": b"icon", "final_url": "https://example.com/favicon.ico", "charset": None},
                ]
            ),
        ),
        patch.object(favicon, "normalize_favicon_to_png", return_value=b"png"),
        patch.object(favicon, "_get_async_supabase", new=AsyncMock()),
        patch.object(favicon, "put_favicon_png", new=AsyncMock(return_value="stored.png")),
    ):
        result = await favicon.extract_favicon_and_canonical_url("https://example.com")
        assert result.image_url == "stored.png"


@pytest.mark.asyncio
async def test_extract_favicon_google_fallback():
    from unittest.mock import AsyncMock

    with (
        patch.object(favicon, "validate_url_security", new=AsyncMock()),
        patch.object(favicon, "fetch_public_resource", new=AsyncMock(return_value=None)) as fetch,
    ):
        result = await favicon.extract_favicon_and_canonical_url("https://example.com")
        assert result.image_url is None
        assert fetch.call_args.args[0] == "https://www.google.com/s2/favicons?domain=example.com&sz=256"
