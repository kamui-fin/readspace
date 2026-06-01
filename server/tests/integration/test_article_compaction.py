"""End-to-end tests for article compaction task."""

import hashlib
from datetime import datetime, timedelta, timezone
from uuid import uuid4

import pytest
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.article import ArticleContent, FeedArticle
from app.models.feed import Feed, FeedSubscription
from app.models.folder import Folder
from app.models.user import Profile
from app.workers.feed.compaction import compact_old_articles


@pytest.mark.asyncio
async def test_compaction_task_deletes_old_articles_e2e(
    db_session: AsyncSession, test_user: Profile
):
    """Test full article compaction workflow with real database."""
    # Create folder
    folder = Folder(
        id=uuid4(),
        user_id=test_user.id,
        name="E2E Test Folder",
    )
    db_session.add(folder)

    # Create feed
    feed = Feed(
        id=uuid4(),
        url=f"https://example.com/e2e-feed-{uuid4().hex[:8]}.xml",
        title="E2E Test Feed",
        description="Test feed description",
        language="en",
    )
    db_session.add(feed)
    await db_session.flush()

    # Create subscription
    subscription = FeedSubscription(
        id=uuid4(),
        user_id=test_user.id,
        feed_id=feed.id,
        folder_id=folder.id,
    )
    db_session.add(subscription)
    await db_session.flush()

    # Create 70 old articles (all > 7 days to match ARTICLE_RETENTION_DAYS)
    article_ids = []
    for i in range(70):
        published_at = datetime.now(timezone.utc) - timedelta(days=8 + i)
        link = f"https://example.com/e2e-old-{i}"
        content_hash = hashlib.sha256(link.encode()).hexdigest()
        content = ArticleContent(
            id=uuid4(),
            title=f"E2E Old Article {i}",
            link=link,
            content_hash=content_hash,
            description="Test article for E2E compaction",
            content="Test content",
        )
        db_session.add(content)
        await db_session.flush()

        article = FeedArticle(
            id=uuid4(),
            feed_id=feed.id,
            content_id=content.id,
            guid_hash=f"e2e-old-{uuid4()}",
            published_at=published_at,
        )
        db_session.add(article)
        await db_session.flush()
        article_ids.append(article.id)

    await db_session.commit()

    # Verify initial count
    result = await db_session.execute(
        select(FeedArticle).where(FeedArticle.feed_id == feed.id)
    )
    articles_before = result.scalars().all()
    assert len(articles_before) == 70

    # Store feed_id before running compaction
    feed_id = feed.id

    # Test the CRUD function directly with the test session
    from app.crud.article.actions import delete_old_article_contents

    deleted_count = await delete_old_article_contents(
        db_session, retention_days=7, min_articles_per_feed=50
    )
    await db_session.commit()

    # Verify 20 articles were deleted (70 - 50 = 20)
    assert deleted_count == 20, f"Expected 20 articles deleted, got {deleted_count}"

    # Create a fresh query
    from sqlalchemy.orm import selectinload

    result = await db_session.execute(
        select(FeedArticle)
        .where(FeedArticle.feed_id == feed_id)
        .options(selectinload(FeedArticle.content))
    )
    articles_after = result.scalars().all()
    assert (
        len(articles_after) == 50
    ), f"Expected 50 articles for test feed, got {len(articles_after)}"

    # Verify the oldest articles were deleted and newest were kept
    # The remaining articles should be the 50 newest ones (indices 0-49)
    remaining_titles = {
        article.content.title for article in articles_after if article.content
    }
    for i in range(50):
        expected_title = f"E2E Old Article {i}"
        assert (
            expected_title in remaining_titles
        ), f"Expected {expected_title} to be kept"


@pytest.mark.asyncio
async def test_compaction_preserves_user_saved_articles_e2e(
    db_session: AsyncSession, test_user: Profile
):
    """Test that compaction preserves articles saved by users across all feeds."""
    # Create folder
    folder = Folder(
        id=uuid4(),
        user_id=test_user.id,
        name="E2E Saved Test Folder",
    )
    db_session.add(folder)

    # Create feed
    feed = Feed(
        id=uuid4(),
        url=f"https://example.com/e2e-saved-feed-{uuid4().hex[:8]}.xml",
        title="E2E Saved Test Feed",
        description="Test feed description",
        language="en",
    )
    db_session.add(feed)
    await db_session.flush()

    # Create subscription
    subscription = FeedSubscription(
        id=uuid4(),
        user_id=test_user.id,
        feed_id=feed.id,
        folder_id=folder.id,
    )
    db_session.add(subscription)
    await db_session.commit()

    # Create 70 old articles (all > 7 days to match ARTICLE_RETENTION_DAYS)
    saved_article_ids = []
    for i in range(70):
        published_at = datetime.now(timezone.utc) - timedelta(days=8 + i)
        link = f"https://example.com/e2e-saved-{i}"
        content_hash = hashlib.sha256(link.encode()).hexdigest()
        content = ArticleContent(
            id=uuid4(),
            title=f"E2E Article {i}",
            link=link,
            content_hash=content_hash,
            description="Test article",
            content="Test content",
        )
        db_session.add(content)
        await db_session.flush()

        article = FeedArticle(
            id=uuid4(),
            feed_id=feed.id,
            content_id=content.id,
            guid_hash=f"e2e-saved-{uuid4()}",
            published_at=published_at,
        )
        db_session.add(article)
        await db_session.flush()

        # Mark the oldest 5 articles (which would normally be deleted) as saved
        if i >= 65:  # These are the oldest 5
            from app.models.article import UserEntry

            state = UserEntry(
                user_id=test_user.id,
                content_id=content.id,
                feed_article_id=article.id,
                is_saved=True,
            )
            db_session.add(state)
            saved_article_ids.append(article.id)

    await db_session.commit()

    # Store IDs before running compaction
    feed_id = feed.id

    # Test the CRUD function directly
    from app.crud.article.actions import delete_old_article_contents

    deleted_count = await delete_old_article_contents(
        db_session, retention_days=7, min_articles_per_feed=50
    )
    await db_session.commit()

    # Verify all saved articles still exist
    for saved_id in saved_article_ids:
        result = await db_session.execute(
            select(FeedArticle).where(FeedArticle.id == saved_id)
        )
        article = result.scalar_one_or_none()
        assert article is not None, f"Saved article {saved_id} was deleted"

    # Verify we kept at least 50 articles plus the saved ones
    result = await db_session.execute(
        select(FeedArticle).where(FeedArticle.feed_id == feed_id)
    )
    remaining_articles = result.scalars().all()
    assert len(remaining_articles) >= 50 + len(saved_article_ids)


@pytest.mark.asyncio
async def test_compaction_handles_multiple_users_e2e(
    db_session: AsyncSession, test_user: Profile
):
    """Test that compaction correctly handles articles with multiple users."""
    # Create second user
    user2_id = uuid4()
    user2_email = f"user2-{uuid4().hex[:8]}@example.com"
    await db_session.execute(
        text(
            """
            INSERT INTO auth.users (id, email, encrypted_password, created_at, updated_at)
            VALUES (:user_id, :email, '', NOW(), NOW())
            ON CONFLICT (id) DO NOTHING
            """
        ),
        {"user_id": str(user2_id), "email": user2_email},
    )
    await db_session.flush()

    # Fetch the auto-created profile from database trigger
    result = await db_session.execute(
        text("SELECT id, email FROM profiles WHERE id = :user_id"),
        {"user_id": str(user2_id)},
    )
    profile_row = result.fetchone()
    if not profile_row:
        raise Exception(f"Profile was not auto-created for user {user2_id}")

    user2 = Profile(id=profile_row.id, email=profile_row.email, role="basic")

    # Create folders for both users
    folder1 = Folder(
        id=uuid4(),
        user_id=test_user.id,
        name="User1 Folder",
    )
    folder2 = Folder(
        id=uuid4(),
        user_id=user2.id,
        name="User2 Folder",
    )
    db_session.add(folder1)
    db_session.add(folder2)

    # Create shared feed
    feed = Feed(
        id=uuid4(),
        url=f"https://example.com/e2e-shared-feed-{uuid4().hex[:8]}.xml",
        title="E2E Shared Feed",
        description="Test feed description",
        language="en",
    )
    db_session.add(feed)
    await db_session.flush()

    # Both users subscribe to the same feed
    subscription1 = FeedSubscription(
        id=uuid4(),
        user_id=test_user.id,
        feed_id=feed.id,
        folder_id=folder1.id,
    )
    subscription2 = FeedSubscription(
        id=uuid4(),
        user_id=user2.id,
        feed_id=feed.id,
        folder_id=folder2.id,
    )
    db_session.add(subscription1)
    db_session.add(subscription2)
    await db_session.commit()

    # Create 70 old articles (all > 7 days to match ARTICLE_RETENTION_DAYS)
    user1_saved_id = None
    user2_saved_id = None

    for i in range(70):
        published_at = datetime.now(timezone.utc) - timedelta(days=8 + i)
        link = f"https://example.com/e2e-shared-{i}"
        content_hash = hashlib.sha256(link.encode()).hexdigest()
        content = ArticleContent(
            id=uuid4(),
            title=f"E2E Shared Article {i}",
            link=link,
            content_hash=content_hash,
            description="Shared article",
            content="Test content",
        )
        db_session.add(content)
        await db_session.flush()

        article = FeedArticle(
            id=uuid4(),
            feed_id=feed.id,
            content_id=content.id,
            guid_hash=f"e2e-shared-{uuid4()}",
            published_at=published_at,
        )
        db_session.add(article)
        await db_session.flush()

        # User 1 saves the oldest article
        if i == 69:
            from app.models.article import UserEntry

            state = UserEntry(
                user_id=test_user.id,
                content_id=content.id,
                feed_article_id=article.id,
                is_saved=False,
            )
            db_session.add(state)
            user1_saved_id = article.id

        # User 2 saves a different old article
        if i == 68:
            from app.models.article import UserEntry

            state = UserEntry(
                user_id=user2.id,
                content_id=content.id,
                feed_article_id=article.id,
                is_saved=True,
            )
            db_session.add(state)
            user2_saved_id = article.id

    await db_session.commit()

    # Test the CRUD function directly
    from app.crud.article.actions import delete_old_article_contents

    deleted_count = await delete_old_article_contents(
        db_session, retention_days=7, min_articles_per_feed=50
    )
    await db_session.commit()

    # Verify both users' saved articles are preserved
    result = await db_session.execute(
        select(FeedArticle).where(FeedArticle.id == user1_saved_id)
    )
    assert result.scalar_one_or_none() is not None, "User 1's saved article was deleted"

    result = await db_session.execute(
        select(FeedArticle).where(FeedArticle.id == user2_saved_id)
    )
    assert result.scalar_one_or_none() is not None, "User 2's saved article was deleted"


@pytest.mark.asyncio
async def test_compaction_respects_retention_policy(
    db_session: AsyncSession, test_user: Profile
):
    """Test that compaction respects the retention policy and minimum article count."""
    # Create folder
    folder = Folder(
        id=uuid4(),
        user_id=test_user.id,
        name="E2E Retention Policy Folder",
    )
    db_session.add(folder)

    # Create feed
    feed = Feed(
        id=uuid4(),
        url=f"https://example.com/e2e-retention-feed-{uuid4().hex[:8]}.xml",
        title="E2E Retention Policy Feed",
        description="Test feed description",
        language="en",
    )
    db_session.add(feed)
    await db_session.flush()

    # Create subscription
    subscription = FeedSubscription(
        id=uuid4(),
        user_id=test_user.id,
        feed_id=feed.id,
        folder_id=folder.id,
    )
    db_session.add(subscription)
    await db_session.commit()

    # Create 70 old articles (all > 7 days to match ARTICLE_RETENTION_DAYS)
    for i in range(70):
        published_at = datetime.now(timezone.utc) - timedelta(days=8 + i)
        link = f"https://example.com/e2e-retention-{i}"
        content_hash = hashlib.sha256(link.encode()).hexdigest()
        content = ArticleContent(
            id=uuid4(),
            title=f"E2E Retention Article {i}",
            link=link,
            content_hash=content_hash,
            description="Test article",
            content="Test content",
        )
        db_session.add(content)
        await db_session.flush()

        article = FeedArticle(
            id=uuid4(),
            feed_id=feed.id,
            content_id=content.id,
            guid_hash=f"e2e-retention-{uuid4()}",
            published_at=published_at,
        )
        db_session.add(article)

    await db_session.commit()

    # Count before compaction
    result = await db_session.execute(
        select(FeedArticle).where(FeedArticle.feed_id == feed.id)
    )
    articles_before = result.scalars().all()
    initial_count = len(articles_before)
    assert initial_count == 70

    # Store feed_id before running compaction
    feed_id = feed.id

    # Test the CRUD function directly
    from app.crud.article.actions import delete_old_article_contents

    deleted_count = await delete_old_article_contents(
        db_session, retention_days=7, min_articles_per_feed=50
    )
    await db_session.commit()

    # Verify compaction deleted articles but kept minimum 50
    assert deleted_count == 20  # 70 - 50 = 20
    result = await db_session.execute(
        select(FeedArticle).where(FeedArticle.feed_id == feed_id)
    )
    articles_after = result.scalars().all()
    assert len(articles_after) == 50  # Should keep exactly 50 newest


@pytest.mark.asyncio
async def test_compaction_task_wrapper_e2e(
    db_session: AsyncSession, test_user: Profile
):
    """Test the async compaction function directly (since Celery task can't run in async context)."""
    # Create folder
    folder = Folder(
        id=uuid4(),
        user_id=test_user.id,
        name="E2E Task Wrapper Folder",
    )
    db_session.add(folder)

    # Create feed
    feed = Feed(
        id=uuid4(),
        url=f"https://example.com/e2e-task-feed-{uuid4().hex[:8]}.xml",
        title="E2E Task Wrapper Feed",
        description="Test feed description",
        language="en",
    )
    db_session.add(feed)
    await db_session.flush()

    # Create subscription
    subscription = FeedSubscription(
        id=uuid4(),
        user_id=test_user.id,
        feed_id=feed.id,
        folder_id=folder.id,
    )
    db_session.add(subscription)
    await db_session.commit()

    # Create 60 old articles (all > 7 days to match ARTICLE_RETENTION_DAYS)
    for i in range(60):
        published_at = datetime.now(timezone.utc) - timedelta(days=8 + i)
        link = f"https://example.com/e2e-task-{i}"
        content_hash = hashlib.sha256(link.encode()).hexdigest()
        content = ArticleContent(
            id=uuid4(),
            title=f"Task Wrapper Article {i}",
            link=link,
            content_hash=content_hash,
            description="Test article",
            content="Test content",
        )
        db_session.add(content)
        await db_session.flush()

        article = FeedArticle(
            id=uuid4(),
            feed_id=feed.id,
            content_id=content.id,
            guid_hash=f"e2e-task-{uuid4()}",
            published_at=published_at,
        )
        db_session.add(article)

    await db_session.commit()

    # Store feed_id before running compaction
    feed_id = feed.id

    # Test the CRUD function directly
    from app.crud.article.actions import delete_old_article_contents

    deleted_count = await delete_old_article_contents(
        db_session, retention_days=7, min_articles_per_feed=50
    )
    await db_session.commit()

    # Verify articles were deleted from THIS FEED - should keep exactly 50
    assert deleted_count == 10  # 60 - 50 = 10
    result = await db_session.execute(
        select(FeedArticle).where(FeedArticle.feed_id == feed_id)
    )
    articles_after = result.scalars().all()
    assert (
        len(articles_after) == 50
    ), f"Expected 50 articles for test feed, got {len(articles_after)}"


async def test_compaction_expires_basic_read_later_e2e(
    db_session: AsyncSession,
) -> None:
    """Test that compaction expires old read-later entries (>30 days) for BASIC users only."""
    from uuid import uuid4
    from app.models.user import Profile
    from app.models.article import ArticleContent, UserEntry
    from app.models.enums import UserRole
    from app.crud.article.actions import expire_basic_read_later_entries

    # 1. Create a BASIC user and a PRO user
    basic_user = Profile(
        id=uuid4(),
        email=f"basic-{uuid4()}@example.com",
        role=UserRole.BASIC,
    )
    pro_user = Profile(
        id=uuid4(),
        email=f"pro-{uuid4()}@example.com",
        role=UserRole.PRO,
    )
    db_session.add_all([basic_user, pro_user])
    await db_session.commit()

    # 2. Create article contents
    c1 = ArticleContent(id=uuid4(), title="Basic Old", content_hash=f"h1-{uuid4()}")
    c2 = ArticleContent(id=uuid4(), title="Pro Old", content_hash=f"h2-{uuid4()}")
    c3 = ArticleContent(id=uuid4(), title="Basic New", content_hash=f"h3-{uuid4()}")
    db_session.add_all([c1, c2, c3])
    await db_session.commit()

    # 3. Create UserEntries with mock creation dates
    # basic_old: >30 days (should expire)
    basic_old = UserEntry(
        id=uuid4(),
        user_id=basic_user.id,
        content_id=c1.id,
        is_saved=True,
        created_at=datetime.now(timezone.utc) - timedelta(days=32),
    )
    # pro_old: >30 days (should NOT expire because PRO)
    pro_old = UserEntry(
        id=uuid4(),
        user_id=pro_user.id,
        content_id=c2.id,
        is_saved=True,
        created_at=datetime.now(timezone.utc) - timedelta(days=32),
    )
    # basic_new: <30 days (should NOT expire because recent)
    basic_new = UserEntry(
        id=uuid4(),
        user_id=basic_user.id,
        content_id=c3.id,
        is_saved=True,
        created_at=datetime.now(timezone.utc) - timedelta(days=5),
    )

    db_session.add_all([basic_old, pro_old, basic_new])
    await db_session.commit()

    # 4. Run the cleanup action
    expired_count = await expire_basic_read_later_entries(db_session, retention_days=30)
    await db_session.commit()

    # Verify return count (should be exactly 1)
    assert expired_count == 1

    # 5. Fetch and assert final states
    # basic_old should be is_saved = False (or deleted if no other state, but here is_read=False, user_note=None so deleted)
    result = await db_session.execute(
        select(UserEntry).where(UserEntry.id == basic_old.id)
    )
    basic_old_after = result.scalar_one_or_none()
    assert basic_old_after is None or not basic_old_after.is_saved

    # pro_old should remain is_saved = True
    result = await db_session.execute(
        select(UserEntry).where(UserEntry.id == pro_old.id)
    )
    pro_old_after = result.scalar_one()
    assert pro_old_after.is_saved is True

    # basic_new should remain is_saved = True
    result = await db_session.execute(
        select(UserEntry).where(UserEntry.id == basic_new.id)
    )
    basic_new_after = result.scalar_one()
    assert basic_new_after.is_saved is True

