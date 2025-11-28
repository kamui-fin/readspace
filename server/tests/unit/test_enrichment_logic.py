import pytest
from unittest.mock import MagicMock, patch
from datetime import datetime, timezone

from app.services.feeds import enrichment, scoring, favicon
from app.models.feed import Feed
from app.typing.feeds import FeedEnrichmentResponse
from app.models.enums import FeedCategory

# ==============================================================================
# SCORING TESTS
# ==============================================================================

def test_calculate_quality_score_basic():
    feed_data = {
        "title": "My Tech Blog",
        "description": "A blog about tech",
        "image_url": "https://example.com/icon.png",
        "language": "en",
        "author": "John Doe"
    }
    score = scoring.calculate_quality_score(feed_data)
    # 0.15 (title) + 0.1 (desc) + 0.1 (image) + 0.05 (lang) + 0.1 (author) = 0.5
    assert score == pytest.approx(0.5)

def test_calculate_quality_score_with_stats():
    feed_data = {"title": "My Tech Blog"}
    article_stats = {
        "count": 10,
        "image_ratio": 0.6,  # > 0.5 -> +0.15
        "avg_content_length": 1200, # > 1000 -> +0.15
        "days_since_last_article": 2 # < 7 -> +0.1
    }
    # Base: 0.15 (title)
    # Stats: 0.15 (visuals) + 0.15 (depth) + 0.1 (activity count >=5) + 0.1 (recency) = 0.5
    # Total: 0.65
    score = scoring.calculate_quality_score(feed_data, article_stats)
    assert score == pytest.approx(0.65)

def test_calculate_hybrid_popularity_score():
    feed_data = {"title": "Test"}
    llm_estimate = 80 # 0.8
    domain_auth = 0.5
    article_stats = {
        "count": 10,
        "image_ratio": 0.6,
        "avg_content_length": 1200,
        "days_since_last_article": 2
    }
    # Quality score from above is 0.65 (0.15 base + 0.5 stats)
    
    # Weights: 40% LLM, 30% Domain, 30% Quality
    # Score = (0.8 * 0.4) + (0.5 * 0.3) + (0.65 * 0.3)
    #       = 0.32 + 0.15 + 0.195 = 0.665
    
    result = scoring.calculate_hybrid_popularity_score(
        feed_data, llm_estimate, domain_auth, article_stats
    )
    
    assert result["popularity_score"] == pytest.approx(0.665)
    assert result["llm_popularity_score"] == 0.8
    assert result["domain_authority_score"] == 0.5
    assert result["quality_score"] == pytest.approx(0.65)

# ==============================================================================
# ENRICHMENT LOGIC TESTS
# ==============================================================================

def test_detect_language_feed_has_lang():
    feed = MagicMock(spec=Feed)
    feed.language = "fr-CA"
    feed.title = "Le Blog"
    
    lang = enrichment.detect_language(feed)
    assert lang == "fr"

@patch("app.services.feeds.enrichment.detect_feed_language")
def test_detect_language_fallback(mock_detect):
    feed = MagicMock(spec=Feed)
    feed.language = None
    feed.title = "The Blog"
    feed.description = "A blog"
    
    mock_detect.return_value = "es"
    
    lang = enrichment.detect_language(feed, ["Hola mundo"])
    
    assert lang == "es"
    mock_detect.assert_called_once()
    call_kwargs = mock_detect.call_args[1]
    assert call_kwargs["title"] == "The Blog"
    assert call_kwargs["articles"] == ["Hola mundo"]

def test_calculate_article_stats():
    now = datetime.now(timezone.utc)
    articles = [
        {"content": "a" * 500, "image_url": "http://img.com/1.jpg", "published_at": now},
        {"content": "b" * 1500, "image_url": None, "published_at": now},
    ]
    
    stats = enrichment._calculate_article_stats(articles)
    
    assert stats["count"] == 2
    assert stats["image_ratio"] == 0.5
    assert stats["avg_content_length"] == 1000
    assert stats["days_since_last_article"] == 0

def test_build_feed_update_mapping():
    feed_snapshot = {
        "id": "123",
        "title": "Test Feed",
        "article_stats": {"count": 5}
    }
    llm_result = FeedEnrichmentResponse(
        category="TECHNOLOGY_PROGRAMMING",
        tags=["tech", "news"],
        popularity_estimate=80,
        enhanced_description="Better desc"
    )
    
    mapping = enrichment.build_feed_update_mapping(
        feed_snapshot, 
        language="en", 
        llm_result=llm_result, 
        domain_authority_score=0.5
    )
    
    assert mapping["id"] == "123"
    assert mapping["language"] == "en"
    assert mapping["top_level_category"] == FeedCategory.TECHNOLOGY_PROGRAMMING
    assert mapping["tags"] == ["tech", "news"]
    assert mapping["description"] == "Better desc"
    assert "popularity_score" in mapping
    assert "updated_at" in mapping

# ==============================================================================
# FAVICON TESTS
# ==============================================================================

@pytest.mark.asyncio
async def test_extract_favicon_success():
    with patch("httpx.AsyncClient") as mock_client:
        # Mock response
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.url = "https://example.com"
        mock_response.text = '<html><link rel="icon" href="/favicon.ico"></html>'
        
        mock_client.return_value.__aenter__.return_value.get.return_value = mock_response
        
        # Mock extract_favicon library
        with patch("app.services.feeds.favicon.from_html") as mock_from_html, \
             patch("app.services.feeds.favicon.check_availability") as mock_check:
            
            mock_icon = MagicMock()
            mock_icon.url = "https://example.com/favicon.ico"
            mock_icon.format = "ico"
            mock_icon.width = 32
            mock_icon.height = 32
            mock_icon.reachable = True
            
            # Mock return values
            # We need to mock the filtering logic in the function
            # The function filters for svg, data uri, or large icons (>64)
            # Let's make it large enough
            mock_icon.width = 100
            mock_icon.height = 100
            
            mock_from_html.return_value = [mock_icon]
            mock_check.return_value = [mock_icon]
            
            result = await favicon.extract_favicon_and_canonical_url("https://example.com")
            
            assert result["image_url"] == "https://example.com/favicon.ico"

@pytest.mark.asyncio
async def test_extract_favicon_google_fallback():
    with patch("httpx.AsyncClient") as mock_client:
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.url = "https://example.com"
        mock_response.text = '<html><body>No icon here</body></html>'
        mock_client.return_value.__aenter__.return_value.get.return_value = mock_response
        
        with patch("app.services.feeds.favicon.from_html", return_value=[]), \
             patch("app.services.feeds.favicon.from_google") as mock_google:
            
            mock_google_icon = MagicMock()
            mock_google_icon.url = "https://google.com/s2/favicons?domain=example.com"
            mock_google.return_value = mock_google_icon
            
            result = await favicon.extract_favicon_and_canonical_url("https://example.com")
            
            assert result["image_url"] == "https://google.com/s2/favicons?domain=example.com"
