import pytest
from unittest.mock import MagicMock, patch
from uuid import uuid4
from datetime import datetime, timezone

from sqlalchemy import select

from app.models.feed import Feed
from app.models.enums import FeedCategory
from app.models.enums import FeedCategory, ContentType
from app.typing.feeds import FeedEnrichmentResponse
from app.models.feed import Feed
from app.models.enums import FeedCategory
from app.typing.feeds import FeedEnrichmentResponse
from unittest.mock import MagicMock, patch
import sys


@pytest.mark.asyncio
async def test_batch_enrichment_flow(db_session):
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
    with patch("app.workers.feed.enrichment.get_settings") as mock_settings, patch(
        "app.workers.feed.enrichment.get_domain_authority_scores_batch"
    ) as mock_da:

        mock_settings.return_value.ENABLE_AI = True
        mock_da.return_value = {"example.com": 0.7}

        # Mock LLM Batch Service
        with patch("app.workers.feed.enrichment.enrich_feeds_batch") as mock_batch:
            # Return a fake result for our feed
            mock_result = FeedEnrichmentResponse(
                category="software_engineering",
                tags=["example", "tech"],
                popularity_estimate=85,
                enhanced_description="An enhanced description about examples.",
            )
            mock_batch.return_value = [mock_result]

            # Mock Meilisearch Sync (to avoid external calls)
            with patch("app.workers.feed.enrichment.sync_feeds_batch") as mock_sync:

                # 3. Run Worker
                result = await batch_enrich_feeds()

                # 4. Verify Result
                assert result["success"] is True
                assert result["enriched_count"] == 1

                # 5. Verify DB Updates
                await db_session.refresh(feed)

                assert feed.top_level_category == FeedCategory.SOFTWARE_ENGINEERING
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
async def test_batch_enrichment_empty_tags(db_session):
    """Verify that feeds with empty tags [] are also picked up for enrichment."""
    from app.workers.feed.enrichment import batch_enrich_feeds
    from app.models.feed import Feed

    # 1. Setup Data with EMPTY tags list (not None)
    feed = Feed(
        id=uuid4(),
        url="https://example.com/feed-empty-tags",
        title="Empty Tags Feed",
        description="A feed with empty tags list",
        link="https://example.com",
        language="en",
        popularity_score=0.0,
        top_level_category=FeedCategory.MISCELLANEOUS,
        tags=[],  # Explicitly empty list
        tags_native=[],
    )
    db_session.add(feed)
    await db_session.commit()

    # 2. Mock Dependencies
    with patch("app.workers.feed.enrichment.get_settings") as mock_settings, patch(
        "app.workers.feed.enrichment.get_domain_authority_scores_batch"
    ) as mock_da:

        mock_settings.return_value.ENABLE_AI = True
        mock_da.return_value = {}

        with patch("app.workers.feed.enrichment.enrich_feeds_batch") as mock_batch, \
             patch("app.workers.feed.enrichment.sync_feeds_batch") as mock_sync:

            # Mock successful enrichment
            mock_result = FeedEnrichmentResponse(
                category="TECHNOLOGY_PROGRAMMING",
                tags=["new", "tags"],
                popularity_estimate=50,
                content_type="indie_blog",
                author="John Doe",
                tags_native=["nativo"],
            )
            mock_batch.return_value = [mock_result]

            # 3. Run Worker
            result = await batch_enrich_feeds()

            # 4. Verify Result
            assert result["success"] is True
            assert result["enriched_count"] == 1

            # 5. Verify DB Updates
            await db_session.refresh(feed)
            assert feed.tags == ["new", "tags"]
            assert feed.tags_native == ["nativo"]
            assert feed.author == "John Doe"
            assert feed.content_type == ContentType.INDIE_BLOG


@pytest.mark.asyncio
async def test_batch_enrichment_disabled_ai(db_session):
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

    from app.workers.feed.enrichment import batch_enrich_feeds

    with patch("app.workers.feed.enrichment.get_settings") as mock_settings:
        mock_settings.return_value.ENABLE_AI = True

        result = await batch_enrich_feeds()

        assert result["success"] is True
        assert result["enriched_count"] == 0
        assert result["message"] == "No feeds needing enrichment"
