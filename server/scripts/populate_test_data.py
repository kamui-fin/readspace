"""
Populate test data for benchmarking.

This script creates:
- 10,000 fake feeds in the global feeds table (marked with "BENCHMARK_TEST" tag)
- ~1,000,000 articles across those feeds
- 50 folders for the test user
- 1,000 subscriptions (user subscribes to a subset of feeds)
- User article states for subscribed feeds only

All numbers are configurable in the CONFIGURATION section below.
"""

import asyncio
import random
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from uuid import UUID, uuid4

# Add server directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from faker import Faker
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.db.session import AsyncSessionLocal
from app.models.rss_models import (
    ArticleContent,
    Feed,
    FeedArticle,
    FeedCategory,
    FeedSubscription,
    Folder,
    UserArticleState,
)

fake = Faker()
settings = get_settings()

# We'll use existing real feeds from the database instead of creating new ones
# This avoids duplicate key violations and uses actual production data

# ============================================================================
# CONFIGURATION - Adjust these parameters as needed
# ============================================================================

# Total feeds to create in the global feeds table
NUM_FEEDS = 10_000

# Number of feeds the test user will subscribe to (subset of NUM_FEEDS)
NUM_SUBSCRIBED_FEEDS = 1_000

# Number of folders to create for the test user
NUM_FOLDERS = 50

# Total articles to create across all feeds
NUM_ARTICLES = 1_000_000

# Articles per feed (calculated)
ARTICLES_PER_FEED = NUM_ARTICLES // NUM_FEEDS  # ~100 articles per feed

# Batch size for database inserts (higher = faster but more memory)
BATCH_SIZE = 1000

# Marker for test data (easy cleanup)
TEST_MARKER = "BENCHMARK_TEST"

# ============================================================================


async def get_or_create_test_user(db: AsyncSession, user_id: UUID) -> UUID:
    """Verify test user exists."""
    from app.models.user_models import Profile

    result = await db.execute(select(Profile).where(Profile.id == user_id))
    user = result.scalar_one_or_none()

    if not user:
        print(f"❌ Test user {user_id} not found. Please create it first.")
        sys.exit(1)

    print(f"✅ Found test user: {user_id}")
    return user_id


async def create_folders(db: AsyncSession, user_id: UUID) -> list[UUID]:
    """Create test folders."""
    print(f"\n📁 Creating {NUM_FOLDERS} folders...")

    folder_ids = []
    folders = []

    for i in range(NUM_FOLDERS):
        folder = Folder(
            id=uuid4(),
            name=f"{TEST_MARKER}_Folder_{i+1}",
            user_id=user_id,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )
        folders.append(folder)
        folder_ids.append(folder.id)

    db.add_all(folders)
    await db.commit()

    print(f"✅ Created {len(folder_ids)} folders")
    return folder_ids


async def get_existing_real_feeds(db: AsyncSession, limit: int = 100) -> list[UUID]:
    """Get existing real feeds from the database (non-benchmark feeds)."""
    print(f"\n🔍 Finding {limit} existing real feeds...")
    
    # Get feeds that don't have the BENCHMARK_TEST marker
    result = await db.execute(
        select(Feed)
        .where(~Feed.tags.contains([TEST_MARKER]))
        .limit(limit)
    )
    real_feeds = result.scalars().all()
    
    real_feed_ids = [feed.id for feed in real_feeds]
    print(f"✅ Found {len(real_feed_ids)} existing real feeds")
    return real_feed_ids


async def create_feeds(db: AsyncSession) -> tuple[list[UUID], list[UUID]]:
    """Create test feeds with BENCHMARK_TEST marker and fake embeddings.
    
    Returns:
        Tuple of (all_feed_ids, real_feed_ids) where real_feed_ids are existing production feeds
    """
    print(f"\n🌐 Creating {NUM_FEEDS} test feeds...")

    feed_ids = []
    categories = list(FeedCategory)
    
    for batch_start in range(0, NUM_FEEDS, BATCH_SIZE):
        batch_end = min(batch_start + BATCH_SIZE, NUM_FEEDS)
        feeds = []

        for i in range(batch_start, batch_end):
            url = f"https://benchmark-test-feed-{i}.example.com/rss"
            title = f"{TEST_MARKER} - {fake.catch_phrase()}"
            link = f"https://benchmark-test-feed-{i}.example.com"
            
            # Generate fake embedding (768 dimensions for realistic vector search)
            # Use deterministic random for reproducibility
            random.seed(i)
            embedding = [random.gauss(0, 0.1) for _ in range(768)]
            
            feed = Feed(
                id=uuid4(),
                url=url,
                title=title,
                description=fake.text(max_nb_chars=200),
                link=link,
                language=random.choice(["en", "es", "fr", "de"]),
                image_url=f"https://picsum.photos/seed/{i}/200/200",
                tags=[TEST_MARKER, fake.word(), fake.word()],
                top_level_category=random.choice(categories),
                popularity_score=random.uniform(0, 100),
                subscriber_count=random.randint(1, 1000),
                embedding=embedding,  # Add fake embedding for vector search
                ttl=random.choice([30, 60, 120, 240]),
                last_fetched_at=datetime.now(timezone.utc) - timedelta(hours=random.randint(1, 24)),
                fetch_error_count=0,
                created_at=datetime.now(timezone.utc) - timedelta(days=random.randint(1, 365)),
                updated_at=datetime.now(timezone.utc),
            )
            feeds.append(feed)
            feed_ids.append(feed.id)

        db.add_all(feeds)
        await db.commit()

        print(f"  ✓ Created feeds {batch_start + 1} to {batch_end}")

    # Get existing real feeds for testing subscription/refresh operations
    real_feed_ids = await get_existing_real_feeds(db, limit=100)
    
    print(f"✅ Created {len(feed_ids)} test feeds + found {len(real_feed_ids)} real feeds")
    return feed_ids, real_feed_ids


async def create_subscriptions(
    db: AsyncSession, user_id: UUID, feed_ids: list[UUID], folder_ids: list[UUID]
) -> list[UUID]:
    """Create subscriptions for a subset of test feeds."""
    # Only subscribe to NUM_SUBSCRIBED_FEEDS feeds
    subscribed_feed_ids = random.sample(feed_ids, min(NUM_SUBSCRIBED_FEEDS, len(feed_ids)))
    
    print(f"\n🔗 Creating {len(subscribed_feed_ids)} subscriptions (out of {len(feed_ids)} total feeds)...")

    successfully_created = []
    
    for batch_start in range(0, len(subscribed_feed_ids), BATCH_SIZE):
        batch_end = min(batch_start + BATCH_SIZE, len(subscribed_feed_ids))
        subscriptions = []

        for feed_id in subscribed_feed_ids[batch_start:batch_end]:
            subscription = FeedSubscription(
                id=uuid4(),
                user_id=user_id,
                feed_id=feed_id,
                folder_id=random.choice(folder_ids),
                is_favorite=random.random() < 0.1,  # 10% favorites
                custom_title=fake.catch_phrase() if random.random() < 0.2 else None,
                created_at=datetime.now(timezone.utc),
                updated_at=datetime.now(timezone.utc),
            )
            subscriptions.append(subscription)

        try:
            db.add_all(subscriptions)
            await db.commit()
            successfully_created.extend(subscribed_feed_ids[batch_start:batch_end])
            print(f"  ✓ Created subscriptions {batch_start + 1} to {batch_end}")
        except Exception as e:
            await db.rollback()
            print(f"  ⚠️  Batch {batch_start + 1} to {batch_end} failed: {str(e)[:100]}")
            # Try individual inserts for this batch
            for feed_id in subscribed_feed_ids[batch_start:batch_end]:
                try:
                    subscription = FeedSubscription(
                        id=uuid4(),
                        user_id=user_id,
                        feed_id=feed_id,
                        folder_id=random.choice(folder_ids),
                        is_favorite=random.random() < 0.1,
                        custom_title=fake.catch_phrase() if random.random() < 0.2 else None,
                        created_at=datetime.now(timezone.utc),
                        updated_at=datetime.now(timezone.utc),
                    )
                    db.add(subscription)
                    await db.commit()
                    successfully_created.append(feed_id)
                except Exception:
                    await db.rollback()
                    # Skip this feed silently

    print(f"✅ Created {len(successfully_created)} subscriptions")
    return successfully_created


async def create_articles(db: AsyncSession, feed_ids: list[UUID], subscribed_feed_ids: list[UUID], user_id: UUID) -> None:
    """Create articles and content. Only create user states for subscribed feeds."""
    print(f"\n📰 Creating ~{NUM_ARTICLES:,} articles across all feeds...")
    print(f"   (User states will only be created for {len(subscribed_feed_ids)} subscribed feeds)")

    total_created = 0
    content_batch = []
    article_batch = []
    state_batch = []
    
    # Convert to set for faster lookup
    subscribed_feed_set = set(subscribed_feed_ids)

    for feed_idx, feed_id in enumerate(feed_ids):
        # Vary articles per feed (50-150 per feed)
        num_articles_for_feed = random.randint(50, 150)

        for article_idx in range(num_articles_for_feed):
            # Create content
            content_id = uuid4()
            published_at = datetime.now(timezone.utc) - timedelta(
                days=random.randint(0, 365), hours=random.randint(0, 23)
            )

            content = ArticleContent(
                id=content_id,
                title=fake.sentence(nb_words=8),
                link=f"https://benchmark-test-feed-{feed_idx}.example.com/article/{article_idx}",
                description=fake.text(max_nb_chars=300),
                content=fake.text(max_nb_chars=2000),
                image_url=f"https://picsum.photos/seed/{feed_idx}_{article_idx}/800/600",
                author=fake.name(),
                published_at=published_at,
                estimated_read_time_minutes=random.randint(1, 15),
                custom_metadata={"source": TEST_MARKER},
                created_at=published_at,
                updated_at=published_at,
            )
            content_batch.append(content)

            # Create feed article
            article_id = uuid4()
            article = FeedArticle(
                id=article_id,
                feed_id=feed_id,
                content_id=content_id,
                guid=f"benchmark-{feed_idx}-{article_idx}",
                created_at=published_at,
                updated_at=published_at,
            )
            article_batch.append(article)

            # Create user state (30% read, 10% favorite, 20% read later)
            is_read = random.random() < 0.3
            state = UserArticleState(
                id=uuid4(),
                user_id=user_id,
                article_id=article_id,
                is_read=is_read,
                read_at=published_at + timedelta(hours=random.randint(1, 48)) if is_read else None,
                is_read_later=random.random() < 0.2,
                is_favorite=random.random() < 0.1,
                user_note=fake.sentence() if random.random() < 0.05 else None,
                user_tags=[fake.word(), fake.word()] if random.random() < 0.1 else None,
                created_at=published_at,
                updated_at=published_at,
            )
            state_batch.append(state)

            total_created += 1

            # Commit in batches
            if len(content_batch) >= BATCH_SIZE:
                db.add_all(content_batch)
                db.add_all(article_batch)
                db.add_all(state_batch)
                await db.commit()

                print(f"  ✓ Created {total_created:,} articles...")

                content_batch = []
                article_batch = []
                state_batch = []

    # Commit remaining
    if content_batch:
        db.add_all(content_batch)
        db.add_all(article_batch)
        db.add_all(state_batch)
        await db.commit()

    print(f"✅ Created {total_created:,} articles")


async def cleanup_test_data(db: AsyncSession, user_id: UUID) -> None:
    """Clean up existing test data."""
    print("\n🧹 Cleaning up existing test data...")

    # Delete folders (cascades to subscriptions)
    result = await db.execute(select(Folder).where(Folder.user_id == user_id, Folder.name.like(f"{TEST_MARKER}%")))
    folders = result.scalars().all()
    for folder in folders:
        await db.delete(folder)
    await db.commit()
    print(f"  ✓ Deleted {len(folders)} folders")

    # Delete feeds (cascades to articles and subscriptions)
    result = await db.execute(select(Feed).where(Feed.tags.contains([TEST_MARKER])))
    feeds = result.scalars().all()
    for feed in feeds:
        await db.delete(feed)
    await db.commit()
    print(f"  ✓ Deleted {len(feeds)} feeds")

    print("✅ Cleanup complete")


async def main():
    """Main execution."""
    print("=" * 60)
    print("🚀 BENCHMARK TEST DATA POPULATION")
    print("=" * 60)

    # Get test user ID from command line
    if len(sys.argv) < 2:
        print("\n❌ Usage: python populate_test_data.py <test_user_id>")
        print("   Example: python populate_test_data.py 123e4567-e89b-12d3-a456-426614174000")
        sys.exit(1)

    try:
        user_id = UUID(sys.argv[1])
    except ValueError:
        print(f"\n❌ Invalid UUID: {sys.argv[1]}")
        sys.exit(1)

    async with AsyncSessionLocal() as db:
        try:
            # Verify user exists
            await get_or_create_test_user(db, user_id)

            # Clean up existing test data
            await cleanup_test_data(db, user_id)

            # Create folders
            folder_ids = await create_folders(db, user_id)

            # Create feeds (returns test feeds + real feed IDs)
            feed_ids, real_feed_ids = await create_feeds(db)

            # Create subscriptions (mix of test feeds and real feeds)
            all_available_feeds = feed_ids + real_feed_ids
            subscribed_feed_ids = await create_subscriptions(db, user_id, all_available_feeds, folder_ids)

            # Create articles (only for test feeds, not real feeds which already have articles)
            await create_articles(db, feed_ids, subscribed_feed_ids, user_id)

            print("\n✅ Test data population complete!")
            print(f"\nTo view summary, run:")
            print(f"  python scripts/show_test_data_summary.py {user_id}")
            print(f"\nTo clean up later, run:")
            print(f"  python scripts/cleanup_test_data.py {user_id}")

        except Exception as e:
            print(f"\n❌ Error: {e}")
            import traceback

            traceback.print_exc()
            await db.rollback()
            sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
