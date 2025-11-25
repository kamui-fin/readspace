"""Integration tests for bulk article creation with duplicate handling.

These tests verify:
1. Bulk insert performance with ArticleCrudOperations.create_articles_batch
2. Proper handling of duplicate links in article_contents
3. Proper handling of duplicate (feed_id, guid) in feed_articles
4. Feed refresh flow using the centralized bulk insert logic
"""

from datetime import datetime, timezone
from unittest.mock import patch
from uuid import uuid4

import pytest
import pytest_asyncio
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud.article.ingester import create_articles_batch
from app.models.article import ArticleContent, FeedArticle
from app.models.feed import Feed, FeedSubscription
from app.models.folder import Folder
from app.models.user import Profile
from app.typing.articles import ArticleCreate
from app.services.feeds.service import refresh_feed
from app.services.feeds.fetching import FetchResult


@pytest_asyncio.fixture
async def test_feed_with_subscription(db_session: AsyncSession, test_user: Profile):
    """Create a test feed with a user subscription."""
    # Create folder
    folder = Folder(
        id=uuid4(),
        user_id=test_user.id,
        name="Test Folder",
        created_at=datetime.now(timezone.utc),
    )
    db_session.add(folder)
    await db_session.flush()

    # Create feed
    feed = Feed(
        id=uuid4(),
        url="https://example.com/feed.xml",
        title="Test Feed",
        description="Test feed description",
        link="https://example.com",
        created_at=datetime.now(timezone.utc),
    )
    db_session.add(feed)
    await db_session.flush()

    # Create subscription
    subscription = FeedSubscription(
        id=uuid4(),
        user_id=test_user.id,
        feed_id=feed.id,
        folder_id=folder.id,
        created_at=datetime.now(timezone.utc),
    )
    db_session.add(subscription)
    await db_session.commit()

    return feed, subscription


class TestBulkArticleCreation:
    """Test bulk article creation with duplicate handling."""

    @pytest.mark.asyncio
    async def test_bulk_insert_all_new_articles(
        self,
        db_session: AsyncSession,
        test_feed_with_subscription: tuple[Feed, FeedSubscription],
    ):
        """Test bulk inserting articles when all are new."""
        feed, _ = test_feed_with_subscription

        # Create 10 new articles
        # Note: user_id is required by schema but not meaningful for feed articles
        placeholder_user_id = uuid4()
        articles_data = [
            ArticleCreate(
                feed_id=feed.id,
                guid=f"guid-{i}",
                title=f"Article {i}",
                link=f"https://example.com/article-{i}",
                content=f"Content for article {i}",
                author="Test Author",
                published_at=datetime.now(timezone.utc),
                user_id=placeholder_user_id,
            )
            for i in range(10)
        ]

        # Bulk insert
        created_articles = await create_articles_batch(db_session, articles_data=articles_data)

        # Verify all 10 were created
        assert len(created_articles) == 10

        # Verify feed_articles were created for this feed
        article_result = await db_session.execute(select(FeedArticle).where(FeedArticle.feed_id == feed.id))
        articles = article_result.scalars().all()
        assert len(articles) == 10

        # Verify article_contents were created for the specific links
        content_links = [f"https://example.com/article-{i}" for i in range(10)]
        content_result = await db_session.execute(select(ArticleContent).where(ArticleContent.link.in_(content_links)))
        contents = content_result.scalars().all()
        assert len(contents) == 10

    @pytest.mark.asyncio
    async def test_bulk_insert_with_duplicate_links(
        self,
        db_session: AsyncSession,
        test_feed_with_subscription: tuple[Feed, FeedSubscription],
    ):
        """Test bulk insert when some article_contents already exist (duplicate links)."""
        feed, _ = test_feed_with_subscription

        # Create a unique test ID to avoid collision with other tests
        test_id = uuid4()
        shared_link = f"https://example.com/test-{test_id}/shared-article"

        # Pre-create an article_content
        existing_content = ArticleContent(
            id=uuid4(),
            title="Existing Article",
            link=shared_link,
            content="Existing content",
        )
        db_session.add(existing_content)
        await db_session.flush()

        # Try to bulk insert articles, including one with duplicate link
        placeholder_user_id = uuid4()
        articles_data = [
            ArticleCreate(
                feed_id=feed.id,
                guid=f"guid-{test_id}-{i}",
                title=f"New Article {i}",
                link=shared_link if i == 1 else f"https://example.com/test-{test_id}/article-{i}",
                content=f"New content {i}",
                published_at=datetime.now(timezone.utc),
                user_id=placeholder_user_id,
            )
            for i in range(3)
        ]

        created_articles = await create_articles_batch(db_session, articles_data=articles_data)

        # Should create 3 feed_articles (linking to existing + new content)
        assert len(created_articles) == 3

        # Verify the existing content was reused (not duplicated)
        reused_result = await db_session.execute(select(ArticleContent).where(ArticleContent.link == shared_link))
        reused_contents = reused_result.scalars().all()
        assert len(reused_contents) == 1
        assert reused_contents[0].id == existing_content.id

        # Verify all 3 feed_articles were created for this feed
        feed_articles_result = await db_session.execute(select(FeedArticle).where(FeedArticle.feed_id == feed.id))
        feed_articles = feed_articles_result.scalars().all()
        assert len(feed_articles) == 3

    @pytest.mark.asyncio
    async def test_bulk_insert_with_duplicate_feed_articles(
        self,
        db_session: AsyncSession,
        test_feed_with_subscription: tuple[Feed, FeedSubscription],
    ):
        """Test bulk insert when some feed_articles already exist (duplicate feed_id + guid)."""
        feed, _ = test_feed_with_subscription

        # Create initial batch
        placeholder_user_id = uuid4()
        initial_articles = [
            ArticleCreate(
                feed_id=feed.id,
                guid=f"guid-{i}",
                title=f"Article {i}",
                link=f"https://example.com/article-{i}",
                content=f"Content {i}",
                published_at=datetime.now(timezone.utc),
                user_id=placeholder_user_id,
            )
            for i in range(5)
        ]

        first_batch = await create_articles_batch(db_session, articles_data=initial_articles)
        assert len(first_batch) == 5

        # Try to insert overlapping batch with same guids but different links
        # Since guids 3, 4, 5 already exist, they should be skipped due to unique constraint on (feed_id, guid)
        # Only guids 6 and 7 should be inserted
        overlapping_articles = [
            ArticleCreate(
                feed_id=feed.id,
                guid=f"guid-{i}",  # Same guids as first batch for i=3,4,5
                title=f"Article {i} Updated",
                link=f"https://example.com/article-{i}-v2",  # Different link (but guid is duplicate)
                content=f"Updated content {i}",
                published_at=datetime.now(timezone.utc),
                user_id=placeholder_user_id,
            )
            for i in range(3, 8)
        ]

        second_batch = await create_articles_batch(db_session, articles_data=overlapping_articles)

        # First batch created guids: 0, 1, 2, 3, 4 (5 articles)
        # Second batch tries to create guids: 3, 4, 5, 6, 7 (5 articles)
        # Duplicates: guid-3, guid-4 (should be skipped)
        # New: guid-5, guid-6, guid-7 (should be created)
        assert len(second_batch) == 3

        # Verify total feed_articles is 8 (5 from first + 3 from second)
        article_result = await db_session.execute(select(FeedArticle).where(FeedArticle.feed_id == feed.id))
        all_articles = article_result.scalars().all()
        assert len(all_articles) == 8

    @pytest.mark.asyncio
    async def test_bulk_insert_empty_list(self, db_session: AsyncSession):
        """Test bulk insert with empty list returns empty list."""
        created_articles = await create_articles_batch(db_session, articles_data=[])

        assert created_articles == []

    @pytest.mark.asyncio
    async def test_bulk_insert_with_mixed_duplicates(
        self,
        db_session: AsyncSession,
        test_feed_with_subscription: tuple[Feed, FeedSubscription],
    ):
        """Test complex scenario with both types of duplicates."""
        feed, _ = test_feed_with_subscription

        # Pre-create an article_content
        existing_content = ArticleContent(
            id=uuid4(),
            title="Shared Content",
            link="https://example.com/shared",
            content="Shared article content",
        )
        db_session.add(existing_content)

        # Pre-create a feed_article
        existing_article = FeedArticle(
            id=uuid4(),
            feed_id=feed.id,
            content_id=existing_content.id,
            guid_hash="existing-guid",
            published_at=datetime.now(timezone.utc),
        )
        db_session.add(existing_article)
        await db_session.flush()

        # Try to insert:
        # 1. Article with duplicate guid (should be skipped)
        # 2. Article with duplicate link but different guid (should reuse content)
        # 3. Completely new article (should create both content and article)
        placeholder_user_id = uuid4()
        articles_data = [
            ArticleCreate(
                feed_id=feed.id,
                guid="existing-guid",  # Duplicate guid
                title="Duplicate GUID",
                link="https://example.com/new-link-1",
                content="Should not be created",
                published_at=datetime.now(timezone.utc),
                user_id=placeholder_user_id,
            ),
            ArticleCreate(
                feed_id=feed.id,
                guid="new-guid-1",
                title="Shared Link",
                link="https://example.com/shared",  # Duplicate link
                content="Should reuse existing content",
                published_at=datetime.now(timezone.utc),
                user_id=placeholder_user_id,
            ),
            ArticleCreate(
                feed_id=feed.id,
                guid="new-guid-2",
                title="Completely New",
                link="https://example.com/new-link-2",
                content="Brand new content",
                published_at=datetime.now(timezone.utc),
                user_id=placeholder_user_id,
            ),
        ]

        created_articles = await create_articles_batch(db_session, articles_data=articles_data)

        # Should create 2 new feed_articles (new-guid-1 and new-guid-2)
        # existing-guid should be skipped
        assert len(created_articles) == 2

        # Verify the shared content was reused (not duplicated)
        shared_content_result = await db_session.execute(
            select(ArticleContent).where(ArticleContent.link == "https://example.com/shared")
        )
        shared_contents = shared_content_result.scalars().all()
        assert len(shared_contents) == 1
        assert shared_contents[0].id == existing_content.id

        # Verify new content was created
        new_content_result = await db_session.execute(
            select(ArticleContent).where(ArticleContent.link == "https://example.com/new-link-2")
        )
        new_contents = new_content_result.scalars().all()
        assert len(new_contents) == 1

        # Verify 3 feed_articles exist for this feed (1 existing + 2 new)
        article_result = await db_session.execute(select(FeedArticle).where(FeedArticle.feed_id == feed.id))
        articles = article_result.scalars().all()
        assert len(articles) == 3


class TestFeedServiceBulkIntegration:
    """Test FeedService using centralized bulk insert logic."""

    @pytest.mark.asyncio
    async def test_feed_refresh_uses_bulk_insert(
        self,
        db_session: AsyncSession,
        test_feed_with_subscription: tuple[Feed, FeedSubscription],
    ):
        """Test that feed refresh flow uses the centralized bulk insert."""
        feed, _ = test_feed_with_subscription

        # Mock feed fetch to return RSS XML
        feed_xml = """<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
    <channel>
        <title>Test Feed</title>
        <description>Test Description</description>
        <link>https://example.com</link>
        <item>
            <title>Article 1</title>
            <description>Description 1</description>
            <link>https://example.com/article-1</link>
            <guid>guid-1</guid>
            <pubDate>Mon, 01 Jan 2024 12:00:00 GMT</pubDate>
        </item>
        <item>
            <title>Article 2</title>
            <description>Description 2</description>
            <link>https://example.com/article-2</link>
            <guid>guid-2</guid>
            <pubDate>Mon, 01 Jan 2024 13:00:00 GMT</pubDate>
        </item>
        <item>
            <title>Article 3</title>
            <description>Description 3</description>
            <link>https://example.com/article-3</link>
            <guid>guid-3</guid>
            <pubDate>Mon, 01 Jan 2024 14:00:00 GMT</pubDate>
        </item>
    </channel>
</rss>"""

        async def mock_fetch(*args, **kwargs):
            return {
                "status_code": 200,
                "content": feed_xml,
                "headers": {},
                "not_modified": False,
                "error": None,
            }

        from app.db.session import get_db_factory

        async def db_factory():
            return db_session

        with patch(
            "app.services.feeds.fetching.fetch_feed_content",
            side_effect=mock_fetch,
        ):
            # Refresh the feed
            result = await refresh_feed(session_factory=db_factory, feed_id=feed.id)

            assert result is not None
            assert result.id == feed.id

            # Verify 3 articles were created via bulk insert
            article_result = await db_session.execute(select(FeedArticle).where(FeedArticle.feed_id == feed.id))
            articles = article_result.scalars().all()
            assert len(articles) == 3

            # Verify article_contents were created for the specific links
            test_links = [
                "https://example.com/article-1",
                "https://example.com/article-2",
                "https://example.com/article-3",
            ]
            content_result = await db_session.execute(
                select(ArticleContent).where(ArticleContent.link.in_(test_links))
            )
            contents = content_result.scalars().all()
            assert len(contents) == 3

    @pytest.mark.asyncio
    async def test_feed_refresh_handles_duplicates_on_second_refresh(
        self,
        db_session: AsyncSession,
        test_feed_with_subscription: tuple[Feed, FeedSubscription],
    ):
        """Test that refreshing the same feed twice doesn't create duplicates."""
        feed, _ = test_feed_with_subscription

        feed_xml = """<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
    <channel>
        <title>Test Feed</title>
        <description>Test Description</description>
        <link>https://example.com</link>
        <item>
            <title>Article 1</title>
            <description>Description 1</description>
            <link>https://example.com/article-1</link>
            <guid>guid-1</guid>
            <pubDate>Mon, 01 Jan 2024 12:00:00 GMT</pubDate>
        </item>
    </channel>
</rss>"""


        async def mock_fetch(*args, **kwargs):
            return {
                "status_code": 200,
                "content": feed_xml,
                "headers": {},
                "not_modified": False,
                "error": None,
            }

        from app.db.session import get_db_factory

        async def db_factory():
            return db_session

        with patch(
            "app.services.feeds.fetching.fetch_feed_content",
            side_effect=mock_fetch,
        ):
            # First refresh
            await refresh_feed(session_factory=db_factory, feed_id=feed.id)

            # Verify 1 article created
            article_result_1 = await db_session.execute(select(FeedArticle).where(FeedArticle.feed_id == feed.id))
            articles_1 = article_result_1.scalars().all()
            assert len(articles_1) == 1

            # Second refresh (same content)
            await refresh_feed(session_factory=db_factory, feed_id=feed.id, force=True)

            # Should still have only 1 article (no duplicates)
            article_result_2 = await db_session.execute(select(FeedArticle).where(FeedArticle.feed_id == feed.id))
            articles_2 = article_result_2.scalars().all()
            assert len(articles_2) == 1

            # Should still have only 1 article_content for this specific link
            content_result = await db_session.execute(
                select(ArticleContent).where(ArticleContent.link == "https://example.com/article-1")
            )
            contents = content_result.scalars().all()
            assert len(contents) == 1
