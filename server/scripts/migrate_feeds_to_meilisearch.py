#!/usr/bin/env python3
"""
Migration script to sync all feeds from PostgreSQL to Meilisearch.

This script fetches all feeds from the PostgreSQL database and indexes them
in Meilisearch in batches for efficient processing.

Usage:
    poetry run python scripts/migrate_feeds_to_meilisearch.py [--dry-run] [--batch-size 1000]
"""

import argparse
import sys
import time
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent.parent))

import structlog
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.models.feed import Feed
from app.services.feeds.search.meilisearch_service import MeilisearchService

logger = structlog.get_logger(__name__)


def migrate_feeds(dry_run: bool = False, batch_size: int = 5) -> None:
    """
    Migrate all feeds from PostgreSQL to Meilisearch.

    Args:
        dry_run: If True, only count feeds without actually indexing
        batch_size: Number of feeds to process in each batch
    """
    # Load settings
    settings = Settings()

    # Use synchronous connection string
    db_url = (
        settings.SUPABASE_DB_CONNECTION_SYNC
        or settings.SUPABASE_DB_CONNECTION.replace(
            "postgresql+asyncpg://", "postgresql://"
        )
    )

    # Initialize Meilisearch service
    meili_service = MeilisearchService(settings)

    logger.info("migration_started", dry_run=dry_run, batch_size=batch_size)

    # Initialize Meilisearch index (sync wrapper)
    import asyncio

    asyncio.run(meili_service.initialize_index())

    # Check Meilisearch health
    is_healthy = meili_service.client.health().get("status") == "available"
    if not is_healthy:
        logger.error("meilisearch_unhealthy")
        raise RuntimeError("Meilisearch is not healthy. Please check the service.")

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
            asyncio.run(meili_service.delete_all_feeds())

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

                # Index batch
                asyncio.run(meili_service.index_feeds_batch(batch))
                total_indexed += len(batch)

                # Wait a bit between batches to avoid overwhelming Meilisearch
                if i + batch_size < total_feeds:
                    time.sleep(0.5)

        # Get final stats
        stats = asyncio.run(meili_service.get_index_stats())
        logger.info(
            "migration_completed",
            total_feeds=total_feeds,
            total_indexed=total_indexed,
            meilisearch_docs=stats.get("number_of_documents", 0),
            is_indexing=stats.get("is_indexing", False),
        )

        # Verify counts match
        meili_count = stats.get("number_of_documents", 0)
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
    import logging

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
