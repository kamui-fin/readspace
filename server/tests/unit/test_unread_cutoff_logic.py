"""Unit tests for unread article counting with last_read_cutoff logic."""

from datetime import datetime, timedelta, timezone
from uuid import uuid4

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud.article.article_specialized_queries import ArticleSpecializedQueries
from app.models import ArticleContent, Feed, FeedArticle, FeedSubscription, Folder, Profile, UserArticleState


@pytest.mark.asyncio
async def test_count_unread_respects_cutoff(db: AsyncSession):
    """Should only count articles newer than last_read_cutoff as unread."""
    # Create a test user
    user = Profile(
        id=uuid4(),
        email="unread1@example.com",
        display_name="Test User",
    )
    db.add(user)

    # Create a folder
    folder = Folder(
        id=uuid4(),
        user_id=user.id,
        name="Test Folder",
    )
    db.add(folder)

    # Create a feed
    feed = Feed(
        id=uuid4(),
        url="https://example.com/unread-feed.xml",
        title="Unread Test Feed",
    )
    db.add(feed)
    await db.flush()

    # Create 15 articles, published over 15 days
    now = datetime.now(timezone.utc)
    articles = []
    for i in range(15):
        content = ArticleContent(
            id=uuid4(),
            title=f"Article {i}",
            link=f"https://example.com/unread/{i}",
            published_at=now - timedelta(days=i),
        )
        db.add(content)
        await db.flush()

        article = FeedArticle(
            id=uuid4(),
            feed_id=feed.id,
            content_id=content.id,
            guid=f"unread-article-{i}",
        )
        db.add(article)
        articles.append(article)
        await db.flush()

    # Create subscription with cutoff set to 10 days ago
    # This means articles 0-9 (10 articles) should be unread
    cutoff_date = now - timedelta(days=9)
    subscription = FeedSubscription(
        id=uuid4(),
        user_id=user.id,
        feed_id=feed.id,
        folder_id=folder.id,
        is_favorite=False,
        last_read_cutoff=cutoff_date,
    )
    db.add(subscription)
    await db.commit()

    # Count unread articles
    unread_count = await ArticleSpecializedQueries.count_unread_articles(db, user_id=user.id)

    # Should have 10 unread articles (days 0-9)
    assert unread_count == 10


@pytest.mark.asyncio
async def test_count_unread_with_null_cutoff_shows_all(db: AsyncSession):
    """Should count all articles as unread when cutoff is NULL."""
    # Create a test user
    user = Profile(
        id=uuid4(),
        email="unread2@example.com",
        display_name="Test User 2",
    )
    db.add(user)

    # Create a folder
    folder = Folder(
        id=uuid4(),
        user_id=user.id,
        name="Test Folder 2",
    )
    db.add(folder)

    # Create a feed
    feed = Feed(
        id=uuid4(),
        url="https://example.com/unread-feed2.xml",
        title="Unread Test Feed 2",
    )
    db.add(feed)
    await db.flush()

    # Create 5 articles
    now = datetime.now(timezone.utc)
    for i in range(5):
        content = ArticleContent(
            id=uuid4(),
            title=f"Article {i}",
            link=f"https://example.com/unread2/{i}",
            published_at=now - timedelta(days=i),
        )
        db.add(content)
        await db.flush()

        article = FeedArticle(
            id=uuid4(),
            feed_id=feed.id,
            content_id=content.id,
            guid=f"unread2-article-{i}",
        )
        db.add(article)

    # Create subscription with NULL cutoff
    subscription = FeedSubscription(
        id=uuid4(),
        user_id=user.id,
        feed_id=feed.id,
        folder_id=folder.id,
        is_favorite=False,
        last_read_cutoff=None,  # NULL means all articles are unread
    )
    db.add(subscription)
    await db.commit()

    # Count unread articles
    unread_count = await ArticleSpecializedQueries.count_unread_articles(db, user_id=user.id)

    # Should have all 5 articles as unread
    assert unread_count == 5


@pytest.mark.asyncio
async def test_explicit_read_state_overrides_cutoff(db: AsyncSession):
    """Should respect explicit read states even for articles newer than cutoff."""
    # Create a test user
    user = Profile(
        id=uuid4(),
        email="unread3@example.com",
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

    # Create a feed
    feed = Feed(
        id=uuid4(),
        url="https://example.com/unread-feed3.xml",
        title="Unread Test Feed 3",
    )
    db.add(feed)
    await db.flush()

    # Create 10 articles
    now = datetime.now(timezone.utc)
    articles = []
    for i in range(10):
        content = ArticleContent(
            id=uuid4(),
            title=f"Article {i}",
            link=f"https://example.com/unread3/{i}",
            published_at=now - timedelta(days=i),
        )
        db.add(content)
        await db.flush()

        article = FeedArticle(
            id=uuid4(),
            feed_id=feed.id,
            content_id=content.id,
            guid=f"unread3-article-{i}",
        )
        db.add(article)
        articles.append(article)
        await db.flush()

    # Create subscription with cutoff set to 5 days ago
    # Without explicit states, articles 0-4 (5 articles) would be unread
    cutoff_date = now - timedelta(days=4)
    subscription = FeedSubscription(
        id=uuid4(),
        user_id=user.id,
        feed_id=feed.id,
        folder_id=folder.id,
        is_favorite=False,
        last_read_cutoff=cutoff_date,
    )
    db.add(subscription)
    await db.flush()

    # Explicitly mark article 1 (newer than cutoff) as read
    state = UserArticleState(
        id=uuid4(),
        user_id=user.id,
        article_id=articles[1].id,
        is_read=True,
        read_at=now,
    )
    db.add(state)

    await db.commit()

    # Count unread articles
    unread_count = await ArticleSpecializedQueries.count_unread_articles(db, user_id=user.id)

    # Should have 4 unread articles (articles 0, 2, 3, 4)
    # Article 1 is explicitly marked as read despite being newer than cutoff
    assert unread_count == 4


@pytest.mark.asyncio
async def test_get_all_unread_counts_respects_cutoff(db: AsyncSession):
    """Should return correct unread counts by folder with cutoff logic."""
    # Create a test user
    user = Profile(
        id=uuid4(),
        email="unread4@example.com",
        display_name="Test User 4",
    )
    db.add(user)

    # Create two folders
    folder1 = Folder(
        id=uuid4(),
        user_id=user.id,
        name="Folder 1",
    )
    folder2 = Folder(
        id=uuid4(),
        user_id=user.id,
        name="Folder 2",
    )
    db.add(folder1)
    db.add(folder2)
    await db.flush()

    # Create two feeds
    feed1 = Feed(
        id=uuid4(),
        url="https://example.com/feed-folder1.xml",
        title="Feed 1",
    )
    feed2 = Feed(
        id=uuid4(),
        url="https://example.com/feed-folder2.xml",
        title="Feed 2",
    )
    db.add(feed1)
    db.add(feed2)
    await db.flush()

    # Create articles for feed1 (10 articles, cutoff at day 5)
    now = datetime.now(timezone.utc)
    for i in range(10):
        content = ArticleContent(
            id=uuid4(),
            title=f"Feed1 Article {i}",
            link=f"https://example.com/feed1/{i}",
            published_at=now - timedelta(days=i),
        )
        db.add(content)
        await db.flush()

        article = FeedArticle(
            id=uuid4(),
            feed_id=feed1.id,
            content_id=content.id,
            guid=f"feed1-article-{i}",
        )
        db.add(article)

    # Create articles for feed2 (8 articles, cutoff at day 3)
    for i in range(8):
        content = ArticleContent(
            id=uuid4(),
            title=f"Feed2 Article {i}",
            link=f"https://example.com/feed2/{i}",
            published_at=now - timedelta(days=i),
        )
        db.add(content)
        await db.flush()

        article = FeedArticle(
            id=uuid4(),
            feed_id=feed2.id,
            content_id=content.id,
            guid=f"feed2-article-{i}",
        )
        db.add(article)

    # Create subscriptions with different cutoffs
    subscription1 = FeedSubscription(
        id=uuid4(),
        user_id=user.id,
        feed_id=feed1.id,
        folder_id=folder1.id,
        is_favorite=False,
        last_read_cutoff=now - timedelta(days=4),  # 5 unread articles (days 0-4)
    )
    subscription2 = FeedSubscription(
        id=uuid4(),
        user_id=user.id,
        feed_id=feed2.id,
        folder_id=folder2.id,
        is_favorite=False,
        last_read_cutoff=now - timedelta(days=2),  # 3 unread articles (days 0-2)
    )
    db.add(subscription1)
    db.add(subscription2)
    await db.commit()

    # Get all unread counts
    counts = await ArticleSpecializedQueries.get_all_unread_counts(db, user_id=user.id)

    # Verify total unread count
    assert counts["total_unread"] == 8  # 5 from folder1 + 3 from folder2

    # Verify folder-specific counts
    assert counts["unread_by_folder"][folder1.id] == 5
    assert counts["unread_by_folder"][folder2.id] == 3
