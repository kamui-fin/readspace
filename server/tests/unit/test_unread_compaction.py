"""Unit tests for unread compaction logic."""

from datetime import datetime, timedelta, timezone
from uuid import uuid4

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Feed, FeedSubscription, Folder, Profile
from app.workers.feed_tasks import async_compact_unread_articles


@pytest.mark.asyncio
async def test_compact_unread_advances_old_cutoffs(db: AsyncSession):
    """Should advance cutoffs that are older than retention period."""
    # Create a test user
    user = Profile(
        id=uuid4(),
        email="compact1@example.com",
        display_name="Compact Test User",
    )
    db.add(user)

    # Create a folder
    folder = Folder(
        id=uuid4(),
        user_id=user.id,
        name="Compact Test Folder",
    )
    db.add(folder)

    # Create a feed
    feed = Feed(
        id=uuid4(),
        url="https://example.com/compact-feed.xml",
        title="Compact Test Feed",
    )
    db.add(feed)
    await db.flush()

    # Create subscription with old cutoff (60 days ago)
    now = datetime.now(timezone.utc)
    old_cutoff = now - timedelta(days=60)
    subscription = FeedSubscription(
        id=uuid4(),
        user_id=user.id,
        feed_id=feed.id,
        folder_id=folder.id,
        is_favorite=False,
        last_read_cutoff=old_cutoff,
    )
    db.add(subscription)
    await db.commit()

    # Run compaction (should advance to 30 days ago)
    result = await async_compact_unread_articles()

    assert result["updated_subscriptions"] > 0

    # Verify cutoff was advanced
    await db.refresh(subscription)
    assert subscription.last_read_cutoff is not None
    assert subscription.last_read_cutoff > old_cutoff

    # Should be approximately 30 days ago (UNREAD_RETENTION_DAYS)
    expected_cutoff = now - timedelta(days=30)
    time_diff = abs((subscription.last_read_cutoff - expected_cutoff).total_seconds())
    assert time_diff < 5  # Within 5 seconds


@pytest.mark.asyncio
async def test_compact_unread_does_not_move_recent_cutoffs_backward(db: AsyncSession):
    """Should not move cutoffs backward if they're already recent."""
    # Create a test user
    user = Profile(
        id=uuid4(),
        email="compact2@example.com",
        display_name="Compact Test User 2",
    )
    db.add(user)

    # Create a folder
    folder = Folder(
        id=uuid4(),
        user_id=user.id,
        name="Compact Test Folder 2",
    )
    db.add(folder)

    # Create a feed
    feed = Feed(
        id=uuid4(),
        url="https://example.com/compact-feed2.xml",
        title="Compact Test Feed 2",
    )
    db.add(feed)
    await db.flush()

    # Create subscription with recent cutoff (5 days ago)
    now = datetime.now(timezone.utc)
    recent_cutoff = now - timedelta(days=5)
    subscription = FeedSubscription(
        id=uuid4(),
        user_id=user.id,
        feed_id=feed.id,
        folder_id=folder.id,
        is_favorite=False,
        last_read_cutoff=recent_cutoff,
    )
    db.add(subscription)
    await db.commit()

    # Store original cutoff for comparison
    original_cutoff = subscription.last_read_cutoff

    # Run compaction
    await async_compact_unread_articles()

    # Verify cutoff was NOT moved backward
    await db.refresh(subscription)
    assert subscription.last_read_cutoff == original_cutoff


@pytest.mark.asyncio
async def test_compact_unread_handles_null_cutoffs(db: AsyncSession):
    """Should set cutoff to retention window for subscriptions with NULL cutoffs."""
    # Create a test user
    user = Profile(
        id=uuid4(),
        email="compact3@example.com",
        display_name="Compact Test User 3",
    )
    db.add(user)

    # Create a folder
    folder = Folder(
        id=uuid4(),
        user_id=user.id,
        name="Compact Test Folder 3",
    )
    db.add(folder)

    # Create a feed
    feed = Feed(
        id=uuid4(),
        url="https://example.com/compact-feed3.xml",
        title="Compact Test Feed 3",
    )
    db.add(feed)
    await db.flush()

    # Create subscription with NULL cutoff
    subscription = FeedSubscription(
        id=uuid4(),
        user_id=user.id,
        feed_id=feed.id,
        folder_id=folder.id,
        is_favorite=False,
        last_read_cutoff=None,
    )
    db.add(subscription)
    await db.commit()

    # Run compaction
    result = await async_compact_unread_articles()

    assert result["updated_subscriptions"] > 0

    # Verify cutoff was set
    await db.refresh(subscription)
    assert subscription.last_read_cutoff is not None

    # Should be approximately 30 days ago
    now = datetime.now(timezone.utc)
    expected_cutoff = now - timedelta(days=30)
    time_diff = abs((subscription.last_read_cutoff - expected_cutoff).total_seconds())
    assert time_diff < 5  # Within 5 seconds


@pytest.mark.asyncio
async def test_compact_unread_updates_multiple_subscriptions(db: AsyncSession):
    """Should update all subscriptions with old cutoffs in one operation."""
    # Create a test user
    user = Profile(
        id=uuid4(),
        email="compact4@example.com",
        display_name="Compact Test User 4",
    )
    db.add(user)

    # Create a folder
    folder = Folder(
        id=uuid4(),
        user_id=user.id,
        name="Compact Test Folder 4",
    )
    db.add(folder)

    # Create multiple feeds with old cutoffs
    now = datetime.now(timezone.utc)
    old_cutoff = now - timedelta(days=60)
    subscription_count = 5

    for i in range(subscription_count):
        feed = Feed(
            id=uuid4(),
            url=f"https://example.com/compact-feed-{i}.xml",
            title=f"Compact Feed {i}",
        )
        db.add(feed)
        await db.flush()

        subscription = FeedSubscription(
            id=uuid4(),
            user_id=user.id,
            feed_id=feed.id,
            folder_id=folder.id,
            is_favorite=False,
            last_read_cutoff=old_cutoff,
        )
        db.add(subscription)

    await db.commit()

    # Run compaction
    result = await async_compact_unread_articles()

    # Should update at least our subscriptions (may update others from other tests)
    assert result["updated_subscriptions"] >= subscription_count
