#!/usr/bin/env python3
"""Manual task trigger script for feed_tasks.

This script allows you to manually trigger background tasks from app/workers/feed_tasks.py
for testing and maintenance purposes.

Usage:
    python scripts/trigger_task.py refresh-all    # Schedule all feeds needing refresh
    python scripts/trigger_task.py compact-unread  # Compact unread articles
    python scripts/trigger_task.py compact-old     # Delete old articles
    python scripts/trigger_task.py codex-generate <user_id>  # Generate a Codex digest

Or using poethepoet:
    poe trigger refresh-all
    poe trigger compact-unread
    poe trigger compact-old
    poe trigger codex-generate <user_id>
"""

import asyncio
import sys
from pathlib import Path
from uuid import UUID

import structlog

# Add parent directory to Python path to import app modules
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.core.taskiq_app import broker
from app.workers.feed_tasks import (
    batch_enrich_feeds_task,
    compact_old_articles_task,
    compact_unread_articles_task,
    schedule_all_feed_refreshes_task,
)

logger = structlog.get_logger(__name__)


async def trigger_refresh_all() -> None:
    """Trigger schedule all feed refreshes task."""
    logger.info("Triggering: Schedule all feed refreshes")
    await schedule_all_feed_refreshes_task()
    logger.info("Task queued: Schedule all feed refreshes")


async def trigger_compact_unread() -> None:
    """Trigger compact unread articles task."""
    logger.info("Triggering: Compact unread articles")
    await compact_unread_articles_task()
    logger.info("Task queued: Compact unread articles")


async def trigger_compact_old() -> None:
    """Trigger compact old articles task."""
    logger.info("Triggering: Compact old articles")
    await compact_old_articles_task()
    logger.info("Task queued: Compact old articles")


async def trigger_batch_enrich() -> None:
    """Trigger batch enrich feeds task."""
    logger.info("Triggering: Batch enrich feeds")
    await batch_enrich_feeds_task()
    logger.info("Task queued: Batch enrich feeds")


async def trigger_codex_generate(user_id: str) -> None:
    """Manually generate a Codex digest for a user, bypassing the HTTP quota check."""
    from datetime import datetime, timezone

    from app.crud import codex as crud_codex
    from app.workers.codex_tasks import generate_codex_digest_task
    from app.workers.common import worker_db

    logger.info("Triggering: Codex digest generation", user_id=user_id)

    today = datetime.now(timezone.utc).date()
    async with worker_db() as db:
        # Bypass the HTTP quota gate entirely - always start the next edition for today.
        digest = await crud_codex.create_pending_digest(db, UUID(user_id), today)
        digest_id = str(digest.id)

    await generate_codex_digest_task(user_id, digest_id)
    logger.info("Task completed: Codex digest generation", digest_id=digest_id)
    print(f"\nSuccess: Codex digest generated - digest_id={digest_id}")


async def trigger_reset_failed() -> None:
    """Reset all feeds that were marked as failed enrichment."""
    logger.info("Triggering: Reset failed enrichment feeds")
    from sqlalchemy import update

    from app.models.feed import Feed
    from app.workers.common import worker_db

    async with worker_db() as db:
        stmt = update(Feed).where(Feed.tags.contains(["failed-enrichment"])).values(tags=None, content_type=None)
        res = await db.execute(stmt)
        logger.info("Failed enrichments reset successfully", count=res.rowcount)
        print(f"\nSuccess: Reset {res.rowcount} feeds from failed enrichment state!")


TASKS = {
    "refresh-all": trigger_refresh_all,
    "compact-unread": trigger_compact_unread,
    "compact-old": trigger_compact_old,
    "batch-enrich": trigger_batch_enrich,
    "reset-failed": trigger_reset_failed,
    "codex-generate": trigger_codex_generate,
}

# Tasks that take a positional argument beyond the task name (e.g. a user_id).
TASKS_WITH_ARGS = {"codex-generate"}


def print_usage() -> None:
    """Print usage information."""
    print("Usage: python scripts/trigger_task.py <task-name> [arg]")
    print("\nAvailable tasks:")
    print("  refresh-all             - Schedule all feeds needing refresh")
    print("  compact-unread          - Compact unread articles")
    print("  compact-old             - Delete old articles")
    print("  batch-enrich            - Batch enrich feeds")
    print("  reset-failed            - Reset all feeds marked as 'failed-enrichment'")
    print("  codex-generate <user_id> - Generate a Codex digest for a user")
    print("\nExample:")
    print("  python scripts/trigger_task.py refresh-all")
    print("  python scripts/trigger_task.py codex-generate 3fa85f64-5717-4562-b3fc-2c963f66afa6")
    print("  poe trigger refresh-all")


async def main() -> None:
    """Main entry point for the script."""
    if len(sys.argv) not in (2, 3):
        print_usage()
        sys.exit(1)

    task_name = sys.argv[1]
    extra_args = sys.argv[2:]

    if task_name not in TASKS:
        print(f"Error: Unknown task '{task_name}'")
        print()
        print_usage()
        sys.exit(1)

    if task_name in TASKS_WITH_ARGS and not extra_args:
        print(f"Error: '{task_name}' requires an argument")
        print()
        print_usage()
        sys.exit(1)

    # Initialize the broker before dispatching tasks
    await broker.startup()

    try:
        await TASKS[task_name](*extra_args)
    except Exception as exc:
        logger.error("Task execution failed", task=task_name, error=str(exc), exc_info=True)
        print(f"\nError: Task execution failed - {exc}")
        sys.exit(1)
    finally:
        # Shutdown the broker to close connections
        await broker.shutdown()


if __name__ == "__main__":
    asyncio.run(main())
