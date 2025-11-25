#!/usr/bin/env python3
"""
Meilisearch initialization script for Readspace.

This script initializes the Meilisearch index with proper configuration.
It is idempotent and safe to run multiple times.

Two modes of operation:
1. Init mode (default): Configure the Meilisearch index only
   - Exits early if index already exists and is configured
   - Called automatically during setup

2. Migrate mode: Configure index AND sync all feeds from PostgreSQL
   - Use this to bulk-import existing feeds
   - Run manually after setup is complete

Usage:
    # Initialize index only (idempotent, safe to run multiple times)
    poetry run python scripts/init_meilisearch.py

    # Full migration including data sync
    poetry run python scripts/init_meilisearch.py --migrate [--batch-size 1000]

    # Check if index exists without making changes
    poetry run python scripts/init_meilisearch.py --check
"""

import argparse
import asyncio
import logging
import sys
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent.parent))

import structlog
from meilisearch_python_sdk import AsyncClient
from meilisearch_python_sdk.errors import MeilisearchError
from meilisearch_python_sdk.models.settings import MeilisearchSettings
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.models.feed import Feed
from app.services.feeds.meilisearch import get_client, sync_feeds_batch

logger = structlog.get_logger(__name__)


async def check_index_exists(client: AsyncClient, index_name: str) -> bool:
    """
    Check if the Meilisearch index exists and is configured.

    Args:
        client: Meilisearch async client
        index_name: Name of the index

    Returns:
        True if index exists and has settings configured, False otherwise
    """
    try:
        index = await client.get_index(index_name)
        settings = await index.get_settings()

        # Check if index has been configured
        # Consider it configured if it has searchable_attributes set
        if settings.searchable_attributes:
            logger.info("meilisearch_index_already_configured", index=index_name)
            return True

        logger.info("meilisearch_index_exists_but_not_configured", index=index_name)
        return False
    except MeilisearchError as e:
        if "index_not_found" in str(e).lower():
            logger.info("meilisearch_index_not_found", index=index_name)
            return False
        raise


async def configure_meilisearch_index(
    client: AsyncClient, index_name: str, settings: Settings, force: bool = False, embedders_only: bool = False
) -> None:
    """
    Configure Meilisearch index with all necessary settings.

    This is the ONLY place where index configuration should happen.
    The runtime service only performs CRUD operations.

    Args:
        client: Meilisearch async client
        index_name: Name of the index
        settings: Application settings
        force: If True, reconfigure even if index exists
        embedders_only: If True, only update embedder settings (for AI sync)
    """

    logger.info("configuring_meilisearch_index", index=index_name)

    # For embedders_only mode, skip the existence check
    if not embedders_only:
        # Check if already configured (unless force is True)
        if not force and await check_index_exists(client, index_name):
            logger.info("meilisearch_index_already_configured_skipping", index=index_name)
            return

    # Create or get existing index
    try:
        index = await client.get_index(index_name)
        logger.info("meilisearch_index_found", index=index_name)
    except MeilisearchError as e:
        if "index_not_found" in str(e).lower():
            if embedders_only:
                logger.error("cannot_sync_embeddings_index_not_found", index=index_name)
                raise RuntimeError("Index must exist before syncing embeddings")
            # create_index returns AsyncIndex directly (waits by default)
            index = await client.create_index(index_name, primary_key="id")
            logger.info("meilisearch_index_created", index=index_name)
        else:
            raise

    # If embedders_only mode, only update embedder settings
    if embedders_only:
        if not settings.ENABLE_AI:
            logger.error("cannot_sync_embeddings_ai_disabled")
            raise RuntimeError("ENABLE_AI must be true to sync embeddings")
        
        settings_dict = {
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
            }
        }
        logger.info("syncing_embeddings_only", index=index_name)
    else:
        # Base settings configuration
        settings_dict = {
        # Fields that can be searched with full-text search
        "searchable_attributes": [
            "title",
            "description",
            "tags",
            "url",
            "link",
        ],
        # Fields that can be used in filter expressions
        "filterable_attributes": [
            "language",
            "top_level_category",
        ],
        # Fields that can be used for sorting
        "sortable_attributes": [
            "popularity_score",
        ],
        # Fields to return in search results
        "displayed_attributes": [
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
        "ranking_rules": [
            "words",  # Number of matched query terms
            "typo",  # Fewer typos = better rank
            "proximity",  # Proximity of query terms
            "attribute",  # Match in important attributes (title > desc)
            "sort",  # Custom sort criterion
            "exactness",  # Exact matches ranked higher
            "popularity_score:desc",  # Custom: Popular feeds ranked higher
        ],
        # Enable typo tolerance for better search UX
        "typo_tolerance": {
            "enabled": True,
            "minWordSizeForTypos": {
                "oneTypo": 4,
                "twoTypos": 8,
            },
        },
        # Pagination settings
        "pagination": {"maxTotalHits": 500},
    }

        # Configure embedders only if AI is enabled
        if settings.ENABLE_AI:
            settings_dict["embedders"] = {
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
            }
            logger.info("ai_enabled_configuring_embedders", index=index_name)
        else:
            logger.info("ai_disabled_skipping_embedders", index=index_name)

    # Create Pydantic model from dict
    # The SDK will automatically convert snake_case to camelCase for the API
    settings_config = MeilisearchSettings(**settings_dict)

    # Apply settings and wait for completion
    task = await index.update_settings(settings_config)
    logger.info("update_settings_task_received", task_uid=task.task_uid)
    await client.wait_for_task(task.task_uid)
    
    if embedders_only:
        logger.info("embeddings_sync_complete", index=index_name)
        # Get stats to show indexing progress
        stats = await index.get_stats()
        logger.info(
            "embeddings_status",
            documents=stats.number_of_documents,
            is_indexing=stats.is_indexing,
        )
    else:
        logger.info("meilisearch_index_configured", index=index_name)


async def init_meilisearch(check_only: bool = False) -> bool:
    """
    Initialize Meilisearch index configuration.

    This is idempotent and safe to run multiple times.
    Exits early if index is already configured.

    Args:
        check_only: If True, only check if index exists without configuring

    Returns:
        True if index exists and is configured, False otherwise
    """
    # Load settings
    settings = Settings()
    client = get_client(settings)
    index_name = settings.MEILISEARCH_INDEX_NAME

    logger.info("meilisearch_initialization_started", check_only=check_only)

    # Check if index exists
    exists = await check_index_exists(client, index_name)

    if check_only:
        logger.info("meilisearch_check_complete", exists=exists, configured=exists)
        return exists

    if exists:
        logger.info("meilisearch_already_initialized")
        return True

    # Configure index
    await configure_meilisearch_index(client, index_name, settings, force=False)
    logger.info("meilisearch_initialization_complete")
    return True


async def sync_embeddings() -> None:
    """
    Sync embeddings for existing documents when enabling AI after initial setup.

    This updates the index configuration to add embedders, which triggers
    Meilisearch to automatically generate embeddings for all existing documents.
    No need to re-index from PostgreSQL.
    """
    settings = Settings()

    if not settings.ENABLE_AI:
        logger.error("ai_not_enabled")
        raise RuntimeError("ENABLE_AI must be set to true in your environment to sync embeddings")

    client = get_client(settings)
    index_name = settings.MEILISEARCH_INDEX_NAME
    logger.info("embeddings_sync_started")

    # Check if index exists
    exists = await check_index_exists(client, index_name)
    if not exists:
        logger.error("index_not_found_cannot_sync")
        raise RuntimeError("Index must exist before syncing embeddings. Run init first.")

    # Update settings to add embedders
    await configure_meilisearch_index(client, index_name, settings, force=False, embedders_only=True)
    
    logger.info(
        "embeddings_sync_initiated",
        note="Meilisearch will generate embeddings in the background. Check status with --check",
    )


async def migrate_feeds(batch_size: int = 5) -> None:
    """
    Migrate all feeds from PostgreSQL to Meilisearch.

    This should be run manually after initial setup to bulk-import existing feeds.

    Args:
        batch_size: Number of feeds to process in each batch
    """
    # Load settings
    settings = Settings()

    # Use synchronous connection string by converting async URL
    db_url = settings.SUPABASE_DB_CONNECTION.replace(
        "postgresql+asyncpg://", "postgresql://"
    )

    client = get_client(settings)
    index_name = settings.MEILISEARCH_INDEX_NAME

    logger.info("migration_started", batch_size=batch_size)

    # Configure index (force reconfiguration)
    await configure_meilisearch_index(client, index_name, settings, force=True)

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
            # Clear existing documents if doing full migration
            logger.info("clearing_existing_documents")
            index = await client.get_index(index_name)
            task = await index.delete_all_documents()
            await client.wait_for_task(task.task_uid)
            logger.info("existing_documents_cleared")

            # Count total feeds
            count_query = select(Feed)
            result = session.execute(count_query)
            all_feeds = result.scalars().all()
            total_feeds = len(all_feeds)

            logger.info("feeds_counted", total=total_feeds)

            if total_feeds == 0:
                logger.info("no_feeds_to_migrate")
                return

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
                await sync_feeds_batch(settings, batch)
                total_indexed += len(batch)

                # Wait a bit between batches to avoid overwhelming Meilisearch
                if i + batch_size < total_feeds:
                    await asyncio.sleep(0.5)

        # Get final stats
        index = await client.get_index(index_name)
        stats = await index.get_stats()
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
    """Main entry point for the initialization/migration script."""
    parser = argparse.ArgumentParser(
        description="Initialize Meilisearch index and optionally migrate feeds",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Initialize index (idempotent, safe to run multiple times)
  poetry run python scripts/init_meilisearch.py

  # Check if index exists without making changes
  poetry run python scripts/init_meilisearch.py --check

  # Sync embeddings after enabling AI (for existing documents)
  poetry run python scripts/init_meilisearch.py --sync-embeddings

  # Full migration including all feeds from database
  poetry run python scripts/init_meilisearch.py --migrate

  # Migrate with custom batch size
  poetry run python scripts/init_meilisearch.py --migrate --batch-size 500
        """,
    )
    parser.add_argument(
        "--check",
        action="store_true",
        help="Check if index exists without making changes",
    )
    parser.add_argument(
        "--sync-embeddings",
        action="store_true",
        help="Enable embeddings for existing documents (run after enabling ENABLE_AI)",
    )
    parser.add_argument(
        "--migrate",
        action="store_true",
        help="Migrate all feeds from PostgreSQL to Meilisearch (implies init)",
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=1000,
        help="Number of feeds to process in each batch during migration (default: 1000)",
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

    # Run appropriate mode
    try:
        if args.check:
            # Check mode: just verify if index exists
            exists = asyncio.run(init_meilisearch(check_only=True))
            sys.exit(0 if exists else 1)
        elif args.sync_embeddings:
            # Sync embeddings mode: enable AI for existing documents
            logger.info("running_embeddings_sync")
            asyncio.run(sync_embeddings())
        elif args.migrate:
            # Migrate mode: init + migrate all feeds
            logger.info("running_full_migration")
            asyncio.run(migrate_feeds(batch_size=args.batch_size))
        else:
            # Default: just initialize index (idempotent)
            logger.info("running_initialization_only")
            asyncio.run(init_meilisearch(check_only=False))
    except KeyboardInterrupt:
        logger.info("operation_interrupted")
        sys.exit(1)
    except Exception as e:
        logger.error("operation_error", error=str(e))
        sys.exit(1)


if __name__ == "__main__":
    main()
