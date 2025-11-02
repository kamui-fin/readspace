"""
Verify test data was created correctly.

Usage: python verify_test_data.py <test_user_id>
"""

import asyncio
import sys
from pathlib import Path
from uuid import UUID

sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import func, select

from app.db.session import AsyncSessionLocal
from app.models.rss_models import (
    ArticleContent,
    Feed,
    FeedArticle,
    FeedSubscription,
    Folder,
    UserArticleState,
)

TEST_MARKER = "BENCHMARK_TEST"


async def verify_data(user_id: UUID):
    """Verify test data exists and is correct."""
    print("=" * 60)
    print("🔍 VERIFYING TEST DATA")
    print("=" * 60)
    print(f"User ID: {user_id}\n")

    async with AsyncSessionLocal() as db:
        # Check folders
        result = await db.execute(select(Folder).where(Folder.user_id == user_id, Folder.name.like(f"{TEST_MARKER}%")))
        folders = result.scalars().all()
        print(f"✓ Folders: {len(folders)}")

        if not folders:
            print("  ⚠️  No test folders found!")
            return

        # Check feeds
        result = await db.execute(select(Feed).where(Feed.tags.contains([TEST_MARKER])))
        feeds = result.scalars().all()
        print(f"✓ Feeds: {len(feeds)}")

        if not feeds:
            print("  ⚠️  No test feeds found!")
            return

        feed_ids = [f.id for f in feeds]

        # Check subscriptions
        result = await db.execute(
            select(FeedSubscription).where(
                FeedSubscription.user_id == user_id, FeedSubscription.feed_id.in_(feed_ids)
            )
        )
        subscriptions = result.scalars().all()
        print(f"✓ Subscriptions: {len(subscriptions)}")

        # Check articles
        result = await db.execute(select(FeedArticle).where(FeedArticle.feed_id.in_(feed_ids)))
        articles = result.scalars().all()
        print(f"✓ Articles: {len(articles)}")

        if articles:
            article_ids = [a.id for a in articles]

            # Check article contents
            content_ids = [a.content_id for a in articles]
            result = await db.execute(select(ArticleContent).where(ArticleContent.id.in_(content_ids)))
            contents = result.scalars().all()
            print(f"✓ Article Contents: {len(contents)}")

            # Check user states
            result = await db.execute(
                select(UserArticleState).where(
                    UserArticleState.user_id == user_id, UserArticleState.article_id.in_(article_ids)
                )
            )
            states = result.scalars().all()
            print(f"✓ User Article States: {len(states)}")

            # Statistics
            read_count = sum(1 for s in states if s.is_read)
            favorite_count = sum(1 for s in states if s.is_favorite)
            read_later_count = sum(1 for s in states if s.is_read_later)

            print(f"\n📊 Statistics:")
            print(f"  - Read articles: {read_count} ({read_count/len(states)*100:.1f}%)")
            print(f"  - Favorite articles: {favorite_count} ({favorite_count/len(states)*100:.1f}%)")
            print(f"  - Read later articles: {read_later_count} ({read_later_count/len(states)*100:.1f}%)")

            # Articles per feed
            result = await db.execute(
                select(FeedArticle.feed_id, func.count(FeedArticle.id))
                .where(FeedArticle.feed_id.in_(feed_ids))
                .group_by(FeedArticle.feed_id)
            )
            feed_article_counts = result.all()
            if feed_article_counts:
                counts = [count for _, count in feed_article_counts]
                avg_articles = sum(counts) / len(counts)
                min_articles = min(counts)
                max_articles = max(counts)
                print(f"\n📈 Articles per feed:")
                print(f"  - Average: {avg_articles:.1f}")
                print(f"  - Min: {min_articles}")
                print(f"  - Max: {max_articles}")

        print("\n" + "=" * 60)
        print("✅ VERIFICATION COMPLETE")
        print("=" * 60)


async def main():
    if len(sys.argv) < 2:
        print("❌ Usage: python verify_test_data.py <test_user_id>")
        sys.exit(1)

    try:
        user_id = UUID(sys.argv[1])
    except ValueError:
        print(f"❌ Invalid UUID: {sys.argv[1]}")
        sys.exit(1)

    await verify_data(user_id)


if __name__ == "__main__":
    asyncio.run(main())
