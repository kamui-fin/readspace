"""Feed enrichment worker operations.

Thin orchestration layer that coordinates:
1. Database queries (CRUD)
2. Business logic (enrichment service)
3. External APIs (AI batch service)
4. Search indexing (Meilisearch)

Follows the "Surgical Session" pattern: DB → I/O → DB
"""

from typing import Any

import structlog

from app.core.config import get_settings
from app.core.constants import MAX_FEEDS_BATCH_SIZE
from app.crud.feed.core import bulk_update_feeds_enrichment, get_feeds_needing_enrichment
from app.services.ai.batch import enrich_feeds_batch
from app.services.feeds.enrichment import (
    prepare_bulk_updates,
    prepare_feed_snapshots,
)
from app.services.feeds.meilisearch import sync_feeds_batch

logger = structlog.get_logger(__name__)


def _build_enriched_feed_documents(
    bulk_update_mappings: list[dict[str, Any]],
    feed_snapshot_list: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """Build enriched feed documents for Meilisearch indexing.

    Pure function - no side effects, just data transformation.
    Follows REFACTOR.md: isolate pure business logic.

    Args:
        bulk_update_mappings: List of database update mappings
        feed_snapshot_list: Original feed snapshots before enrichment

    Returns:
        List of enriched feed documents ready for Meilisearch
    """
    if not bulk_update_mappings:
        return []

    # Create a mapping of feed_id -> update_mapping for quick lookup
    updates_by_id = {mapping["id"]: mapping for mapping in bulk_update_mappings}

    # Build feed documents with enriched data for Meilisearch
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
            "description": update_data.get("description", snapshot.get("description")),
            "language": update_data.get("language", snapshot.get("language")),
            "popularity_score": update_data.get("popularity_score", 0.5),
        }

        feeds_to_sync.append(enriched_data)

    return feeds_to_sync


async def sync_feeds_to_meilisearch(
    bulk_update_mappings: list[dict[str, Any]],
    feed_snapshot_list: list[dict[str, Any]],
) -> None:
    """Sync enriched feeds to Meilisearch index.

    Uses batch operation per REFACTOR.md principles.
    Logs but doesn't raise - Meilisearch sync failures shouldn't break enrichment.

    Args:
        bulk_update_mappings: List of database update mappings
        feed_snapshot_list: Original feed snapshots before enrichment
    """
    if not bulk_update_mappings:
        return

    try:
        settings = get_settings()

        # Build enriched documents (pure function)
        feeds_to_sync = _build_enriched_feed_documents(bulk_update_mappings, feed_snapshot_list)

        # Batch sync to Meilisearch
        if feeds_to_sync:
            await sync_feeds_batch(settings, feeds_to_sync)
            logger.info("Synced enriched feeds to Meilisearch", count=len(feeds_to_sync))

    except Exception as e:
        # Log but don't raise - Meilisearch sync failures shouldn't break enrichment
        logger.error("Failed to sync feeds to Meilisearch", error=str(e), exc_info=True)


async def batch_enrich_feeds() -> dict[str, Any]:
    """Batch enrich all feeds without tags/category using Gemini Batch API.

    Uses a three-phase pattern following the "Surgical Session" principle:
    Phase 1: Query feeds and prepare data (DB connection <100ms)
    Phase 2: External API calls (NO session held)
    Phase 3: Bulk database update and Meilisearch sync (connection held <1s)

    This pattern prevents holding connections during long-running external API calls.

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
            feeds_to_enrich = await get_feeds_needing_enrichment(db, limit=MAX_FEEDS_BATCH_SIZE)

            if not feeds_to_enrich:
                logger.info("No feeds to enrich")
                return {
                    "success": True,
                    "enriched_count": 0,
                    "message": "No feeds need enrichment",
                }

            logger.info("Found feeds to enrich", feed_count=len(feeds_to_enrich))

        # Prepare feed data for batch processing (pure function, no DB)
        feed_data_list, feed_snapshot_list = prepare_feed_snapshots(feeds_to_enrich)

        # ================================================================
        # PHASE 2: External API calls without holding DB connection (10-60s)
        # ================================================================
        logger.info("Starting batch LLM enrichment", batch_size=len(feed_data_list))
        llm_results = await enrich_feeds_batch(feed_data_list)

        # ================================================================
        # PHASE 3: Bulk database update and Meilisearch sync (connection held <1s)
        # ================================================================
        # Prepare bulk updates (pure function, no DB)
        bulk_update_mappings, enriched_count, failed_count = prepare_bulk_updates(
            feed_snapshot_list=feed_snapshot_list,
            feed_data_list=feed_data_list,
            llm_results=llm_results,
        )

        # Perform database update in bulk
        async with worker_db() as db:
            updated_count = await bulk_update_feeds_enrichment(db, update_mappings=bulk_update_mappings)
            logger.info("Bulk updated feed enrichment data", count=updated_count)

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
