#!/usr/bin/env python3
"""Manual task trigger script for feed_tasks.

This script allows you to manually trigger background tasks from app/workers/feed_tasks.py
for testing and maintenance purposes.

Usage:
    python scripts/trigger_task.py refresh-all    # Schedule all feeds needing refresh
    python scripts/trigger_task.py compact-unread  # Compact unread articles
    python scripts/trigger_task.py compact-old     # Delete old articles

Or using poethepoet:
    poe trigger refresh-all
    poe trigger compact-unread
    poe trigger compact-old
"""

import asyncio
import sys
from pathlib import Path

import structlog

# Add parent directory to Python path to import app modules
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.core.taskiq_app import broker
from app.workers.common import get_worker_db
from app.workers.feed_tasks import (
    async_compact_old_articles,
    async_compact_unread_articles,
    async_schedule_all_feeds,
)

logger = structlog.get_logger(__name__)


async def trigger_refresh_all() -> None:
    """Trigger schedule all feed refreshes task."""
    logger.info("Triggering: Schedule all feed refreshes")

    async for session in get_worker_db():
        await async_schedule_all_feeds(db=session, test_mode=False)

    logger.info("Completed: Schedule all feed refreshes")


async def trigger_compact_unread() -> None:
    """Trigger compact unread articles task."""
    logger.info("Triggering: Compact unread articles")

    async for session in get_worker_db():
        result = await async_compact_unread_articles(db=session)

    logger.info("Completed: Compact unread articles", **result)
    print(f"\nResult: {result}")


async def trigger_compact_old() -> None:
    """Trigger compact old articles task."""
    logger.info("Triggering: Compact old articles")

    async for session in get_worker_db():
        result = await async_compact_old_articles(db=session)

    logger.info("Completed: Compact old articles", **result)
    print(f"\nResult: {result}")


TASKS = {
    "refresh-all": trigger_refresh_all,
    "compact-unread": trigger_compact_unread,
    "compact-old": trigger_compact_old,
}


def print_usage() -> None:
    """Print usage information."""
    print("Usage: python scripts/trigger_task.py <task-name>")
    print("\nAvailable tasks:")
    print("  refresh-all    - Schedule all feeds needing refresh")
    print("  compact-unread - Compact unread articles")
    print("  compact-old    - Delete old articles")
    print("\nExample:")
    print("  python scripts/trigger_task.py refresh-all")
    print("  poe trigger refresh-all")


async def main() -> None:
    """Main entry point for the script."""
    if len(sys.argv) != 2:
        print_usage()
        sys.exit(1)

    task_name = sys.argv[1]

    if task_name not in TASKS:
        print(f"Error: Unknown task '{task_name}'")
        print()
        print_usage()
        sys.exit(1)

    # Initialize the broker before dispatching tasks
    await broker.startup()

    try:
        await TASKS[task_name]()
    except Exception as exc:
        logger.error("Task execution failed", task=task_name, error=str(exc), exc_info=True)
        print(f"\nError: Task execution failed - {exc}")
        sys.exit(1)
    finally:
        # Shutdown the broker to close connections
        await broker.shutdown()


if __name__ == "__main__":
    asyncio.run(main())
