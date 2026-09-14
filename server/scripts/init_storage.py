#!/usr/bin/env python3
"""
Supabase Storage initialization script for Readspace.

Ensures the public favicons bucket exists. Feed favicons are uploaded there by the
worker and served to clients via /storage/v1/object/public/favicons/<path>; on a fresh
self-hosted Supabase the bucket does not exist, so every upload would fail with
"Bucket not found".

It is idempotent and safe to run multiple times (the api container runs it on every start).

Usage:
    poetry run python scripts/init_storage.py
"""

import asyncio
import logging
import sys
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent.parent))

import structlog
from storage3.exceptions import StorageApiError  # type: ignore[import-untyped]
from supabase import AsyncClient
from supabase import acreate_client as create_async_client

from app.core.config import Settings
from app.core.constants import FAVICONS_BUCKET_NAME

logger = structlog.get_logger(__name__)


async def bucket_exists(client: AsyncClient, bucket_id: str) -> bool:
    """
    Check whether a storage bucket exists.

    Args:
        client: Supabase async client authenticated with the service role key
        bucket_id: Bucket identifier

    Returns:
        True if the bucket exists, False otherwise
    """
    buckets = await client.storage.list_buckets()
    return any(bucket.id == bucket_id for bucket in buckets)


async def ensure_public_bucket(client: AsyncClient, bucket_id: str) -> bool:
    """
    Create a public storage bucket if it does not already exist.

    Args:
        client: Supabase async client authenticated with the service role key
        bucket_id: Bucket identifier

    Returns:
        True if the bucket was created, False if it already existed
    """
    if await bucket_exists(client, bucket_id):
        logger.info("storage_bucket_already_exists", bucket=bucket_id)
        return False

    try:
        await client.storage.create_bucket(bucket_id, options={"public": True})
    except StorageApiError as e:
        # Another api replica may have created it between the check and the create
        if await bucket_exists(client, bucket_id):
            logger.info("storage_bucket_created_concurrently", bucket=bucket_id)
            return False
        logger.error("storage_bucket_create_failed", bucket=bucket_id, error=str(e))
        raise

    logger.info("storage_bucket_created", bucket=bucket_id, public=True)
    return True


async def init_storage() -> None:
    """Ensure every storage bucket the application relies on exists."""
    settings = Settings()
    client = await create_async_client(
        str(settings.SUPABASE_URL), settings.SUPABASE_SERVICE_ROLE_KEY.get_secret_value()
    )
    logger.info("storage_initialization_started")
    await ensure_public_bucket(client, FAVICONS_BUCKET_NAME)
    logger.info("storage_initialization_complete")


def main() -> None:
    """Main entry point for the storage initialization script."""
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

    try:
        asyncio.run(init_storage())
    except Exception as e:
        logger.error("storage_initialization_error", error=str(e))
        sys.exit(1)


if __name__ == "__main__":
    main()
