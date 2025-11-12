"""Feed-related Taskiq tasks."""

from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import UUID

import structlog
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
from app.services.ai.ai_service import get_ai_service
from app.services.feeds.enrichment.feed_enrichment import FeedEnrichmentService
from app.services.feeds.feed import FeedService
from app.workers.common import ensure_uuid, get_worker_db

logger = structlog.get_logger(__name__)


# ============================================================================
# ASYNC HELPER FUNCTIONS (for testing and reuse)
# ============================================================================


async def async_refresh_single_feed(feed_id: UUID, db: AsyncSession) -> None:
    """Refresh a single feed - async implementation for testing.

    Args:
        feed_id: Feed UUID
        db: Database session
    """
    logger.info("Starting feed refresh", feed_id=str(feed_id))
    feed_service = FeedService(db=db)
    await feed_service.refresh_feed(feed_id=feed_id)
    logger.info("Successfully refreshed feed", feed_id=str(feed_id))


async def async_schedule_all_feeds(db: AsyncSession, test_mode: bool = False) -> None:
    """Schedule all feeds needing refresh - async implementation for testing.

    Args:
        db: Database session
        test_mode: If True, directly calls async functions instead of dispatching tasks
    """
    logger.info("Starting schedule all feed refreshes")

    feed_service = FeedService(db=db)
    feeds_to_check = await feed_service.get_feeds_needing_refresh(limit=MAX_FEEDS_BATCH_SIZE)

    logger.info("Found feeds to refresh", feed_count=len(feeds_to_check))

    if feeds_to_check:
        feed_ids = [feed.id for feed in feeds_to_check]

        if test_mode:
            # In test mode, refresh feeds directly
            for feed_id in feed_ids:
                await async_refresh_single_feed(feed_id=feed_id, db=db)
        else:
            # In production mode, kick tasks
            for feed_id in feed_ids:
                await refresh_single_feed_task.kiq(feed_id)

        logger.info(
            "Dispatched feed refresh tasks",
            task_count=len(feed_ids),
        )


async def async_batch_enrich_feeds(db: AsyncSession) -> dict[str, Any]:
    """Batch enrich all feeds without embeddings using Gemini Batch API.

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

        # Get feeds without embeddings (not yet enriched)
        result = await db.execute(select(Feed).where(Feed.embedding.is_(None)).limit(MAX_FEEDS_BATCH_SIZE))
        feeds_to_enrich = result.scalars().all()

        if not feeds_to_enrich:
            logger.info("No feeds to enrich")
            return {"success": True, "enriched_count": 0, "message": "No feeds need enrichment"}

        logger.info("Found feeds to enrich", feed_count=len(feeds_to_enrich))

        # Initialize services
        ai_service = get_ai_service()
        enrichment_service = FeedEnrichmentService(db=db)

        # Prepare feed data for batch processing
        feed_data_list = []
        feed_objects = []

        for feed in feeds_to_enrich:
            # Detect language if not set
            language = feed.language
            if not language:
                language = enrichment_service._detect_language(feed)

            # Extract domain
            domain = enrichment_service._extract_domain_from_url(feed.link or feed.url)

            feed_data_list.append(
                {
                    "title": feed.title or "Unknown Feed",
                    "description": feed.description or "",
                    "domain": domain,
                    "language": language,
                }
            )
            feed_objects.append(feed)

        # Batch LLM enrichment
        logger.info("Starting batch LLM enrichment", batch_size=len(feed_data_list))
        llm_results = await ai_service.enrich_feeds_batch(feed_data_list)

        # Prepare texts for batch embedding
        embedding_texts = []
        for i, feed in enumerate(feed_objects):
            llm_result = llm_results[i]

            # Build composite text for embedding
            components = []

            # Always use original title
            if feed.title:
                components.append(feed.title)

            # Use enhanced description if available, otherwise original
            description = llm_result.enhanced_description if llm_result else feed.description
            if description:
                components.append(description)

            if llm_result and llm_result.tags:
                components.append(", ".join(llm_result.tags))

            domain = enrichment_service._extract_domain_from_url(feed.link or feed.url)
            if domain:
                domain_clean = domain.replace("www.", "").replace(".com", "").replace(".org", "")
                components.append(domain_clean)

            composite_text = " | ".join(components)
            if len(composite_text) > 1000:
                composite_text = composite_text[:1000] + "..."

            embedding_texts.append(composite_text)

        # Batch embedding generation (chunk into batches of 100 due to API limit)
        logger.info("Starting batch embedding generation", batch_size=len(embedding_texts))
        embeddings = []
        batch_size = 100
        for i in range(0, len(embedding_texts), batch_size):
            batch = embedding_texts[i : i + batch_size]
            logger.debug(f"Processing embedding batch {i // batch_size + 1}", batch_size=len(batch))
            batch_embeddings = await ai_service.generate_embeddings_batch(batch)
            embeddings.extend(batch_embeddings)

        # Prepare bulk updates using SQLAlchemy ORM
        enriched_count = 0
        failed_count = 0
        bulk_update_mappings = []

        for i, feed in enumerate(feed_objects):
            try:
                llm_result = llm_results[i]
                embedding = embeddings[i]

                # Build update mapping for this feed
                update_mapping = {
                    "id": feed.id,
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
                        logger.warning("Invalid category", category=llm_result.category, feed_id=feed.id)
                        update_mapping["top_level_category"] = FeedCategory.MISCELLANEOUS

                    if llm_result.enhanced_description:
                        update_mapping["description"] = llm_result.enhanced_description

                    # Calculate hybrid popularity score
                    popularity_data = enrichment_service._calculate_hybrid_popularity_score(
                        feed, {"popularity_estimate": llm_result.popularity_estimate}
                    )
                    update_mapping.update(
                        {
                            "popularity_score": float(popularity_data.get("popularity_score", 0.5)),
                            "llm_popularity_score": popularity_data.get("llm_popularity_score"),
                            "domain_authority_score": popularity_data.get("domain_authority_score"),
                            "quality_score": popularity_data.get("quality_score"),
                        }
                    )

                # Extract image if not set
                if not feed.image_url:
                    image_data = await enrichment_service._extract_image_url(feed)
                    if image_data:
                        update_mapping.update(image_data)

                # Add embedding via raw SQL (vector type requires special handling)
                if embedding:
                    await db.execute(
                        text("UPDATE feeds SET embedding = :embedding WHERE id = :feed_id"),
                        {"embedding": str(embedding), "feed_id": feed.id},
                    )

                bulk_update_mappings.append(update_mapping)
                enriched_count += 1

            except Exception as e:
                logger.error("Failed to prepare feed enrichment", feed_id=str(feed.id), error=str(e), exc_info=True)
                failed_count += 1

        # Bulk update all feeds using SQLAlchemy ORM
        if bulk_update_mappings:
            try:
                await db.execute(update(Feed), bulk_update_mappings)
                await db.commit()
                logger.info("Bulk updated feed enrichment data", count=len(bulk_update_mappings))
            except Exception as e:
                logger.error("Failed to bulk update feeds", error=str(e), exc_info=True)
                await db.rollback()
                raise

        logger.info(
            "Batch feed enrichment completed",
            total_feeds=len(feeds_to_enrich),
            enriched_count=enriched_count,
            failed_count=failed_count,
        )

        return {
            "success": True,
            "total_feeds": len(feeds_to_enrich),
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
    await db.commit()

    logger.info(
        "Unread compaction completed",
        updated_subscriptions=updated_count,
        cutoff_date=cutoff_date.isoformat(),
    )

    return {"updated_subscriptions": updated_count}


async def async_compact_old_articles(db: AsyncSession) -> dict[str, int]:
    """Compact old articles - async implementation for testing.

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

    # Set statement timeout to 15 minutes for safety
    await db.execute(text("SET statement_timeout = '60min'"))

    # Execute the deletion query using CTE for efficiency
    deletion_query = text("""
        WITH ranked_articles AS (
            SELECT
                fa.id AS article_id,
                fa.feed_id,
                ac.published_at AS published_or_created,
                ROW_NUMBER() OVER (
                    PARTITION BY fa.feed_id
                    ORDER BY ac.published_at DESC
                ) AS rn
            FROM feed_articles fa
            JOIN article_contents ac ON fa.content_id = ac.id
        ),
        eligible_articles AS (
            SELECT ra.article_id
            FROM ranked_articles ra
            LEFT JOIN user_article_states uas
                ON uas.article_id = ra.article_id
                AND (uas.is_read_later = TRUE OR uas.is_favorite = TRUE)
            WHERE ra.published_or_created < NOW() - MAKE_INTERVAL(days => :retention_days)
              AND uas.id IS NULL       -- no saved states
              AND ra.rn > :min_articles -- not in top N newest
        )
        DELETE FROM feed_articles
        WHERE id IN (SELECT article_id FROM eligible_articles)
    """)

    result = await db.execute(
        deletion_query,
        {
            "retention_days": ARTICLE_RETENTION_DAYS,
            "min_articles": MIN_ARTICLES_PER_FEED,
        },
    )
    deleted_count = result.rowcount

    # Commit the transaction
    await db.commit()

    # Reset statement timeout to default
    await db.execute(text("RESET statement_timeout"))

    logger.info(
        "Article compaction completed",
        deleted_articles=deleted_count,
        retention_days=ARTICLE_RETENTION_DAYS,
        min_articles_per_feed=MIN_ARTICLES_PER_FEED,
    )

    return {"deleted_articles": deleted_count}


# ============================================================================
# TASKIQ TASK WRAPPERS
# ============================================================================


@broker.task(
    task_name="feed_tasks.refresh_single_feed",
    retry_on_error=True,
    max_retries=2,
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
async def schedule_all_feed_refreshes_task() -> None:
    """Schedule all feeds needing refresh - Taskiq task wrapper."""
    async for session in get_worker_db():
        await async_schedule_all_feeds(db=session, test_mode=False)


@broker.task(
    task_name="feed_tasks.batch_enrich_feeds",
    schedule=[{"cron": "0 4 * * 0"}],  # Run weekly on Sunday at 4 AM UTC
    retry_on_error=True,
    max_retries=1,
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
