import pytest
from unittest.mock import MagicMock, patch
from uuid import uuid4
from datetime import datetime, timezone

from sqlalchemy import select

from app.models.feed import Feed
from app.models.enums import FeedCategory
from app.typing.feeds import FeedEnrichmentResponse
from app.models.feed import Feed
from app.models.enums import FeedCategory
from app.typing.feeds import FeedEnrichmentResponse
from unittest.mock import MagicMock, patch
import sys

@pytest.mark.asyncio
async def test_batch_enrichment_flow(db_session):
    # Mock tranco and domain_authority before importing worker
    mock_da_module = MagicMock()
    mock_da_module.get_domain_authority_scores_batch.return_value = {"example.com": 0.7}
    
    with patch.dict(sys.modules, {"app.services.feeds.domain_authority": mock_da_module, "tranco": MagicMock()}):
        from app.workers.feed.enrichment import batch_enrich_feeds
        
        # 1. Setup Data
        feed = Feed(
            id=uuid4(),
            url="https://example.com/feed",
            title="Example Feed",
            description="A feed about examples",
            link="https://example.com",
            language="en",
            popularity_score=0.0,
            top_level_category=FeedCategory.MISCELLANEOUS,
            tags=None,
            # Ensure it looks like it needs enrichment (e.g. no tags, low score)
        )
        db_session.add(feed)
        await db_session.commit()
        
        # 2. Mock Dependencies
        
        # Mock Settings
        with patch("app.workers.feed.enrichment.get_settings") as mock_settings:
            mock_settings.return_value.ENABLE_AI = True
            
            # Mock LLM Batch Service
            with patch("app.workers.feed.enrichment.enrich_feeds_batch") as mock_batch:
                # Return a fake result for our feed
                mock_result = FeedEnrichmentResponse(
                    category="TECHNOLOGY_PROGRAMMING",
                    tags=["example", "tech"],
                    popularity_estimate=85,
                    enhanced_description="An enhanced description about examples."
                )
                mock_batch.return_value = [mock_result]
                
                # Mock Meilisearch Sync (to avoid external calls)
                with patch("app.workers.feed.enrichment.sync_feeds_to_meilisearch") as mock_sync:
                    
                    # 3. Run Worker
                    result = await batch_enrich_feeds()
                    
                    # 4. Verify Result
                    assert result["success"] is True
                    assert result["enriched_count"] == 1
                    
                    # 5. Verify DB Updates
                    await db_session.refresh(feed)
                    
                    assert feed.top_level_category == FeedCategory.TECHNOLOGY_PROGRAMMING
                    assert feed.tags == ["example", "tech"]
                    assert feed.description == "An enhanced description about examples."
                    
                    # Verify Popularity Score Calculation
                    # LLM: 85 -> 0.85 * 0.4 = 0.34
                    # DA: 0.7 * 0.3 = 0.21
                    # Quality: 
                    #   Title (0.15) + Desc (0.1) + Lang (0.05) = 0.3 (assuming no image/author/articles)
                    #   Wait, we didn't add articles, so stats will be empty.
                    #   Quality = 0.3
                    #   0.3 * 0.3 = 0.09
                    # Total = 0.34 + 0.21 + 0.09 = 0.64
                    
                    # Allow some floating point variance
                    assert feed.popularity_score == pytest.approx(0.64, abs=0.05)
                    
                    # Verify Mocks Called
                    mock_batch.assert_called_once()
                    mock_sync.assert_called_once()

@pytest.mark.asyncio
async def test_batch_enrichment_disabled_ai(db_session):
    # Mock tranco and domain_authority before importing worker
    mock_da_module = MagicMock()
    
    with patch.dict(sys.modules, {"app.services.feeds.domain_authority": mock_da_module, "tranco": MagicMock()}):
        from app.workers.feed.enrichment import batch_enrich_feeds
        
        with patch("app.workers.feed.enrichment.get_settings") as mock_settings:
            mock_settings.return_value.ENABLE_AI = False
            
            result = await batch_enrich_feeds()
            
            assert result["success"] is True
            assert result["enriched_count"] == 0
            assert result["message"] == "AI disabled"

@pytest.mark.asyncio
async def test_batch_enrichment_no_feeds(db_session):
    # Ensure DB is empty of feeds needing enrichment
    # (The test DB is isolated per function, so it should be empty unless we add something)
    
    # Mock tranco and domain_authority before importing worker
    mock_da_module = MagicMock()
    
    with patch.dict(sys.modules, {"app.services.feeds.domain_authority": mock_da_module, "tranco": MagicMock()}):
        from app.workers.feed.enrichment import batch_enrich_feeds

        with patch("app.workers.feed.enrichment.get_settings") as mock_settings:
            mock_settings.return_value.ENABLE_AI = True
            
            result = await batch_enrich_feeds()
            
            assert result["success"] is True
            assert result["enriched_count"] == 0
            assert result["message"] == "No feeds needing enrichment"
