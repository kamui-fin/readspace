"""Feed enrichment worker operations."""

from datetime import datetime, timezone
from typing import Any
from uuid import UUID

import structlog
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.constants import MAX_FEEDS_BATCH_SIZE
from app.models import Feed, FeedCategory
from app.services.ai import FeedEnrichmentService as AIFeedEnrichmentService
from app.services.feeds.enrichment.feed_enrichment import FeedEnrichmentService

logger = structlog.get_logger(__name__)


class FeedProxy:
    """Minimal feed proxy for popularity score calculation.

    Used to pass feed data to enrichment service without ORM objects.
    """

    def __init__(self, feed_id: UUID, link: str | None, url: str):
        self.id = feed_id
        self.link = link
        self.url = url


async def query_feeds_needing_enrichment(db: AsyncSession) -> list[Feed]:
    """Query feeds that need enrichment (no tags set).

    Args:
        db: Database session

    Returns:
        List of Feed ORM objects needing enrichment
    """
    result = await db.execute(select(Feed).where(Feed.tags.is_(None)).limit(MAX_FEEDS_BATCH_SIZE))
    feeds = result.scalars().all()
    logger.info("Found feeds to enrich", feed_count=len(feeds))
    return list(feeds)


def prepare_feed_snapshots(
    feeds: list[Feed], enrichment_service: FeedEnrichmentService
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """Extract feed data into snapshots for processing.

    This extracts all data from ORM objects while we have them,
    so we can release the DB connection during API calls.

    Args:
        feeds: List of Feed ORM objects
        enrichment_service: Service for language detection and domain extraction

    Returns:
        Tuple of (feed_data_list, feed_snapshot_list)
    """
    feed_data_list = []
    feed_snapshot_list = []

    for feed in feeds:
        # Detect language if not set
        language = feed.language or enrichment_service._detect_language(feed)

        # Extract domain
        domain = enrichment_service._extract_domain_from_url(feed.link or feed.url)

        # Store all feed data needed for later processing
        feed_snapshot = {
            "id": feed.id,
            "title": feed.title or "Unknown Feed",
            "description": feed.description or "",
            "domain": domain,
            "language": language,
            "link": feed.link,
            "url": feed.url,
            "image_url": feed.image_url,
        }
        feed_snapshot_list.append(feed_snapshot)

        # Prepare data for AI service
        feed_data_list.append(
            {
                "title": feed_snapshot["title"],
                "description": feed_snapshot["description"],
                "domain": domain,
                "language": language,
            }
        )

    return feed_data_list, feed_snapshot_list


def build_feed_update_mapping(
    feed_snapshot: dict[str, Any],
    language: str | None,
    llm_result: Any,
    enrichment_service: FeedEnrichmentService,
) -> dict[str, Any]:
    """Build update mapping for a single feed.

    Args:
        feed_snapshot: Feed data snapshot
        language: Detected language
        llm_result: LLM enrichment result
        enrichment_service: Service for popularity calculation

    Returns:
        Dictionary of fields to update
    """
    update_mapping = {
        "id": feed_snapshot["id"],
        "updated_at": datetime.now(timezone.utc),
    }

    # Add language
    if language:
        update_mapping["language"] = language

    # Add LLM enrichment data
    if llm_result:
        update_mapping["tags"] = llm_result.tags

        # Convert category string to enum
        try:
            category_enum = FeedCategory(llm_result.category)
            update_mapping["top_level_category"] = category_enum
        except ValueError:
            logger.warning(
                "Invalid category",
                category=llm_result.category,
                feed_id=feed_snapshot["id"],
            )
            update_mapping["top_level_category"] = FeedCategory.MISCELLANEOUS

        if llm_result.enhanced_description:
            update_mapping["description"] = llm_result.enhanced_description

        # Calculate hybrid popularity score
        feed_proxy = FeedProxy(
            feed_id=feed_snapshot["id"],
            link=feed_snapshot["link"],
            url=feed_snapshot["url"],
        )
        popularity_data = enrichment_service._calculate_hybrid_popularity_score(
            feed_proxy,
            {"popularity_estimate": llm_result.popularity_estimate},
        )
        update_mapping.update(
            {
                "popularity_score": float(popularity_data.get("popularity_score", 0.5)),
                "llm_popularity_score": popularity_data.get("llm_popularity_score"),
                "domain_authority_score": popularity_data.get("domain_authority_score"),
                "quality_score": popularity_data.get("quality_score"),
            }
        )

    return update_mapping


def prepare_bulk_updates(
    feed_snapshot_list: list[dict[str, Any]],
    feed_data_list: list[dict[str, Any]],
    llm_results: list[Any],
    enrichment_service: FeedEnrichmentService,
) -> tuple[list[dict[str, Any]], int, int]:
    """Prepare bulk update mappings from enrichment results.

    Args:
        feed_snapshot_list: List of feed data snapshots
        feed_data_list: List of feed data for AI
        llm_results: List of LLM enrichment results
        enrichment_service: Service for popularity calculation

    Returns:
        Tuple of (bulk_update_mappings, enriched_count, failed_count)
    """
    bulk_update_mappings = []
    enriched_count = 0
    failed_count = 0

    for i, feed_snapshot in enumerate(feed_snapshot_list):
        try:
            llm_result = llm_results[i]
            language = feed_data_list[i]["language"]

            update_mapping = build_feed_update_mapping(
                feed_snapshot=feed_snapshot,
                language=language,
                llm_result=llm_result,
                enrichment_service=enrichment_service,
            )

            bulk_update_mappings.append(update_mapping)
            enriched_count += 1

        except Exception as e:
            logger.error(
                "Failed to prepare feed enrichment",
                feed_id=str(feed_snapshot["id"]),
                error=str(e),
                exc_info=True,
            )
            failed_count += 1

    return bulk_update_mappings, enriched_count, failed_count


async def apply_bulk_updates(db: AsyncSession, bulk_update_mappings: list[dict[str, Any]]) -> None:
    """Apply bulk updates to feeds in database.

    Args:
        db: Database session
        bulk_update_mappings: List of update mappings to apply
    """
    if not bulk_update_mappings:
        return

    try:
        await db.execute(update(Feed), bulk_update_mappings)
        logger.info("Bulk updated feed enrichment data", count=len(bulk_update_mappings))
    except Exception as e:
        logger.error("Failed to bulk update feeds", error=str(e), exc_info=True)
        raise


async def batch_enrich_feeds(db: AsyncSession) -> dict[str, Any]:
    """Batch enrich all feeds without tags/category using Gemini Batch API.

    Uses a three-phase pattern to minimize database connection hold time:
    Phase 1: Query feeds needing enrichment (<100ms)
    Phase 2: External API calls without DB connection (10-60s)
    Phase 3: Bulk database update (<1s)

    This pattern prevents holding connections during long-running external API calls.

    Note: Embeddings are now handled automatically by Meilisearch via Gemini API.

    Args:
        db: Database session

    Returns:
        Dictionary with enrichment statistics
    """
    logger.info("Starting batch feed enrichment")

    try:
        settings = get_settings()

        # Check if AI is enabled
        if not settings.ENABLE_AI:
            logger.info("AI disabled, skipping batch enrichment")
            return {"success": True, "enriched_count": 0, "message": "AI disabled"}

        # ================================================================
        # PHASE 1: Query feeds and prepare data (DB connection <100ms)
        # ================================================================

        feeds_to_enrich = await query_feeds_needing_enrichment(db)

        if not feeds_to_enrich:
            logger.info("No feeds to enrich")
            return {
                "success": True,
                "enriched_count": 0,
                "message": "No feeds need enrichment",
            }

        logger.info([x.title for x in feeds_to_enrich])

        # Initialize enrichment service
        enrichment_service = FeedEnrichmentService(db=db)

        # Prepare feed data for batch processing
        feed_data_list, feed_snapshot_list = prepare_feed_snapshots(feeds_to_enrich, enrichment_service)

        # ================================================================
        # PHASE 2: External API calls without holding DB connection (10-60s)
        # ================================================================

        # Initialize AI services (no DB dependency)
        ai_feed_enrichment = AIFeedEnrichmentService()

        # Batch LLM enrichment (10-30s external API call)
        logger.info("Starting batch LLM enrichment", batch_size=len(feed_data_list))
        llm_results = await ai_feed_enrichment.enrich_feeds_batch(feed_data_list)

        # ================================================================
        # PHASE 3: Bulk database update (connection held <1s)
        # ================================================================

        bulk_update_mappings, enriched_count, failed_count = prepare_bulk_updates(
            feed_snapshot_list=feed_snapshot_list,
            feed_data_list=feed_data_list,
            llm_results=llm_results,
            enrichment_service=enrichment_service,
        )

        # Perform database update in bulk
        await apply_bulk_updates(db, bulk_update_mappings)

        logger.info(
            "Batch feed enrichment completed",
            total_feeds=len(feed_snapshot_list),
            enriched_count=enriched_count,
            failed_count=failed_count,
        )

        return {
            "success": True,
            "total_feeds": len(feed_snapshot_list),
            "enriched_count": enriched_count,
            "failed_count": failed_count,
        }

    except Exception as e:
        logger.error("Batch feed enrichment failed", error=str(e), exc_info=True)
        return {
            "success": False,
            "error": str(e),
        }
