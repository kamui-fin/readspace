"""Feed-related Taskiq tasks."""

import time
from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import UUID

import structlog
from prometheus_client import Counter, Gauge, Histogram
from sqlalchemy import func, select, text, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.constants import (
    ARTICLE_RETENTION_DAYS,
    MAX_FEEDS_BATCH_SIZE,
    MIN_ARTICLES_PER_FEED,
    UNREAD_RETENTION_DAYS,
)
from app.core.taskiq_app import broker
from app.models import Feed, FeedCategory, FeedSubscription
from app.services.ai import EmbeddingService, FeedEnrichmentService as AIFeedEnrichmentService
from app.services.feeds.enrichment.feed_enrichment import FeedEnrichmentService
from app.services.feeds.feed import FeedService
from app.workers.common import ensure_uuid, get_worker_db, log_pool_stats

logger = structlog.get_logger(__name__)

# ============================================================================
# PROMETHEUS METRICS
# ============================================================================

# Counter: Total feeds refreshed
feeds_refreshed_total = Counter(
    "readspace_feeds_refreshed_total",
    "Total number of feeds successfully refreshed",
)

# Counter: Total feeds failed
feeds_failed_total = Counter(
    "readspace_feeds_failed_total",
    "Total number of feeds that failed to refresh",
)

# Gauge: Feeds currently being refreshed
feeds_in_progress = Gauge(
    "readspace_feeds_in_progress",
    "Number of feeds currently being refreshed",
)

# Histogram: Feed refresh duration
feed_refresh_duration = Histogram(
    "readspace_feed_refresh_duration_seconds",
    "Time taken to refresh a single feed",
    buckets=[0.1, 0.5, 1.0, 2.0, 5.0, 10.0, 30.0, 60.0],
)

# Gauge: Feeds scheduled in last cycle
feeds_scheduled_last_cycle = Gauge(
    "readspace_feeds_scheduled_last_cycle",
    "Number of feeds scheduled in the last scheduling cycle",
)

# Histogram: Batch scheduling duration
batch_scheduling_duration = Histogram(
    "readspace_batch_scheduling_duration_seconds",
    "Time taken to schedule a batch of feed refreshes",
    buckets=[0.1, 0.5, 1.0, 5.0, 10.0, 30.0],
)


# ============================================================================
# ASYNC HELPER FUNCTIONS (for testing and reuse)
# ============================================================================


async def async_refresh_single_feed(feed_id: UUID, db: AsyncSession) -> None:
    """Refresh a single feed - async implementation for testing.

    Args:
        feed_id: Feed UUID
        db: Database session
    """
    start_time = time.perf_counter()
    feeds_in_progress.inc()  # Increment gauge
    logger.info("Starting feed refresh", feed_id=str(feed_id))

    try:
        feed_service = FeedService(db=db)
        await feed_service.refresh_feed(feed_id=feed_id)

        duration = time.perf_counter() - start_time
        feed_refresh_duration.observe(duration)  # Record duration
        feeds_refreshed_total.inc()  # Increment success counter

        logger.info(
            "Successfully refreshed feed",
            feed_id=str(feed_id),
            duration_seconds=round(duration, 3),
            duration_ms=round(duration * 1000, 1),
        )
    except Exception:
        feeds_failed_total.inc()  # Increment failure counter
        raise
    finally:
        feeds_in_progress.dec()  # Decrement gauge


async def async_schedule_all_feeds(db: AsyncSession, test_mode: bool = False) -> dict[str, Any]:
    """Schedule all feeds needing refresh - async implementation for testing.

    Args:
        db: Database session
        test_mode: If True, directly calls async functions instead of dispatching tasks

    Returns:
        Dictionary with scheduling statistics
    """
    start_time = time.perf_counter()
    logger.info("Starting schedule all feed refreshes")

    feed_service = FeedService(db=db)
    feeds_to_check = await feed_service.get_feeds_needing_refresh(limit=MAX_FEEDS_BATCH_SIZE)

    logger.info("Found feeds to refresh", feed_count=len(feeds_to_check))

    dispatched_count = 0
    if feeds_to_check:
        feed_ids = [feed.id for feed in feeds_to_check]

        if test_mode:
            # In test mode, refresh feeds directly
            for feed_id in feed_ids:
                await async_refresh_single_feed(feed_id=feed_id, db=db)
                dispatched_count += 1
        else:
            # In production mode, kick tasks
            for feed_id in feed_ids:
                await refresh_single_feed_task.kiq(feed_id)
                dispatched_count += 1

        duration = time.perf_counter() - start_time
        feeds_per_second = round(dispatched_count / duration, 2) if duration > 0 else 0

        logger.info(
            "Dispatched feed refresh tasks",
            task_count=dispatched_count,
            duration_seconds=round(duration, 3),
            feeds_per_second=feeds_per_second,
        )

        return {
            "dispatched_count": dispatched_count,
            "duration_seconds": round(duration, 3),
            "feeds_per_second": feeds_per_second,
        }

    return {"dispatched_count": 0, "duration_seconds": 0, "feeds_per_second": 0}


async def async_batch_enrich_feeds(db: AsyncSession) -> dict[str, Any]:
    """Batch enrich all feeds without embeddings using Gemini Batch API.

    Uses a three-phase pattern to minimize database connection hold time:
    Phase 1: Query feeds needing enrichment (<100ms)
    Phase 2: External API calls without DB connection (10-60s)
    Phase 3: Bulk database update (<1s)

    This pattern prevents holding connections during long-running external API calls.

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

        # Get feeds without embeddings (not yet enriched)
        result = await db.execute(select(Feed).where(Feed.embedding.is_(None)).limit(MAX_FEEDS_BATCH_SIZE))
        feeds_to_enrich = result.scalars().all()

        if not feeds_to_enrich:
            logger.info("No feeds to enrich")
            return {
                "success": True,
                "enriched_count": 0,
                "message": "No feeds need enrichment",
            }

        logger.info("Found feeds to enrich", feed_count=len(feeds_to_enrich))

        # Initialize enrichment service (no DB operations yet)
        # Note: We pass db session but won't use it during API calls
        enrichment_service = FeedEnrichmentService(db=db)

        # Prepare feed data for batch processing
        # Extract all data from ORM objects while we have them
        feed_data_list = []
        feed_snapshot_list = []  # Store feed data without ORM objects

        for feed in feeds_to_enrich:
            # Detect language if not set
            language = feed.language
            if not language:
                language = enrichment_service._detect_language(feed)

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

        # Connection can be released here - no DB operations in Phase 2

        # ================================================================
        # PHASE 2: External API calls without holding DB connection (10-60s)
        # ================================================================

        # Initialize AI services (no DB dependency)
        ai_feed_enrichment = AIFeedEnrichmentService()
        embedding_service = EmbeddingService()

        # Batch LLM enrichment (10-30s external API call)
        # CRITICAL: No database connection is held during this operation
        logger.info("Starting batch LLM enrichment", batch_size=len(feed_data_list))
        llm_results = await ai_feed_enrichment.enrich_feeds_batch(feed_data_list)

        # Prepare texts for batch embedding
        embedding_texts = []
        for i, feed_snapshot in enumerate(feed_snapshot_list):
            llm_result = llm_results[i]

            # Build composite text for embedding
            components = []

            # Always use original title
            if feed_snapshot["title"]:
                components.append(feed_snapshot["title"])

            # Use enhanced description if available, otherwise original
            description = llm_result.enhanced_description if llm_result else feed_snapshot["description"]
            if description:
                components.append(description)

            if llm_result and llm_result.tags:
                components.append(", ".join(llm_result.tags))

            domain = feed_snapshot["domain"]
            if domain:
                domain_clean = domain.replace("www.", "").replace(".com", "").replace(".org", "")
                components.append(domain_clean)

            composite_text = " | ".join(components)
            if len(composite_text) > 1000:
                composite_text = composite_text[:1000] + "..."

            embedding_texts.append(composite_text)

        # Batch embedding generation (5-30s external API call)
        # CRITICAL: Still no database connection held
        logger.info("Starting batch embedding generation", batch_size=len(embedding_texts))
        embeddings = []
        batch_size = 100
        for i in range(0, len(embedding_texts), batch_size):
            batch = embedding_texts[i : i + batch_size]
            logger.debug(
                f"Processing embedding batch {i // batch_size + 1}",
                batch_size=len(batch),
            )
            batch_embeddings = await embedding_service.generate_embeddings_batch(batch)
            embeddings.extend(batch_embeddings)

        # ================================================================
        # PHASE 3: Bulk database update (connection held <1s)
        # ================================================================

        # Prepare bulk updates using SQLAlchemy ORM
        enriched_count = 0
        failed_count = 0
        bulk_update_mappings = []
        embedding_updates = []  # Separate list for vector updates

        for i, feed_snapshot in enumerate(feed_snapshot_list):
            try:
                llm_result = llm_results[i]
                embedding = embeddings[i]

                # Build update mapping for this feed
                update_mapping = {
                    "id": feed_snapshot["id"],
                    "updated_at": datetime.now(timezone.utc),
                }

                # Add language
                if feed_data_list[i]["language"]:
                    update_mapping["language"] = feed_data_list[i]["language"]

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
                    # Create a minimal feed-like object for score calculation
                    class FeedProxy:
                        def __init__(self, snapshot):
                            self.id = snapshot["id"]
                            self.link = snapshot["link"]
                            self.url = snapshot["url"]

                    popularity_data = enrichment_service._calculate_hybrid_popularity_score(
                        FeedProxy(feed_snapshot),
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

                # Note: Image extraction requires HTTP fetch, skip for now
                # Image URLs can be enriched separately or during feed refresh

                # Store embedding update separately (vector type requires raw SQL)
                if embedding:
                    embedding_updates.append(
                        {
                            "embedding": str(embedding),
                            "feed_id": feed_snapshot["id"],
                        }
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

        # Perform all database updates in bulk (two queries total)
        if bulk_update_mappings:
            try:
                # Update 1: Bulk update feed metadata
                await db.execute(update(Feed), bulk_update_mappings)
                logger.info("Bulk updated feed enrichment data", count=len(bulk_update_mappings))

                # Update 2: Bulk update embeddings via raw SQL
                if embedding_updates:
                    for emb_update in embedding_updates:
                        await db.execute(
                            text("UPDATE feeds SET embedding = :embedding WHERE id = :feed_id"),
                            emb_update,
                        )
                    logger.info("Bulk updated feed embeddings", count=len(embedding_updates))

            except Exception as e:
                logger.error("Failed to bulk update feeds", error=str(e), exc_info=True)
                raise

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


async def async_compact_unread_articles(db: AsyncSession) -> dict[str, int]:
    """Compact unread articles - async implementation for testing.

    Args:
        db: Database session

    Returns:
        Dictionary with updated_subscriptions count
    """
    logger.info("Starting unread compaction", retention_days=UNREAD_RETENTION_DAYS)

    cutoff_date = datetime.now(timezone.utc) - timedelta(days=UNREAD_RETENTION_DAYS)

    stmt = (
        update(FeedSubscription)
        .values(
            last_read_cutoff=func.greatest(
                func.coalesce(FeedSubscription.last_read_cutoff, cutoff_date),
                cutoff_date,
            )
        )
        .execution_options(synchronize_session=False)
    )

    result = await db.execute(stmt)
    updated_count = result.rowcount

    logger.info(
        "Unread compaction completed",
        updated_subscriptions=updated_count,
        cutoff_date=cutoff_date.isoformat(),
    )

    return {"updated_subscriptions": updated_count}


async def async_compact_old_articles(db: AsyncSession) -> dict[str, int]:
    """Compact old articles - async implementation for testing.

    IMPORTANT: This deletes article_contents (which cascade deletes feed_articles),
    not feed_articles directly. Deleting feed_articles would leave orphaned content.

    Args:
        db: Database session

    Returns:
        Dictionary with deleted_articles count
    """
    logger.info(
        "Starting article compaction",
        retention_days=ARTICLE_RETENTION_DAYS,
        min_articles_per_feed=MIN_ARTICLES_PER_FEED,
    )

    # Set timeout first (must be separate statement for asyncpg)
    await db.execute(text("SET LOCAL statement_timeout = '120min'"))

    # Execute the deletion query
    deletion_query = text(
        """
        WITH ranked_articles AS (
            SELECT
                ac.id AS content_id,
                fa.feed_id,
                ac.published_at AS published_or_created,
                ROW_NUMBER() OVER (
                    PARTITION BY fa.feed_id
                    ORDER BY ac.published_at DESC
                ) AS rn
            FROM feed_articles fa
            JOIN article_contents ac ON fa.content_id = ac.id
        ),
        eligible_contents AS (
            SELECT ra.content_id
            FROM ranked_articles ra
            LEFT JOIN user_article_states uas
                ON uas.article_id = (
                    SELECT fa2.id FROM feed_articles fa2 WHERE fa2.content_id = ra.content_id LIMIT 1
                )
                AND (uas.is_read_later = TRUE OR uas.is_favorite = TRUE)
            LEFT JOIN clipped_articles ca
                ON ca.content_id = ra.content_id
            WHERE ra.published_or_created < NOW() - MAKE_INTERVAL(days => :retention_days)
              AND uas.id IS NULL       -- no saved states
              AND ca.id IS NULL        -- not clipped
              AND ra.rn > :min_articles -- not in top N newest
        )
        DELETE FROM article_contents
        WHERE id IN (SELECT content_id FROM eligible_contents)
    """
    )

    result = await db.execute(
        deletion_query,
        {
            "retention_days": ARTICLE_RETENTION_DAYS,
            "min_articles": MIN_ARTICLES_PER_FEED,
        },
    )
    deleted_count = result.rowcount

    logger.info(
        "Article compaction completed",
        deleted_contents=deleted_count,
        retention_days=ARTICLE_RETENTION_DAYS,
        min_articles_per_feed=MIN_ARTICLES_PER_FEED,
    )

    return {"deleted_articles": deleted_count}


# ============================================================================
# TASKIQ TASK WRAPPERS
# ============================================================================


@broker.task(
    task_name="feed_tasks.refresh_single_feed",
    # Retry handled by SmartRetryMiddleware with exponential backoff
    # Retries: 3 attempts with delays ~30s, ~1min, ~2min (with jitter)
)
async def refresh_single_feed_task(feed_id: UUID | str) -> None:
    """Refresh a single feed - Taskiq task wrapper.

    Args:
        feed_id: Feed UUID (may be string from serialization)
    """
    feed_id = ensure_uuid(feed_id)

    async for session in get_worker_db():
        await async_refresh_single_feed(feed_id=feed_id, db=session)


@broker.task(
    task_name="feed_tasks.schedule_all_feed_refreshes",
    schedule=[{"cron": "*/30 * * * *"}],  # Every 30 minutes
)
async def schedule_all_feed_refreshes_task() -> dict[str, Any]:
    """Schedule all feeds needing refresh - Taskiq task wrapper.

    Returns:
        Dictionary with scheduling statistics
    """
    start_time = time.perf_counter()
    async for session in get_worker_db():
        result = await async_schedule_all_feeds(db=session)

    total_duration = time.perf_counter() - start_time
    batch_scheduling_duration.observe(total_duration)  # Record batch duration
    feeds_scheduled_last_cycle.set(result.get("dispatched_count", 0))  # Update gauge

    logger.info(
        "Feed refresh scheduling cycle completed",
        total_duration_seconds=round(total_duration, 3),
        **result,
    )
    return result


@broker.task(
    task_name="feed_tasks.batch_enrich_feeds",
    schedule=[{"cron": "0 4 * * 0"}],  # Run weekly on Sunday at 4 AM UTC
    # Retry handled by SmartRetryMiddleware with exponential backoff
)
async def batch_enrich_feeds_task() -> dict[str, Any]:
    """Batch enrich all feeds without embeddings - Taskiq task wrapper.

    Returns:
        Dictionary with enrichment statistics
    """
    async for session in get_worker_db():
        return await async_batch_enrich_feeds(db=session)


@broker.task(
    task_name="feed_tasks.compact_unread_articles",
    schedule=[{"cron": "0 2 * * *"}],  # Run daily at 2 AM UTC
)
async def compact_unread_articles_task() -> dict[str, int]:
    """Compact unread articles - Taskiq task wrapper.

    Returns:
        Dictionary with updated_subscriptions count
    """
    async for session in get_worker_db():
        return await async_compact_unread_articles(db=session)


@broker.task(
    task_name="feed_tasks.compact_old_articles",
    schedule=[{"cron": "0 3 * * 0"}],  # Run weekly on Sunday at 3 AM UTC
)
async def compact_old_articles_task() -> dict[str, int]:
    """Compact old articles - Taskiq task wrapper.

    Returns:
        Dictionary with deleted_articles count
    """
    async for session in get_worker_db():
        return await async_compact_old_articles(db=session)


@broker.task(
    task_name="feed_tasks.log_connection_pool_stats",
    schedule=[{"cron": "*/5 * * * *"}],  # Run every 5 minutes
)
async def log_connection_pool_stats_task() -> dict[str, int]:
    """Log database connection pool statistics - Taskiq task wrapper.

    Monitors connection pool health for debugging and capacity planning.
    Logs warnings when utilization exceeds 80%, critical when >95%.

    Returns:
        Dictionary with pool statistics
    """
    return await log_pool_stats()
