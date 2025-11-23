"""Feed enrichment worker operations."""

from datetime import datetime, timezone
from typing import Any

import structlog
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.constants import MAX_FEEDS_BATCH_SIZE
from app.models import Feed, FeedCategory
from app.services.ai import FeedEnrichmentService as AIFeedEnrichmentService
from app.services.feeds.enrichment.helpers import FeedEnrichmentService
from app.services.feeds.search.meilisearch import get_meilisearch_service

logger = structlog.get_logger(__name__)


class FeedProxy:
    """Lightweight feed proxy for enrichment and indexing operations.

    Used to pass feed data without ORM objects for:
    - Popularity score calculation
    - Meilisearch indexing
    """

    def __init__(self, data: dict[str, Any]):
        self.id = data["id"]
        self.url = data["url"]
        self.title = data.get("title")
        self.description = data.get("description")
        self.link = data.get("link")
        self.language = data.get("language")
        self.image_url = data.get("image_url")
        self.tags = data.get("tags")
        self.top_level_category = data.get("top_level_category")
        self.popularity_score = data.get("popularity_score")


async def query_feeds_needing_enrichment(db: AsyncSession) -> list[Feed]:
    """Query feeds that need enrichment (no tags set).
    
    Pure DB helper - caller manages session.

    Args:
        db: Database session

    Returns:
        List of Feed ORM objects needing enrichment
    """
    result = await db.execute(
        select(Feed).where(Feed.tags.is_(None)).limit(MAX_FEEDS_BATCH_SIZE)
    )
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
        feed_proxy = FeedProxy(feed_snapshot)
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

            # Skip feeds where enrichment failed (None results)
            if llm_result is None:
                logger.warning(
                    "Skipping feed with failed enrichment",
                    feed_id=str(feed_snapshot["id"]),
                    feed_title=feed_snapshot.get("title"),
                )
                failed_count += 1
                continue

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


async def apply_bulk_updates(
    db: AsyncSession, bulk_update_mappings: list[dict[str, Any]]
) -> None:
    """Apply bulk updates to feeds in database.
    
    Pure DB helper - caller manages session.

    Args:
        db: Database session
        bulk_update_mappings: List of update mappings to apply
    """
    if not bulk_update_mappings:
        return

    try:
        await db.execute(update(Feed), bulk_update_mappings)
        logger.info(
            "Bulk updated feed enrichment data", count=len(bulk_update_mappings)
        )
    except Exception as e:
        logger.error("Failed to bulk update feeds", error=str(e), exc_info=True)
        raise


async def sync_feeds_to_meilisearch(
    bulk_update_mappings: list[dict[str, Any]], feed_snapshot_list: list[dict[str, Any]]
) -> None:
    """Sync enriched feeds to Meilisearch index.

    Args:
        bulk_update_mappings: List of database update mappings
        feed_snapshot_list: Original feed snapshots before enrichment
    """
    if not bulk_update_mappings:
        return

    try:
        settings = get_settings()
        meilisearch_service = get_meilisearch_service(settings)

        # Create a mapping of feed_id -> update_mapping for quick lookup
        updates_by_id = {mapping["id"]: mapping for mapping in bulk_update_mappings}

        # Build Feed-like objects with enriched data for Meilisearch
        feeds_to_sync = []
        for snapshot in feed_snapshot_list:
            feed_id = snapshot["id"]
            if feed_id not in updates_by_id:
                continue  # This feed failed enrichment, skip

            # Merge snapshot with updates to create complete feed data
            update_data = updates_by_id[feed_id]

            # Merge enriched data with original snapshot
            enriched_data = {
                **snapshot,
                "tags": update_data.get("tags", snapshot.get("tags")),
                "top_level_category": update_data.get("top_level_category"),
                "description": update_data.get(
                    "description", snapshot.get("description")
                ),
                "language": update_data.get("language", snapshot.get("language")),
                "popularity_score": update_data.get("popularity_score", 0.5),
            }

            feeds_to_sync.append(FeedProxy(enriched_data))

        # Batch update in Meilisearch
        if feeds_to_sync:
            await meilisearch_service.add_feeds_batch(feeds_to_sync)
            logger.info(
                "Synced enriched feeds to Meilisearch", count=len(feeds_to_sync)
            )

    except Exception as e:
        # Log but don't raise - Meilisearch sync failures shouldn't break enrichment
        logger.error("Failed to sync feeds to Meilisearch", error=str(e), exc_info=True)


async def batch_enrich_feeds() -> dict[str, Any]:
    """Batch enrich all feeds without tags/category using Gemini Batch API.

    Uses a three-phase pattern - service manages its own sessions:
    Phase 1: Query feeds needing enrichment (with session)
    Phase 2: External API calls (NO session)
    Phase 3: Bulk database update (with session)

    This pattern prevents holding connections during long-running external API calls.

    Note: Embeddings are now handled automatically by Meilisearch via Gemini API.

    Returns:
        Dictionary with enrichment statistics
    """
    from app.workers.common import worker_db

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
        async with worker_db() as db:
            feeds_to_enrich = await query_feeds_needing_enrichment(db)

            if not feeds_to_enrich:
                logger.info("No feeds to enrich")
                return {
                    "success": True,
                    "enriched_count": 0,
                    "message": "No feeds need enrichment",
                }

            # Initialize enrichment service (no DB needed - just helper methods)
            enrichment_service = FeedEnrichmentService()

        # Prepare feed data for batch processing
        feed_data_list, feed_snapshot_list = prepare_feed_snapshots(
            feeds_to_enrich, enrichment_service
        )

        # ================================================================
        # PHASE 2: External API calls without holding DB connection (10-60s)
        # ================================================================

        # Initialize AI services (no DB dependency)
        ai_feed_enrichment = AIFeedEnrichmentService()

        # Batch LLM enrichment (10-30s external API call)
        logger.info("Starting batch LLM enrichment", batch_size=len(feed_data_list))
        llm_results = await ai_feed_enrichment.enrich_feeds_batch(feed_data_list)

        # ================================================================
        # PHASE 3: Bulk database update and Meilisearch sync (connection held <1s)
        # ================================================================

        bulk_update_mappings, enriched_count, failed_count = prepare_bulk_updates(
            feed_snapshot_list=feed_snapshot_list,
            feed_data_list=feed_data_list,
            llm_results=llm_results,
            enrichment_service=enrichment_service,
        )

        # Perform database update in bulk
        async with worker_db() as db:
            await apply_bulk_updates(db, bulk_update_mappings)

        # Sync enriched feeds to Meilisearch (no DB connection needed)
        await sync_feeds_to_meilisearch(bulk_update_mappings, feed_snapshot_list)

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
