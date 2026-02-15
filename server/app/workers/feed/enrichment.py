"""Feed enrichment worker operations."""

import asyncio
from typing import Any

import structlog

from app.core.config import get_settings
from app.core.constants import MAX_FEEDS_BATCH_SIZE
from app.crud.article.reader import fetch_recent_article_texts_for_feeds
from app.crud.feed.core import (
    bulk_update_feeds_enrichment,
    get_feeds_needing_enrichment,
)
from app.services.ai.batch import enrich_feeds_batch
from app.services.feeds.domain_authority import get_domain_authority_scores_batch
from app.services.feeds.enrichment import prepare_bulk_updates, prepare_feed_snapshots

from app.services.feeds.meilisearch import sync_feeds_batch
from app.workers.common import worker_db

logger = structlog.get_logger(__name__)

# Configuration
CHUNK_SIZE = 500


def _build_enriched_feed_documents(
    bulk_update_mappings: list[dict[str, Any]],
    feed_snapshot_list: list[Any],
) -> list[dict[str, Any]]:
    """Merge DB updates with snapshots for Meilisearch indexing."""
    if not bulk_update_mappings:
        return []

    updates_by_id = {mapping["id"]: mapping for mapping in bulk_update_mappings}
    feeds_to_sync = []

    for snapshot in feed_snapshot_list:
        feed_id = snapshot.id
        if feed_id not in updates_by_id:
            continue

        update_data = updates_by_id[feed_id]
        enriched_data = {
            "id": str(snapshot.id),
            "url": str(snapshot.url),
            "title": snapshot.title,
            "link": snapshot.link,
            "image_url": snapshot.image_url,
            "tags": update_data.get("tags", []),
            "tags_native": update_data.get("tags_native", []),
            "top_level_category": update_data.get("top_level_category"),
            "content_type": update_data.get("content_type"),
            "author": update_data.get("author", snapshot.author),
            "description": update_data.get("description", snapshot.description),
            "language": update_data.get("language", snapshot.language),
            "popularity_score": update_data.get("popularity_score", 0.5),
        }
        feeds_to_sync.append(enriched_data)

    return feeds_to_sync


async def _sync_feeds_to_meilisearch(
    bulk_update_mappings: list[dict[str, Any]],
    feed_snapshot_list: list[Any],
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


async def _process_enrichment_chunk(chunk_feeds: list[Any]) -> tuple[int, int]:
    """Process a single chunk of feeds for enrichment.

    Returns:
        Tuple of (enriched_count, failed_count)
    """
    # 1. Fetch Recent Article Texts (Quick DB Read)
    async with worker_db() as db:
        feed_ids = [feed.id for feed in chunk_feeds]
        article_texts_by_feed = await fetch_recent_article_texts_for_feeds(db, feed_ids, limit=5)

    # 2. Prepare Data (Pure CPU)
    feed_data_list, feed_snapshot_list = prepare_feed_snapshots(
        chunk_feeds,
        article_texts_by_feed=article_texts_by_feed,
    )

    # 3. External API / Enrichment (IO + CPU)

    logger.info("Starting batch LLM enrichment", batch_size=len(feed_data_list))
    llm_results = await enrich_feeds_batch(feed_data_list)

    # 4. Prepare Updates
    bulk_update_mappings, enriched, failed = prepare_bulk_updates(
        feed_snapshot_list=feed_snapshot_list,
        feed_data_list=feed_data_list,
        llm_results=llm_results,
    )

    # 5. Persist Updates (Quick DB Write)
    async with worker_db() as db:
        await bulk_update_feeds_enrichment(db, update_mappings=bulk_update_mappings)

    # 6. Sync Search Index (No DB)
    await _sync_feeds_to_meilisearch(bulk_update_mappings, feed_snapshot_list)

    return enriched, failed


async def batch_enrich_feeds() -> dict[str, Any]:
    """Orchestrate batch feed enrichment using the 3-phase surgical pattern."""
    logger.info("Starting batch feed enrichment")

    try:
        settings = get_settings()
        if not settings.ENABLE_AI:
            return {"success": True, "enriched_count": 0, "message": "AI disabled"}

        # --- PHASE 1: Initial Fetch ---
        async with worker_db() as db:
            feeds_to_enrich = await get_feeds_needing_enrichment(db, limit=MAX_FEEDS_BATCH_SIZE)

        if not feeds_to_enrich:
            return {
                "success": True,
                "enriched_count": 0,
                "message": "No feeds needing enrichment",
            }

        # --- PHASE 2: Process Chunks ---
        total_enriched = 0
        total_failed = 0

        for i in range(0, len(feeds_to_enrich), CHUNK_SIZE):
            chunk_feeds = feeds_to_enrich[i : i + CHUNK_SIZE]
            logger.info(
                "Processing enrichment chunk",
                chunk_index=i // CHUNK_SIZE + 1,
                total_chunks=(len(feeds_to_enrich) + CHUNK_SIZE - 1) // CHUNK_SIZE,
                chunk_size=len(chunk_feeds),
            )

            enriched, failed = await _process_enrichment_chunk(chunk_feeds)
            total_enriched += enriched
            total_failed += failed

        logger.info(
            "Batch enrichment completed",
            total=len(feeds_to_enrich),
            enriched=total_enriched,
            failed=total_failed,
        )

        return {
            "success": True,
            "total_feeds": len(feeds_to_enrich),
            "enriched_count": total_enriched,
            "failed_count": total_failed,
        }

    except Exception as e:
        logger.error("Batch feed enrichment failed", error=str(e), exc_info=True)
        return {"success": False, "error": str(e)}
