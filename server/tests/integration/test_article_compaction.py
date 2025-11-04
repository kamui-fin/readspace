"""End-to-end tests for article compaction task."""

from datetime import datetime, timedelta, timezone
from uuid import uuid4

import pytest
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import ArticleContent, Feed, FeedArticle, FeedSubscription, Folder, Profile, UserArticleState
from app.workers.feed_tasks import async_compact_old_articles, compact_old_articles_task


@pytest.mark.asyncio
async def test_compaction_task_deletes_old_articles_e2e(db_session: AsyncSession, test_user: Profile):
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

    # Create 70 old articles (all > 30 days)
    article_ids = []
    for i in range(70):
        published_at = datetime.now(timezone.utc) - timedelta(days=31 + i)
        content = ArticleContent(
            id=uuid4(),
            title=f"E2E Old Article {i}",
            link=f"https://example.com/e2e-old-{i}",
            description="Test article for E2E compaction",
            content="Test content",
            published_at=published_at,
        )
        db_session.add(content)
        await db_session.flush()

        article = FeedArticle(
            id=uuid4(),
            feed_id=feed.id,
            content_id=content.id,
            guid=f"e2e-old-{uuid4()}",
            created_at=published_at,
        )
        db_session.add(article)
        await db_session.flush()
        article_ids.append(article.id)

    await db_session.commit()

    # Verify initial count
    result = await db_session.execute(select(FeedArticle).where(FeedArticle.feed_id == feed.id))
    articles_before = result.scalars().all()
    assert len(articles_before) == 70

    # Run compaction task
    result = await async_compact_old_articles(db=db_session)

    # Commit to persist the changes
    await db_session.commit()

    # Verify final count for THIS FEED - should keep exactly 50 newest
    from sqlalchemy.orm import selectinload

    result = await db_session.execute(
        select(FeedArticle).where(FeedArticle.feed_id == feed.id).options(selectinload(FeedArticle.content))
    )
    articles_after = result.scalars().all()
    assert len(articles_after) == 50, f"Expected 50 articles for test feed, got {len(articles_after)}"

    # Verify the oldest articles were deleted and newest were kept
    # The remaining articles should be the 50 newest ones (indices 0-49)
    remaining_titles = {article.content.title for article in articles_after if article.content}
    for i in range(50):
        expected_title = f"E2E Old Article {i}"
        assert expected_title in remaining_titles, f"Expected {expected_title} to be kept"


@pytest.mark.asyncio
async def test_compaction_preserves_user_saved_articles_e2e(db_session: AsyncSession, test_user: Profile):
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

    # Create 70 old articles
    saved_article_ids = []
    for i in range(70):
        published_at = datetime.now(timezone.utc) - timedelta(days=31 + i)
        content = ArticleContent(
            id=uuid4(),
            title=f"E2E Article {i}",
            link=f"https://example.com/e2e-saved-{i}",
            description="Test article",
            content="Test content",
            published_at=published_at,
        )
        db_session.add(content)
        await db_session.flush()

        article = FeedArticle(
            id=uuid4(),
            feed_id=feed.id,
            content_id=content.id,
            guid=f"e2e-saved-{uuid4()}",
            created_at=published_at,
        )
        db_session.add(article)
        await db_session.flush()

        # Mark the oldest 5 articles (which would normally be deleted) as saved
        if i >= 65:  # These are the oldest 5
            state = UserArticleState(
                id=uuid4(),
                user_id=test_user.id,
                article_id=article.id,
                is_read_later=True,
                is_favorite=False,
            )
            db_session.add(state)
            saved_article_ids.append(article.id)

    await db_session.commit()

    # Run compaction
    result = await async_compact_old_articles(db=db_session)

    # Verify all saved articles still exist
    for saved_id in saved_article_ids:
        result = await db_session.execute(select(FeedArticle).where(FeedArticle.id == saved_id))
        article = result.scalar_one_or_none()
        assert article is not None, f"Saved article {saved_id} was deleted"

    # Verify we kept at least 50 articles plus the saved ones
    result = await db_session.execute(select(FeedArticle).where(FeedArticle.feed_id == feed.id))
    remaining_articles = result.scalars().all()
    assert len(remaining_articles) >= 50 + len(saved_article_ids)


@pytest.mark.asyncio
async def test_compaction_handles_multiple_users_e2e(db_session: AsyncSession, test_user: Profile):
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
        {"user_id": str(user2_id)}
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

    # Create 70 old articles
    user1_saved_id = None
    user2_saved_id = None

    for i in range(70):
        published_at = datetime.now(timezone.utc) - timedelta(days=31 + i)
        content = ArticleContent(
            id=uuid4(),
            title=f"E2E Shared Article {i}",
            link=f"https://example.com/e2e-shared-{i}",
            description="Shared article",
            content="Test content",
            published_at=published_at,
        )
        db_session.add(content)
        await db_session.flush()

        article = FeedArticle(
            id=uuid4(),
            feed_id=feed.id,
            content_id=content.id,
            guid=f"e2e-shared-{uuid4()}",
            created_at=published_at,
        )
        db_session.add(article)
        await db_session.flush()

        # User 1 saves the oldest article
        if i == 69:
            state = UserArticleState(
                id=uuid4(),
                user_id=test_user.id,
                article_id=article.id,
                is_favorite=True,
                is_read_later=False,
            )
            db_session.add(state)
            user1_saved_id = article.id

        # User 2 saves a different old article
        if i == 68:
            state = UserArticleState(
                id=uuid4(),
                user_id=user2.id,
                article_id=article.id,
                is_read_later=True,
                is_favorite=False,
            )
            db_session.add(state)
            user2_saved_id = article.id

    await db_session.commit()

    # Run compaction
    result = await async_compact_old_articles(db=db_session)

    # Verify both users' saved articles are preserved
    result = await db_session.execute(select(FeedArticle).where(FeedArticle.id == user1_saved_id))
    assert result.scalar_one_or_none() is not None, "User 1's saved article was deleted"

    result = await db_session.execute(select(FeedArticle).where(FeedArticle.id == user2_saved_id))
    assert result.scalar_one_or_none() is not None, "User 2's saved article was deleted"


@pytest.mark.asyncio
async def test_compaction_respects_retention_policy(db_session: AsyncSession, test_user: Profile):
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

    # Create 70 old articles (all > 30 days old)
    for i in range(70):
        published_at = datetime.now(timezone.utc) - timedelta(days=31 + i)
        content = ArticleContent(
            id=uuid4(),
            title=f"E2E Retention Article {i}",
            link=f"https://example.com/e2e-retention-{i}",
            description="Test article",
            content="Test content",
            published_at=published_at,
        )
        db_session.add(content)
        await db_session.flush()

        article = FeedArticle(
            id=uuid4(),
            feed_id=feed.id,
            content_id=content.id,
            guid=f"e2e-retention-{uuid4()}",
            created_at=published_at,
        )
        db_session.add(article)

    await db_session.commit()

    # Count before compaction
    result = await db_session.execute(select(FeedArticle).where(FeedArticle.feed_id == feed.id))
    articles_before = result.scalars().all()
    initial_count = len(articles_before)
    assert initial_count == 70

    # Run compaction
    result = await async_compact_old_articles(db=db_session)

    # Verify compaction deleted articles but kept minimum 50
    assert "deleted_articles" in result
    result = await db_session.execute(select(FeedArticle).where(FeedArticle.feed_id == feed.id))
    articles_after = result.scalars().all()
    assert len(articles_after) == 50  # Should keep exactly 50 newest


@pytest.mark.asyncio
async def test_compaction_task_wrapper_e2e(db_session: AsyncSession, test_user: Profile):
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

    # Create 60 old articles
    for i in range(60):
        published_at = datetime.now(timezone.utc) - timedelta(days=31 + i)
        content = ArticleContent(
            id=uuid4(),
            title=f"Task Wrapper Article {i}",
            link=f"https://example.com/e2e-task-{i}",
            description="Test article",
            content="Test content",
            published_at=published_at,
        )
        db_session.add(content)
        await db_session.flush()

        article = FeedArticle(
            id=uuid4(),
            feed_id=feed.id,
            content_id=content.id,
            guid=f"e2e-task-{uuid4()}",
            created_at=published_at,
        )
        db_session.add(article)

    await db_session.commit()

    # Call the async function directly instead of the Celery task wrapper
    # (Celery tasks can't run in an existing event loop)
    result = await async_compact_old_articles(db=db_session)

    # Should return results dictionary
    assert "deleted_articles" in result

    # Commit the changes made by the compaction function
    await db_session.commit()

    # Verify articles were deleted from THIS FEED - should keep exactly 50
    result = await db_session.execute(select(FeedArticle).where(FeedArticle.feed_id == feed.id))
    articles_after = result.scalars().all()
    assert len(articles_after) == 50, f"Expected 50 articles for test feed, got {len(articles_after)}"
