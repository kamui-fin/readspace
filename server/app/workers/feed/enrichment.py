"""Feed enrichment worker operations."""

from typing import Any

import structlog

from app.core.config import get_settings
from app.core.constants import MAX_FEEDS_BATCH_SIZE
from app.crud.feed.core import bulk_update_feeds_enrichment, get_feeds_needing_enrichment
from app.services.ai.batch import enrich_feeds_batch
from app.services.feeds.enrichment import prepare_bulk_updates, prepare_feed_snapshots
from app.services.feeds.meilisearch import sync_feeds_batch
from app.workers.common import worker_db

logger = structlog.get_logger(__name__)


def _build_enriched_feed_documents(
    bulk_update_mappings: list[dict[str, Any]],
    feed_snapshot_list: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """Merge DB updates with snapshots for Meilisearch indexing."""
    if not bulk_update_mappings:
        return []

    updates_by_id = {mapping["id"]: mapping for mapping in bulk_update_mappings}
    feeds_to_sync = []

    for snapshot in feed_snapshot_list:
        feed_id = snapshot["id"]
        if feed_id not in updates_by_id:
            continue

        update_data = updates_by_id[feed_id]
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
    """Batch sync enriched feeds to Meilisearch."""
    if not bulk_update_mappings:
        return

    try:
        settings = get_settings()
        feeds_to_sync = _build_enriched_feed_documents(bulk_update_mappings, feed_snapshot_list)
        if feeds_to_sync:
            await sync_feeds_batch(settings, feeds_to_sync)
            logger.info("Synced enriched feeds to Meilisearch", count=len(feeds_to_sync))
    except Exception as e:
        logger.error("Failed to sync feeds to Meilisearch", error=str(e))


async def batch_enrich_feeds() -> dict[str, Any]:
    """Orchestrate batch feed enrichment using the 3-phase surgical pattern."""
    logger.info("Starting batch feed enrichment")

    try:
        settings = get_settings()
        if not settings.ENABLE_AI:
            return {"success": True, "enriched_count": 0, "message": "AI disabled"}

        # --- PHASE 1: Quick DB Read ---
        async with worker_db() as db:
            feeds_to_enrich = await get_feeds_needing_enrichment(db, limit=MAX_FEEDS_BATCH_SIZE)

        if not feeds_to_enrich:
            return {"success": True, "enriched_count": 0, "message": "No feeds needing enrichment"}

        # Prepare Data (Pure CPU)
        feed_data_list, feed_snapshot_list = prepare_feed_snapshots(feeds_to_enrich)

        # --- PHASE 2: External API (No DB Connection) ---
        logger.info("Starting batch LLM enrichment", batch_size=len(feed_data_list))
        llm_results = await enrich_feeds_batch(feed_data_list)

        # Prepare Updates (Pure CPU)
        bulk_update_mappings, enriched_count, failed_count = prepare_bulk_updates(
            feed_snapshot_list=feed_snapshot_list,
            feed_data_list=feed_data_list,
            llm_results=llm_results,
        )

        # --- PHASE 3: Quick DB Write ---
        async with worker_db() as db:
            updated_count = await bulk_update_feeds_enrichment(db, update_mappings=bulk_update_mappings)

        # Sync Search Index (No DB)
        await sync_feeds_to_meilisearch(bulk_update_mappings, feed_snapshot_list)

        logger.info(
            "Batch enrichment completed",
            total=len(feed_snapshot_list),
            enriched=enriched_count,
            failed=failed_count,
            db_updated=updated_count,
        )

        return {
            "success": True,
            "total_feeds": len(feed_snapshot_list),
            "enriched_count": enriched_count,
            "failed_count": failed_count,
        }

    except Exception as e:
        logger.error("Batch feed enrichment failed", error=str(e), exc_info=True)
        return {"success": False, "error": str(e)}
