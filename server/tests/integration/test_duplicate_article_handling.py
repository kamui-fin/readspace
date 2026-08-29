"""Integration tests for duplicate article handling across feeds."""

from unittest.mock import patch
from uuid import uuid4

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.article import ArticleContent, FeedArticle
from app.models.feed import Feed, FeedSubscription
from app.models.folder import Folder
from app.models.user import Profile


@pytest.fixture
def mock_feed_fetch_duplicate_articles():
    """
    Mock feed fetching for duplicate article tests.

    Returns two different feeds that share one common article URL.
    """

    def create_feed_response(feed_title: str, article_titles: list[str], shared_url: str):
        """Create RSS feed XML with specified articles."""
        items_xml = ""
        for i, title in enumerate(article_titles):
            # Use shared URL for first article, unique URLs for others
            link = shared_url if i == 0 else f"https://example.com/{feed_title.lower().replace(' ', '-')}/article{i}"
            items_xml += f"""
        <item>
            <title>{title}</title>
            <description>Description for {title}</description>
            <link>{link}</link>
            <pubDate>Mon, 01 Jan 2024 12:{i:02d}:00 GMT</pubDate>
        </item>"""

        return f"""<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
    <channel>
        <title>{feed_title}</title>
        <description>{feed_title} description</description>
        <link>https://example.com</link>{items_xml}
    </channel>
</rss>"""

    # Shared article URL that appears in both feeds
    shared_url = "https://example.com/shared-article"

    feed_a_response = create_feed_response(
        "Feed A", ["Shared Article", "Feed A Article 2", "Feed A Article 3"], shared_url
    )

    feed_b_response = create_feed_response(
        "Feed B", ["Shared Article", "Feed B Article 2", "Feed B Article 3"], shared_url
    )

    async def mock_fetch(url: str, *args, **kwargs):
        """Return different feed content based on URL."""
        if "feed-a" in url:
            return {
                "status_code": 200,
                "content": feed_a_response,
                "headers": {},
                "not_modified": False,
                "error": None,
            }
        elif "feed-b" in url:
            return {
                "status_code": 200,
                "content": feed_b_response,
                "headers": {},
                "not_modified": False,
                "error": None,
            }
        else:
            raise ValueError(f"Unexpected feed URL: {url}")

    async def creation_fetch(url: str, *args, **kwargs):
        """Return dict format for creation service."""
        if "feed-a" in url:
            return {"status": 200, "content": feed_a_response}
        elif "feed-b" in url:
            return {"status": 200, "content": feed_b_response}
        else:
            raise ValueError(f"Unexpected feed URL: {url}")

    # Patch the actual fetching function
    with patch("app.services.feeds.fetching.fetch_feed_content", side_effect=mock_fetch):
        yield mock_fetch


class TestDuplicateArticleHandling:
    """Test handling of articles with duplicate URLs across different feeds."""

    @pytest.mark.asyncio
    async def test_duplicate_article_across_feeds_manual_refresh(
        self,
        async_client: AsyncClient,
        db_session: AsyncSession,
        test_user: Profile,
        test_folder: Folder,
        mock_feed_fetch_duplicate_articles,
    ):
        """
        Test that refreshing two feeds with a shared article URL doesn't cause UniqueViolationError.

        This is the critical test for the bug fix:
        1. Create Feed A and Feed B (both contain an article with the same URL)
        2. Subscribe to both feeds
        3. Refresh Feed A (should succeed)
        4. Refresh Feed B (should succeed, not fail with UniqueViolationError)
        5. Verify both feeds link to the same article_content record
        6. Verify only ONE article_content row exists for the shared URL
        """
        # Create Feed A
        feed_a = Feed(
            id=uuid4(),
            url="https://example.com/feed-a.xml",
            title="Feed A",
            description="Feed A description",
            link="https://example.com",
            language="en",
        )
        db_session.add(feed_a)

        # Create Feed B
        feed_b = Feed(
            id=uuid4(),
            url="https://example.com/feed-b.xml",
            title="Feed B",
            description="Feed B description",
            link="https://example.com",
            language="en",
        )
        db_session.add(feed_b)
        await db_session.flush()

        # Subscribe to both feeds
        subscription_a = FeedSubscription(
            user_id=test_user.id,
            feed_id=feed_a.id,
            folder_id=test_folder.id,
        )
        subscription_b = FeedSubscription(
            user_id=test_user.id,
            feed_id=feed_b.id,
            folder_id=test_folder.id,
        )
        db_session.add_all([subscription_a, subscription_b])
        await db_session.flush()

        # Refresh Feed A - should succeed
        response_a = await async_client.post(
            f"/api/feeds/{feed_a.id}/refresh",
            json={"force_refetch": True},
        )
        assert response_a.status_code == 200, f"Feed A refresh failed: {response_a.text}"

        # Verify Feed A has articles
        result = await db_session.execute(select(FeedArticle).where(FeedArticle.feed_id == feed_a.id))
        feed_a_articles = result.scalars().all()
        assert len(feed_a_articles) == 3, "Feed A should have 3 articles"

        # Get the shared article content from Feed A
        shared_article_link = "https://example.com/shared-article"
        result = await db_session.execute(select(ArticleContent).where(ArticleContent.link == shared_article_link))
        shared_content_from_a = result.scalar_one()
        assert shared_content_from_a is not None
        assert shared_content_from_a.title == "Shared Article"

        # Refresh Feed B - THIS IS THE CRITICAL TEST
        # Before the fix, this would fail with UniqueViolationError
        response_b = await async_client.post(
            f"/api/feeds/{feed_b.id}/refresh",
            json={"force_refetch": True},
        )
        assert response_b.status_code == 200, f"Feed B refresh failed: {response_b.text}"

        # Verify Feed B has articles
        result = await db_session.execute(select(FeedArticle).where(FeedArticle.feed_id == feed_b.id))
        feed_b_articles = result.scalars().all()
        assert len(feed_b_articles) == 3, "Feed B should have 3 articles"

        # Verify only ONE ArticleContent exists for the shared URL
        result = await db_session.execute(select(ArticleContent).where(ArticleContent.link == shared_article_link))
        all_shared_content = result.scalars().all()
        assert len(all_shared_content) == 1, "Should only have ONE article_content for shared URL"

        # Verify both feeds point to the SAME article_content
        feed_a_shared_article = next((a for a in feed_a_articles if a.content_id == shared_content_from_a.id), None)
        feed_b_shared_article = next((a for a in feed_b_articles if a.content_id == shared_content_from_a.id), None)

        assert feed_a_shared_article is not None, "Feed A should have link to shared content"
        assert feed_b_shared_article is not None, "Feed B should have link to shared content"
        assert feed_a_shared_article.content_id == feed_b_shared_article.content_id, (
            "Both feeds should reference the same article_content"
        )

        # Note: ArticleContent doesn't have updated_at field
        # The important thing is that both feeds reference the same content_id

    @pytest.mark.asyncio
    async def test_duplicate_article_same_feed_multiple_refreshes(
        self,
        async_client: AsyncClient,
        db_session: AsyncSession,
        test_user: Profile,
        test_folder: Folder,
        mock_feed_fetch_duplicate_articles,
    ):
        """
        Test that refreshing the same feed multiple times doesn't create duplicates.

        This ensures idempotency of feed refreshes.
        """
        # Create Feed A
        feed_a = Feed(
            id=uuid4(),
            url="https://example.com/feed-a.xml",
            title="Feed A",
            description="Feed A description",
            link="https://example.com",
            language="en",
        )
        db_session.add(feed_a)
        await db_session.flush()

        # Subscribe to feed
        subscription = FeedSubscription(
            user_id=test_user.id,
            feed_id=feed_a.id,
            folder_id=test_folder.id,
        )
        db_session.add(subscription)
        await db_session.flush()

        # First refresh
        response_1 = await async_client.post(
            f"/api/feeds/{feed_a.id}/refresh",
            json={"force_refetch": True},
        )
        assert response_1.status_code == 200

        # Count articles after first refresh
        result = await db_session.execute(select(FeedArticle).where(FeedArticle.feed_id == feed_a.id))
        articles_count_1 = len(result.scalars().all())
        assert articles_count_1 == 3

        # Count article_contents
        result = await db_session.execute(select(ArticleContent))
        content_count_1 = len(result.scalars().all())

        # Second refresh - should not create duplicates
        response_2 = await async_client.post(
            f"/api/feeds/{feed_a.id}/refresh",
            json={"force_refetch": True},
        )
        assert response_2.status_code == 200

        # Count articles after second refresh - should be same
        result = await db_session.execute(select(FeedArticle).where(FeedArticle.feed_id == feed_a.id))
        articles_count_2 = len(result.scalars().all())
        assert articles_count_2 == articles_count_1, "Article count should not change on re-refresh"

        # Count article_contents - should be same
        result = await db_session.execute(select(ArticleContent))
        content_count_2 = len(result.scalars().all())
        assert content_count_2 == content_count_1, "ArticleContent count should not increase on re-refresh"
