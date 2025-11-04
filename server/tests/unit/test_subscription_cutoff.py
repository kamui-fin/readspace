"""Unit tests for subscription last_read_cutoff functionality."""

from datetime import datetime, timedelta, timezone
from uuid import uuid4

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud.subscription import get_initial_cutoff_timestamp
from app.models import ArticleContent, Feed, FeedArticle, FeedSubscription, Folder


@pytest.mark.asyncio
async def test_get_initial_cutoff_timestamp_with_enough_articles(db: AsyncSession):
    """Should return the 10th most recent article's timestamp when feed has >=10 articles."""
    # Create a test user and folder
    from app.models import Profile

    user = Profile(
        id=uuid4(),
        email="test@example.com",
        display_name="Test User",
    )
    db.add(user)

    folder = Folder(
        id=uuid4(),
        user_id=user.id,
        name="Test Folder",
    )
    db.add(folder)

    # Create a test feed
    feed = Feed(
        id=uuid4(),
        url="https://example.com/feed.xml",
        title="Test Feed",
    )
    db.add(feed)
    await db.flush()

    # Create 15 articles with published_at timestamps
    now = datetime.now(timezone.utc)
    for i in range(15):
        content = ArticleContent(
            id=uuid4(),
            title=f"Article {i}",
            link=f"https://example.com/article/{i}",
            published_at=now - timedelta(days=i),  # Most recent first
        )
        db.add(content)
        await db.flush()

        article = FeedArticle(
            id=uuid4(),
            feed_id=feed.id,
            content_id=content.id,
            guid=f"article-{i}",
        )
        db.add(article)

    await db.commit()

    # Get the cutoff timestamp (should be 10th most recent = day 9)
    cutoff = await get_initial_cutoff_timestamp(db, feed_id=feed.id, initial_unread_count=10)

    # Verify it's the 10th article (index 9, since 0-indexed)
    expected_cutoff = now - timedelta(days=9)
    assert cutoff is not None
    # Allow 1 second difference for test timing
    assert abs((cutoff - expected_cutoff).total_seconds()) < 1


@pytest.mark.asyncio
async def test_get_initial_cutoff_timestamp_with_fewer_articles(db: AsyncSession):
    """Should return None when feed has fewer than 10 articles."""
    # Create a test user and folder
    from app.models import Profile

    user = Profile(
        id=uuid4(),
        email="test2@example.com",
        display_name="Test User 2",
    )
    db.add(user)

    folder = Folder(
        id=uuid4(),
        user_id=user.id,
        name="Test Folder 2",
    )
    db.add(folder)

    # Create a test feed
    feed = Feed(
        id=uuid4(),
        url="https://example.com/feed2.xml",
        title="Test Feed 2",
    )
    db.add(feed)
    await db.flush()

    # Create only 5 articles
    now = datetime.now(timezone.utc)
    for i in range(5):
        content = ArticleContent(
            id=uuid4(),
            title=f"Article {i}",
            link=f"https://example.com/article2/{i}",
            published_at=now - timedelta(days=i),
        )
        db.add(content)
        await db.flush()

        article = FeedArticle(
            id=uuid4(),
            feed_id=feed.id,
            content_id=content.id,
            guid=f"article2-{i}",
        )
        db.add(article)

    await db.commit()

    # Get the cutoff timestamp (should be None since we have < 10 articles)
    cutoff = await get_initial_cutoff_timestamp(db, feed_id=feed.id, initial_unread_count=10)

    assert cutoff is None


@pytest.mark.asyncio
async def test_subscription_created_with_cutoff(db: AsyncSession):
    """Should set last_read_cutoff when creating a new subscription."""
    from app.crud.subscription import create_subscription
    from app.models import Profile
    from app.schemas.subscriptions import SubscriptionCreate

    # Create a test user
    user = Profile(
        id=uuid4(),
        email="test3@example.com",
        display_name="Test User 3",
    )
    db.add(user)

    # Create a folder
    folder = Folder(
        id=uuid4(),
        user_id=user.id,
        name="Test Folder 3",
    )
    db.add(folder)

    # Create a feed with 15 articles
    feed = Feed(
        id=uuid4(),
        url="https://example.com/feed3.xml",
        title="Test Feed 3",
    )
    db.add(feed)
    await db.flush()

    now = datetime.now(timezone.utc)
    for i in range(15):
        content = ArticleContent(
            id=uuid4(),
            title=f"Article {i}",
            link=f"https://example.com/article3/{i}",
            published_at=now - timedelta(days=i),
        )
        db.add(content)
        await db.flush()

        article = FeedArticle(
            id=uuid4(),
            feed_id=feed.id,
            content_id=content.id,
            guid=f"article3-{i}",
        )
        db.add(article)

    await db.commit()

    # Create subscription
    subscription_data = SubscriptionCreate(
        url=feed.url,
        folder_id=folder.id,
        is_favorite=False,
    )

    subscription = await create_subscription(
        db=db,
        subscription_in=subscription_data,
        user_id=user.id,
        feed_db=feed,
    )

    # Verify last_read_cutoff was set
    assert subscription.last_read_cutoff is not None

    # Should be around the 10th article's timestamp
    expected_cutoff = now - timedelta(days=9)
    assert abs((subscription.last_read_cutoff - expected_cutoff).total_seconds()) < 1


@pytest.mark.asyncio
async def test_subscription_created_with_null_cutoff_for_small_feed(db: AsyncSession):
    """Should set last_read_cutoff to None for feeds with < 10 articles."""
    from app.crud.subscription import create_subscription
    from app.models import Profile
    from app.schemas.subscriptions import SubscriptionCreate

    # Create a test user
    user = Profile(
        id=uuid4(),
        email="test4@example.com",
        display_name="Test User 4",
    )
    db.add(user)

    # Create a folder
    folder = Folder(
        id=uuid4(),
        user_id=user.id,
        name="Test Folder 4",
    )
    db.add(folder)

    # Create a feed with only 3 articles
    feed = Feed(
        id=uuid4(),
        url="https://example.com/feed4.xml",
        title="Test Feed 4",
    )
    db.add(feed)
    await db.flush()

    now = datetime.now(timezone.utc)
    for i in range(3):
        content = ArticleContent(
            id=uuid4(),
            title=f"Article {i}",
            link=f"https://example.com/article4/{i}",
            published_at=now - timedelta(days=i),
        )
        db.add(content)
        await db.flush()

        article = FeedArticle(
            id=uuid4(),
            feed_id=feed.id,
            content_id=content.id,
            guid=f"article4-{i}",
        )
        db.add(article)

    await db.commit()

    # Create subscription
    subscription_data = SubscriptionCreate(
        url=feed.url,
        folder_id=folder.id,
        is_favorite=False,
    )

    subscription = await create_subscription(
        db=db,
        subscription_in=subscription_data,
        user_id=user.id,
        feed_db=feed,
    )

    # Verify last_read_cutoff is None (all 3 articles should be unread)
    assert subscription.last_read_cutoff is None
