"""
Clean up benchmark test data.

Usage: python cleanup_test_data.py <test_user_id>
"""

import asyncio
import sys
from pathlib import Path
from uuid import UUID

sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import select

from app.db.session import AsyncSessionLocal
from app.models.rss_models import Feed, Folder

TEST_MARKER = "BENCHMARK_TEST"


async def main():
    if len(sys.argv) < 2:
        print("❌ Usage: python cleanup_test_data.py <test_user_id>")
        sys.exit(1)

    try:
        user_id = UUID(sys.argv[1])
    except ValueError:
        print(f"❌ Invalid UUID: {sys.argv[1]}")
        sys.exit(1)

    print(f"🧹 Cleaning up test data for user {user_id}...")

    async with AsyncSessionLocal() as db:
        # Delete folders (cascades to subscriptions)
        result = await db.execute(select(Folder).where(Folder.user_id == user_id, Folder.name.like(f"{TEST_MARKER}%")))
        folders = result.scalars().all()
        for folder in folders:
            await db.delete(folder)
        await db.commit()
        print(f"✓ Deleted {len(folders)} folders")

        # Delete feeds (cascades to articles)
        result = await db.execute(select(Feed).where(Feed.tags.contains([TEST_MARKER])))
        feeds = result.scalars().all()
        for feed in feeds:
            await db.delete(feed)
        await db.commit()
        print(f"✓ Deleted {len(feeds)} feeds")

        print("✅ Cleanup complete!")


if __name__ == "__main__":
    asyncio.run(main())
