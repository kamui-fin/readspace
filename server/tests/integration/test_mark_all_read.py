"""End-to-end tests for mark all read functionality."""

import hashlib
from datetime import datetime, timedelta, timezone
from uuid import uuid4

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.article import ArticleContent, FeedArticle
from app.models.feed import Feed, FeedSubscription
from app.models.folder import Folder
from app.models.user import Profile


async def create_test_article(
    db_session: AsyncSession,
    feed_id: uuid4,
    title: str,
    link: str,
    published_at: datetime,
    guid: str,
) -> tuple[ArticleContent, FeedArticle]:
    """Helper to create article content and feed article with proper hashes."""
    content_hash = hashlib.sha256(link.encode()).hexdigest()
    guid_hash = hashlib.sha256(guid.encode()).hexdigest()

    content = ArticleContent(
        id=uuid4(),
        title=title,
        link=link,
        content_hash=content_hash,
    )
    db_session.add(content)
    await db_session.flush()  # Flush to get content.id

    article = FeedArticle(
        id=uuid4(),
        feed_id=feed_id,
        content_id=content.id,
        guid_hash=guid_hash,
        published_at=published_at,
    )
    db_session.add(article)

    return content, article


@pytest.mark.asyncio
async def test_mark_feed_all_read_e2e(
    async_client: AsyncClient, db_session: AsyncSession, test_user: Profile
):
    """Test marking all articles in a feed as read via API."""
    # Create a folder
    folder = Folder(
        id=uuid4(),
        user_id=test_user.id,
        name="Test Folder",
    )
    db_session.add(folder)

    # Create a feed with 15 articles
    feed = Feed(
        id=uuid4(),
        url="https://example.com/mark-read-feed.xml",
        title="Mark Read Test Feed",
        description="Test feed description",
        language="en",
    )
    db_session.add(feed)
    await db_session.flush()

    now = datetime.now(timezone.utc)
    for i in range(15):
        await create_test_article(
            db_session,
            feed.id,
            f"Article {i}",
            f"https://example.com/markread/{i}",
            now - timedelta(days=i),
            f"markread-article-{i}",
        )

    # Create subscription with cutoff set to show 10 unread
    cutoff_date = now - timedelta(days=9)
    subscription = FeedSubscription(
        id=uuid4(),
        user_id=test_user.id,
        feed_id=feed.id,
        folder_id=folder.id,
        is_favorite=False,
        last_read_cutoff=cutoff_date,
    )
    db_session.add(subscription)
    await db_session.commit()

    # Call mark all read endpoint
    response = await async_client.put(
        f"/api/feeds/{feed.id}/read-status",
    )

    assert response.status_code == 200
    data = response.json()
    assert data["message"] == "All articles marked as read"

    # Verify subscription was updated
    await db_session.refresh(subscription)
    assert subscription.last_read_cutoff is not None
    # Cutoff should be set to the most recent article's published_at (day 0)
    assert abs((subscription.last_read_cutoff - now).total_seconds()) < 2


@pytest.mark.asyncio
async def test_mark_folder_all_read_e2e(
    async_client: AsyncClient, db_session: AsyncSession, test_user: Profile
):
    """Test marking all articles in a folder as read via API."""
    # Create a folder
    folder = Folder(
        id=uuid4(),
        user_id=test_user.id,
        name="Test Folder for Mark All Read",
    )
    db_session.add(folder)
    await db_session.flush()

    # Create 2 feeds with articles
    now = datetime.now(timezone.utc)

    for feed_num in range(2):
        feed = Feed(
            id=uuid4(),
            url=f"https://example.com/folder-feed-{feed_num}.xml",
            title=f"Folder Feed {feed_num}",
            description="Test feed description",
            language="en",
        )
        db_session.add(feed)
        await db_session.flush()

        # Create 10 articles per feed
        for i in range(10):
            await create_test_article(
                db_session,
                feed.id,
                f"Feed {feed_num} Article {i}",
                f"https://example.com/folder/{feed_num}/{i}",
                now - timedelta(days=i),
                f"folder-feed{feed_num}-article-{i}",
            )

        # Create subscription with cutoff showing some unread
        subscription = FeedSubscription(
            id=uuid4(),
            user_id=test_user.id,
            feed_id=feed.id,
            folder_id=folder.id,
            is_favorite=False,
            last_read_cutoff=now - timedelta(days=5),  # 6 unread per feed
        )
        db_session.add(subscription)

    await db_session.commit()

    # Call mark folder all read endpoint
    response = await async_client.put(
        f"/api/folders/{folder.id}/read-status",
    )

    assert response.status_code == 200
    data = response.json()
    assert data["message"] == "All articles in folder marked as read"
    assert data["folder_id"] == str(folder.id)
    assert data["updated_subscriptions"] == 2

    # Verify both subscriptions were updated
    from sqlalchemy import select

    result = await db_session.execute(
        select(FeedSubscription).where(FeedSubscription.folder_id == folder.id)
    )
    subscriptions = result.scalars().all()

    assert len(subscriptions) == 2
    for sub in subscriptions:
        assert sub.last_read_cutoff is not None
        # Each should be set to its feed's most recent article (day 0)
        assert abs((sub.last_read_cutoff - now).total_seconds()) < 2


@pytest.mark.asyncio
async def test_mark_feed_all_read_returns_404_for_non_existent_subscription(
    async_client: AsyncClient, db_session: AsyncSession, test_user: Profile
):
    """Test that marking non-existent subscription returns 404."""
    non_existent_feed_id = uuid4()

    response = await async_client.put(
        f"/api/feeds/{non_existent_feed_id}/read-status",
    )

    assert response.status_code == 404
    assert "not found" in response.json()["message"].lower()


@pytest.mark.asyncio
async def test_mark_folder_all_read_returns_404_for_non_existent_folder(
    async_client: AsyncClient, db_session: AsyncSession, test_user: Profile
):
    """Test that marking non-existent folder returns 404."""
    non_existent_folder_id = uuid4()

    response = await async_client.put(
        f"/api/folders/{non_existent_folder_id}/read-status",
    )

    assert response.status_code == 404
    assert "not found" in response.json()["message"].lower()


@pytest.mark.asyncio
async def test_new_articles_after_mark_all_read_show_as_unread(
    async_client: AsyncClient, db_session: AsyncSession, test_user: Profile
):
    """Test that articles published after mark-all-read are still unread."""
    # Create a folder
    folder = Folder(
        id=uuid4(),
        user_id=test_user.id,
        name="Test Folder",
    )
    db_session.add(folder)

    # Create a feed with 5 articles
    feed = Feed(
        id=uuid4(),
        url="https://example.com/new-after-feed.xml",
        title="New After Feed",
        description="Test feed description",
        language="en",
    )
    db_session.add(feed)
    await db_session.flush()

    now = datetime.now(timezone.utc)
    for i in range(5):
        await create_test_article(
            db_session,
            feed.id,
            f"Old Article {i}",
            f"https://example.com/newafter/old/{i}",
            now - timedelta(days=i + 1),  # 1-5 days old
            f"old-article-{i}",
        )

    # Create subscription
    subscription = FeedSubscription(
        id=uuid4(),
        user_id=test_user.id,
        feed_id=feed.id,
        folder_id=folder.id,
        is_favorite=False,
        last_read_cutoff=None,  # All 5 articles are unread
    )
    db_session.add(subscription)
    await db_session.commit()

    # Mark all as read
    response = await async_client.put(
        f"/api/feeds/{feed.id}/read-status",
    )
    assert response.status_code == 200

    # Refresh subscription to get updated cutoff
    await db_session.refresh(subscription)
    cutoff_before_new_article = subscription.last_read_cutoff

    # Add a brand new article (published today)
    await create_test_article(
        db_session,
        feed.id,
        "Brand New Article",
        "https://example.com/newafter/new/0",
        now + timedelta(hours=1),  # Published after mark-all-read
        "new-article-0",
    )
    await db_session.commit()

    # Get unread counts - new article should be unread
    from app.crud.article.counts import count_total_unread_articles

    unread_count = await count_total_unread_articles(db_session, user_id=test_user.id)

    # Should have 1 unread article (the new one)
    assert unread_count == 1


@pytest.mark.asyncio
async def test_new_subscription_with_many_articles_shows_initial_unread_limit(
    async_client: AsyncClient, db_session: AsyncSession, test_user: Profile
):
    """Test that subscribing to a feed with >10 articles only shows 10 as unread initially."""
    from app.core.constants import INITIAL_UNREAD_COUNT
    from app.crud.article.counts import count_total_unread_articles

    # Create a folder
    folder = Folder(
        id=uuid4(),
        user_id=test_user.id,
        name="Test Folder",
    )
    db_session.add(folder)

    # Create a feed with 25 articles (more than INITIAL_UNREAD_COUNT)
    feed = Feed(
        id=uuid4(),
        url=f"https://example.com/many-articles-feed-{uuid4().hex[:8]}.xml",
        title="Many Articles Feed",
        description="Test feed description",
        language="en",
    )
    db_session.add(feed)
    await db_session.flush()

    now = datetime.now(timezone.utc)
    article_ids = []
    for i in range(25):
        _, article = await create_test_article(
            db_session,
            feed.id,
            f"Article {i}",
            f"https://example.com/many/{i}",
            now - timedelta(days=i),  # Most recent first
            f"many-article-{i}",
        )
        article_ids.append(article.id)

    await db_session.commit()

    # Subscribe to the feed - this should set initial_cutoff
    response = await async_client.post(
        f"/api/feeds/{feed.id}/subscribe",
        json={"folder_id": str(folder.id)},
    )

    assert response.status_code == 201
    subscription_data = response.json()
    assert subscription_data["message"] == "Subscribed to feed successfully"

    # Get the subscription to check last_read_cutoff
    from sqlalchemy import select

    result = await db_session.execute(
        select(FeedSubscription).where(
            FeedSubscription.user_id == test_user.id,
            FeedSubscription.feed_id == feed.id,
        )
    )
    subscription = result.scalar_one()

    # last_read_cutoff should be set to limit unread articles
    assert subscription.last_read_cutoff is not None

    # Count unread articles for this user
    unread_count = await count_total_unread_articles(db_session, user_id=test_user.id)

    # Should have exactly INITIAL_UNREAD_COUNT unread articles (default is 10)
    assert unread_count == INITIAL_UNREAD_COUNT, (
        f"Expected {INITIAL_UNREAD_COUNT} unread articles on new subscription, "
        f"but got {unread_count}"
    )


@pytest.mark.asyncio
async def test_subscription_with_fewer_articles_shows_all_as_unread(
    async_client: AsyncClient, db_session: AsyncSession, test_user: Profile
):
    """Test that subscribing to a feed with <10 articles shows all as unread."""
    from app.crud.article.counts import count_total_unread_articles

    # Create a folder
    folder = Folder(
        id=uuid4(),
        user_id=test_user.id,
        name="Test Folder",
    )
    db_session.add(folder)

    # Create a feed with only 5 articles (less than INITIAL_UNREAD_COUNT)
    feed = Feed(
        id=uuid4(),
        url=f"https://example.com/few-articles-feed-{uuid4().hex[:8]}.xml",
        title="Few Articles Feed",
        description="Test feed description",
        language="en",
    )
    db_session.add(feed)
    await db_session.flush()

    now = datetime.now(timezone.utc)
    for i in range(5):
        await create_test_article(
            db_session,
            feed.id,
            f"Article {i}",
            f"https://example.com/few/{i}",
            now - timedelta(days=i),
            f"few-article-{i}",
        )

    await db_session.commit()

    # Subscribe to the feed
    response = await async_client.post(
        f"/api/feeds/{feed.id}/subscribe",
        json={"folder_id": str(folder.id)},
    )

    assert response.status_code == 201
    assert response.json()["message"] == "Subscribed to feed successfully"

    # Get the subscription
    from sqlalchemy import select

    result = await db_session.execute(
        select(FeedSubscription).where(
            FeedSubscription.user_id == test_user.id,
            FeedSubscription.feed_id == feed.id,
        )
    )
    subscription = result.scalar_one()

    # last_read_cutoff should be None (feed has < 10 articles)
    assert subscription.last_read_cutoff is None

    # Count unread articles
    unread_count = await count_total_unread_articles(db_session, user_id=test_user.id)

    # Should have all 5 articles as unread
    assert unread_count == 5


@pytest.mark.asyncio
async def test_mark_feed_all_read_updates_article_list_is_read_field(
    async_client: AsyncClient, db_session: AsyncSession, test_user: Profile
):
    """Test that article list API returns is_read=true after mark all read."""
    # Create a folder
    folder = Folder(
        id=uuid4(),
        user_id=test_user.id,
        name="Test Folder",
    )
    db_session.add(folder)

    # Create a feed with 5 articles
    feed = Feed(
        id=uuid4(),
        url="https://example.com/article-list-test.xml",
        title="Article List Test Feed",
        description="Test feed description",
        language="en",
    )
    db_session.add(feed)
    await db_session.flush()

    now = datetime.now(timezone.utc)
    article_ids = []
    for i in range(5):
        _, article = await create_test_article(
            db_session,
            feed.id,
            f"Test Article {i}",
            f"https://example.com/articlelist/{i}",
            now - timedelta(days=i),
            f"articlelist-{i}",
        )
        article_ids.append(str(article.id))

    # Create subscription with no cutoff (all unread initially)
    subscription = FeedSubscription(
        id=uuid4(),
        user_id=test_user.id,
        feed_id=feed.id,
        folder_id=folder.id,
        is_favorite=False,
        last_read_cutoff=None,
    )
    db_session.add(subscription)
    await db_session.commit()

    # Get articles before marking as read - should all be unread
    response = await async_client.get(f"/api/articles/?feed_ids={feed.id}")
    assert response.status_code == 200
    data = response.json()
    articles_before = data["items"]
    assert len(articles_before) == 5
    for article in articles_before:
        assert (
            article["is_read"] is False
        ), f"Article {article['id']} should be unread before mark all read"

    # Mark all as read
    response = await async_client.put(f"/api/feeds/{feed.id}/read-status")
    assert response.status_code == 200

    # Get articles after marking as read - should all be read
    response = await async_client.get(f"/api/articles/?feed_ids={feed.id}")
    assert response.status_code == 200
    data = response.json()
    articles_after = data["items"]
    assert len(articles_after) == 5
    for article in articles_after:
        assert (
            article["is_read"] is True
        ), f"Article {article['id']} should be read after mark all read"


@pytest.mark.asyncio
async def test_mark_folder_all_read_updates_article_list_is_read_field(
    async_client: AsyncClient, db_session: AsyncSession, test_user: Profile
):
    """Test that article list API returns is_read=true after mark folder all read."""
    # Create a folder
    folder = Folder(
        id=uuid4(),
        user_id=test_user.id,
        name="Test Folder for Article List",
    )
    db_session.add(folder)
    await db_session.flush()

    # Create 2 feeds with 3 articles each
    now = datetime.now(timezone.utc)
    all_article_ids = []

    for feed_num in range(2):
        feed = Feed(
            id=uuid4(),
            url=f"https://example.com/folder-article-list-{feed_num}.xml",
            title=f"Folder Article List Feed {feed_num}",
            description="Test feed description",
            language="en",
        )
        db_session.add(feed)
        await db_session.flush()

        for i in range(3):
            _, article = await create_test_article(
                db_session,
                feed.id,
                f"Feed {feed_num} Article {i}",
                f"https://example.com/folderlist/{feed_num}/{i}",
                now - timedelta(days=i),
                f"folder-articlelist-{feed_num}-{i}",
            )
            all_article_ids.append(str(article.id))

        # Create subscription with no cutoff
        subscription = FeedSubscription(
            id=uuid4(),
            user_id=test_user.id,
            feed_id=feed.id,
            folder_id=folder.id,
            is_favorite=False,
            last_read_cutoff=None,
        )
        db_session.add(subscription)

    await db_session.commit()

    # Get articles from folder before marking as read
    response = await async_client.get(f"/api/articles/?folder_id={folder.id}")
    assert response.status_code == 200
    data = response.json()
    articles_before = data["items"]
    assert len(articles_before) == 6  # 2 feeds × 3 articles
    for article in articles_before:
        assert (
            article["is_read"] is False
        ), f"Article {article['id']} should be unread before mark folder all read"

    # Mark folder all as read
    response = await async_client.put(f"/api/folders/{folder.id}/read-status")
    assert response.status_code == 200

    # Get articles after marking folder as read
    response = await async_client.get(f"/api/articles/?folder_id={folder.id}")
    assert response.status_code == 200
    data = response.json()
    articles_after = data["items"]
    assert len(articles_after) == 6
    for article in articles_after:
        assert (
            article["is_read"] is True
        ), f"Article {article['id']} should be read after mark folder all read"
