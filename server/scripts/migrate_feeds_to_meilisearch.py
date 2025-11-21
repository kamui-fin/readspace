#!/usr/bin/env python3
"""
Migration script to sync all feeds from PostgreSQL to Meilisearch.

This script:
1. Configures the Meilisearch index (embedders, ranking rules, filters)
2. Fetches all feeds from PostgreSQL
3. Indexes them in Meilisearch in batches

Usage:
    poetry run python scripts/migrate_feeds_to_meilisearch.py [--dry-run] [--batch-size 1000]
"""

import argparse
import logging
import sys
import time
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent.parent))

import structlog
from meilisearch.errors import MeilisearchApiError
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.models.feed import Feed
from app.services.feeds.search.meilisearch import MeilisearchService

logger = structlog.get_logger(__name__)


def configure_meilisearch_index(meili_service: MeilisearchService) -> None:
    """
    Configure Meilisearch index with all necessary settings.

    This is the ONLY place where index configuration should happen.
    The runtime service only performs CRUD operations.

    Args:
        meili_service: Meilisearch service instance
    """
    client = meili_service.client
    index_name = meili_service.index_name
    settings = meili_service.settings

    logger.info("configuring_meilisearch_index", index=index_name)

    # Create or get existing index
    try:
        index = client.get_index(index_name)
        logger.info("meilisearch_index_found", index=index_name)
    except MeilisearchApiError as e:
        if "index_not_found" in str(e):
            task = client.create_index(index_name, {"primaryKey": "id"})
            client.wait_for_task(task.task_uid)
            index = client.get_index(index_name)
            logger.info("meilisearch_index_created", index=index_name)
        else:
            raise

    # Configure index settings - only done during migration
    settings_config = {
        # Fields that can be searched with full-text search
        "searchableAttributes": [
            "title",
            "description",
            "tags",
            "url",
            "link",
        ],
        # Fields that can be used in filter expressions
        "filterableAttributes": [
            "language",
            "top_level_category",
        ],
        # Fields that can be used for sorting
        "sortableAttributes": [
            "popularity_score",
        ],
        # Fields to return in search results
        "displayedAttributes": [
            "id",
            "url",
            "title",
            "description",
            "link",
            "language",
            "image_url",
            "tags",
            "top_level_category",
            "popularity_score",
        ],
        # Ranking rules - order matters!
        "rankingRules": [
            "words",  # Number of matched query terms
            "typo",  # Fewer typos = better rank
            "proximity",  # Proximity of query terms
            "attribute",  # Match in important attributes (title > desc)
            "sort",  # Custom sort criterion
            "exactness",  # Exact matches ranked higher
            "popularity_score:desc",  # Custom: Popular feeds ranked higher
        ],
        # Enable typo tolerance for better search UX
        "typoTolerance": {
            "enabled": True,
            "minWordSizeForTypos": {
                "oneTypo": 4,
                "twoTypos": 8,
            },
        },
        # Pagination settings
        "pagination": {
            "maxTotalHits": 500,  # Limit total retrievable results
        },
        # Configure embedders for AI-powered search
        # Use Gemini REST API for automatic embedding generation with batch support
        "embedders": {
            "default": {
                "source": "rest",
                "url": "https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:batchEmbedContents",
                "dimensions": 768,
                "documentTemplate": "{{doc.title}} {{doc.description}}",
                "request": {
                    "requests": [
                        {
                            "model": "models/gemini-embedding-001",
                            "content": {"parts": [{"text": "{{text}}"}]},
                            "outputDimensionality": 768,
                        },
                        "{{..}}",
                    ],
                },
                "response": {"embeddings": [{"values": "{{embedding}}"}, "{{..}}"]},
                "headers": {"x-goog-api-key": settings.GEMINI_API_KEY},
            }
        },
    }

    # Apply settings and wait for completion
    task = index.update_settings(settings_config)
    client.wait_for_task(task.task_uid)
    logger.info("meilisearch_index_configured", index=index_name)


def migrate_feeds(dry_run: bool = False, batch_size: int = 5) -> None:
    """
    Migrate all feeds from PostgreSQL to Meilisearch.

    Args:
        dry_run: If True, only count feeds without actually indexing
        batch_size: Number of feeds to process in each batch
    """
    # Load settings
    settings = Settings()

    # Use synchronous connection string by converting async URL
    db_url = settings.SUPABASE_DB_CONNECTION.replace("postgresql+asyncpg://", "postgresql://")

    # Initialize Meilisearch service
    meili_service = MeilisearchService(settings)

    logger.info("migration_started", dry_run=dry_run, batch_size=batch_size)

    # Check Meilisearch health
    is_healthy = meili_service.health_check()
    if not is_healthy:
        logger.error("meilisearch_unhealthy")
        raise RuntimeError("Meilisearch is not healthy. Please check the service.")

    # Configure index (only done during migration)
    configure_meilisearch_index(meili_service)

    # Create database session (synchronous)
    engine = create_engine(
        db_url,
        echo=False,
        pool_size=10,
        max_overflow=20,
    )

    total_feeds = 0
    total_indexed = 0

    try:
        with Session(engine) as session:
            # Count total feeds
            count_query = select(Feed)
            result = session.execute(count_query)
            all_feeds = result.scalars().all()
            total_feeds = len(all_feeds)

            logger.info("feeds_counted", total=total_feeds)

            if dry_run:
                logger.info("dry_run_complete", total_feeds=total_feeds)
                return

            # Clear existing documents if doing full migration
            logger.info("clearing_existing_documents")
            index = meili_service.client.get_index(meili_service.index_name)
            task = index.delete_all_documents()
            meili_service.client.wait_for_task(task.task_uid)
            logger.info("existing_documents_cleared")

            # Process feeds in batches
            for i in range(0, total_feeds, batch_size):
                batch = all_feeds[i : i + batch_size]
                batch_num = (i // batch_size) + 1
                total_batches = (total_feeds + batch_size - 1) // batch_size

                logger.info(
                    "processing_batch",
                    batch_num=batch_num,
                    total_batches=total_batches,
                    batch_size=len(batch),
                    progress=f"{i + len(batch)}/{total_feeds}",
                )

                # Add batch to Meilisearch
                meili_service.add_feeds_batch(batch)
                total_indexed += len(batch)

                # Wait a bit between batches to avoid overwhelming Meilisearch
                if i + batch_size < total_feeds:
                    time.sleep(0.5)

        # Get final stats
        index = meili_service.client.get_index(meili_service.index_name)
        stats = index.get_stats()
        logger.info(
            "migration_completed",
            total_feeds=total_feeds,
            total_indexed=total_indexed,
            meilisearch_docs=stats.number_of_documents,
            is_indexing=stats.is_indexing,
        )

        # Verify counts match
        meili_count = stats.number_of_documents
        if meili_count != total_feeds:
            logger.warning(
                "document_count_mismatch",
                postgres_count=total_feeds,
                meilisearch_count=meili_count,
                difference=total_feeds - meili_count,
            )
        else:
            logger.info("migration_verified", count=total_feeds)

    except Exception as e:
        logger.error("migration_failed", error=str(e), exc_info=True)
        raise
    finally:
        engine.dispose()


def main():
    """Main entry point for the migration script."""
    parser = argparse.ArgumentParser(
        description="Migrate feeds from PostgreSQL to Meilisearch",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Dry run to count feeds
  poetry run python scripts/migrate_feeds_to_meilisearch.py --dry-run

  # Migrate with default batch size (1000)
  poetry run python scripts/migrate_feeds_to_meilisearch.py

  # Migrate with custom batch size
  poetry run python scripts/migrate_feeds_to_meilisearch.py --batch-size 500
        """,
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Count feeds without actually indexing them",
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=1000,
        help="Number of feeds to process in each batch (default: 1000)",
    )

    args = parser.parse_args()

    # Configure logging
    structlog.configure(
        processors=[
            structlog.stdlib.add_log_level,
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.dev.ConsoleRenderer(),
        ],
        wrapper_class=structlog.make_filtering_bound_logger(logging.INFO),
        context_class=dict,
        logger_factory=structlog.PrintLoggerFactory(),
        cache_logger_on_first_use=False,
    )

    # Run migration
    try:
        migrate_feeds(dry_run=args.dry_run, batch_size=args.batch_size)
    except KeyboardInterrupt:
        logger.info("migration_interrupted")
        sys.exit(1)
    except Exception as e:
        logger.error("migration_error", error=str(e))
        sys.exit(1)


if __name__ == "__main__":
    main()
