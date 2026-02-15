"""Integration tests for article content orphan prevention.

These tests verify that the unique constraint on article_contents.link
and the atomic upsert pattern prevent orphaned content rows.
"""

import pytest
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud.article.ingester import create_articles_batch
from app.models.article import ArticleContent, FeedArticle, UserEntry
from app.models.feed import Feed
from app.services.feeds.parsing import parse_feed_content


@pytest.fixture
def sample_feed_xml() -> str:
    """Sample RSS feed XML for testing."""
    return """<?xml version="1.0" encoding="UTF-8"?>
    <rss version="2.0">
        <channel>
            <title>Test Feed</title>
            <link>https://example.com</link>
            <description>Test feed description</description>
            <item>
                <title>Test Article 1</title>
                <link>https://example.com/article1</link>
                <description>Test article 1 description</description>
                <pubDate>Mon, 01 Jan 2024 12:00:00 GMT</pubDate>
                <guid>article1-guid</guid>
            </item>
            <item>
                <title>Test Article 2</title>
                <link>https://example.com/article2</link>
                <description>Test article 2 description</description>
                <pubDate>Mon, 01 Jan 2024 13:00:00 GMT</pubDate>
                <guid>article2-guid</guid>
            </item>
        </channel>
    </rss>"""


@pytest.fixture
def duplicate_article_feed_xml() -> str:
    """Sample RSS feed with duplicate article (same link)."""
    return """<?xml version="1.0" encoding="UTF-8"?>
    <rss version="2.0">
        <channel>
            <title>Test Feed</title>
            <link>https://example.com</link>
            <description>Test feed description</description>
            <item>
                <title>Same Article</title>
                <link>https://example.com/same-article</link>
                <description>Article description</description>
                <pubDate>Mon, 01 Jan 2024 12:00:00 GMT</pubDate>
                <guid>guid-1</guid>
            </item>
            <item>
                <title>Same Article (different title)</title>
                <link>https://example.com/same-article</link>
                <description>Different description</description>
                <pubDate>Mon, 01 Jan 2024 13:00:00 GMT</pubDate>
                <guid>guid-2</guid>
            </item>
        </channel>
    </rss>"""


class TestOrphanPrevention:
    """Test that article_contents orphans are prevented."""

    @pytest.mark.asyncio
    async def test_no_orphans_created_on_successful_ingestion(
        self, db_session: AsyncSession, test_feed: Feed, sample_feed_xml: str
    ):
        """Test that successful article ingestion creates no orphans."""
        # Parse and create articles
        parsed_feed = parse_feed_content(sample_feed_xml, str(test_feed.url))
        # Set feed_id on articles
        for article in parsed_feed.articles:
            article.feed_id = test_feed.id
        await create_articles_batch(db_session, articles_data=parsed_feed.articles)
        await db_session.commit()

        # Count total article_contents
        total_contents_result = await db_session.execute(select(func.count(ArticleContent.id)))
        total_contents = total_contents_result.scalar()

        # Count orphaned contents (no references from feed_articles or clipped_articles)
        orphan_query = text("""
            SELECT COUNT(*)
            FROM article_contents ac
            WHERE NOT EXISTS (
                SELECT 1 FROM feed_articles fa WHERE fa.content_id = ac.id
            )
            AND NOT EXISTS (
                SELECT 1 FROM user_entries ue WHERE ue.content_id = ac.id AND ue.feed_article_id IS NULL
            )
        """)
        orphan_result = await db_session.execute(orphan_query)
        orphan_count = orphan_result.scalar() or 0

        # Assert no orphans
        assert orphan_count == 0, f"Found {orphan_count} orphaned article_contents out of {total_contents}"

        # Verify expected number of articles created
        feed_articles_result = await db_session.execute(
            select(func.count(FeedArticle.id)).where(FeedArticle.feed_id == test_feed.id)
        )
        feed_articles_count = feed_articles_result.scalar()
        assert feed_articles_count == 2  # Two articles in the feed

    @pytest.mark.asyncio
    async def test_duplicate_link_reuses_content(
        self, db_session: AsyncSession, test_feed: Feed, duplicate_article_feed_xml: str
    ):
        """Test that articles with the same link reuse the same article_content row."""
        # Parse and create articles
        parsed_feed = parse_feed_content(duplicate_article_feed_xml, str(test_feed.url))
        # Set feed_id on articles
        for article in parsed_feed.articles:
            article.feed_id = test_feed.id
        await create_articles_batch(db_session, articles_data=parsed_feed.articles)
        await db_session.commit()

        # Count article_contents for the duplicate link
        content_count_result = await db_session.execute(
            select(func.count(ArticleContent.id)).where(ArticleContent.link == "https://example.com/same-article")
        )
        content_count = content_count_result.scalar()

        # Should only have ONE content row for the duplicate link
        assert content_count == 1, f"Expected 1 article_content for duplicate link, found {content_count}"

        # Count feed_articles referencing this content
        content_result = await db_session.execute(
            select(ArticleContent.id).where(ArticleContent.link == "https://example.com/same-article")
        )
        content_id = content_result.scalar()

        feed_article_count_result = await db_session.execute(
            select(func.count(FeedArticle.id)).where(FeedArticle.content_id == content_id)
        )
        feed_article_count = feed_article_count_result.scalar()

        # Should have TWO feed_articles (different GUIDs) pointing to the SAME content
        assert (
            feed_article_count == 2
        ), f"Expected 2 feed_articles sharing content, found {feed_article_count}"

        # Verify no orphans
        orphan_query = text("""
            SELECT COUNT(*)
            FROM article_contents ac
            WHERE NOT EXISTS (
                SELECT 1 FROM feed_articles fa WHERE fa.content_id = ac.id
            )
            AND NOT EXISTS (
                SELECT 1 FROM user_entries ue WHERE ue.content_id = ac.id AND ue.feed_article_id IS NULL
            )
        """)
        orphan_result = await db_session.execute(orphan_query)
        orphan_count = orphan_result.scalar()

        assert orphan_count == 0, "Found orphaned content after duplicate link processing"

    @pytest.mark.asyncio
    async def test_content_preserved_when_referenced_by_clipped_article(
        self, db_session: AsyncSession, test_feed: Feed, test_user, sample_feed_xml: str
    ):
        """Test that content is NOT deleted if it's still referenced by a clipped_article."""
        # Create feed articles
        parsed_feed = parse_feed_content(sample_feed_xml, str(test_feed.url))
        # Set feed_id on articles
        for article in parsed_feed.articles:
            article.feed_id = test_feed.id
        await create_articles_batch(db_session, articles_data=parsed_feed.articles)
        await db_session.commit()

        # Get first content from our test feed
        content_result = await db_session.execute(
            select(ArticleContent)
            .join(FeedArticle, ArticleContent.id == FeedArticle.content_id)
            .where(FeedArticle.feed_id == test_feed.id)
            .limit(1)
        )
        content = content_result.scalar_one()

        # Create a clipped_article referencing the same content
        clipped = UserEntry(
            content_id=content.id,
            user_id=test_user.id,
            feed_article_id=None,
            is_read=False,
            is_saved=True,
        )
        db_session.add(clipped)
        await db_session.commit()

        # Delete only THIS feed's articles
        await db_session.execute(text(f"DELETE FROM feed_articles WHERE feed_id = '{test_feed.id}'"))
        await db_session.commit()

        # Content should still exist because clipped_article references it
        content_exists = await db_session.get(ArticleContent, content.id)
        assert content_exists is not None, "Content was deleted despite clipped_article reference"

        # Verify our specific content is not orphaned
        orphan_query = text("""
            SELECT COUNT(*)
            FROM article_contents ac
            WHERE ac.id = :content_id
            AND NOT EXISTS (
                SELECT 1 FROM feed_articles fa WHERE fa.content_id = ac.id
            )
            AND NOT EXISTS (
                SELECT 1 FROM user_entries ue WHERE ue.content_id = ac.id AND ue.feed_article_id IS NULL
            )
        """)
        orphan_result = await db_session.execute(orphan_query, {"content_id": content.id})
        orphan_count = orphan_result.scalar()

        assert orphan_count == 0, "Content is orphaned despite clipped_article reference"

    @pytest.mark.asyncio
    async def test_concurrent_ingestion_same_link(
        self, db_session: AsyncSession, test_feed: Feed, duplicate_article_feed_xml: str
    ):
        """Test that concurrent ingestion of articles with same link doesn't create duplicates."""
        # Simulate concurrent ingestion by calling create_articles_batch multiple times
        parsed_feed = parse_feed_content(duplicate_article_feed_xml, str(test_feed.url))
        # Set feed_id on articles
        for article in parsed_feed.articles:
            article.feed_id = test_feed.id

        # First ingestion
        await create_articles_batch(db_session, articles_data=parsed_feed.articles)
        await db_session.commit()

        # Second ingestion (simulating concurrent/retry scenario)
        await create_articles_batch(db_session, articles_data=parsed_feed.articles)
        await db_session.commit()

        # Count article_contents for the duplicate link
        content_count_result = await db_session.execute(
            select(func.count(ArticleContent.id)).where(ArticleContent.link == "https://example.com/same-article")
        )
        content_count = content_count_result.scalar()

        # Should still only have ONE content row
        assert (
            content_count == 1
        ), f"Expected 1 article_content after concurrent ingestion, found {content_count}"

        # Verify no orphans
        orphan_query = text("""
            SELECT COUNT(*)
            FROM article_contents ac
            WHERE NOT EXISTS (
                SELECT 1 FROM feed_articles fa WHERE fa.content_id = ac.id
            )
            AND NOT EXISTS (
                SELECT 1 FROM user_entries ue WHERE ue.content_id = ac.id AND ue.feed_article_id IS NULL
            )
        """)
        orphan_result = await db_session.execute(orphan_query)
        orphan_count = orphan_result.scalar()

        assert orphan_count == 0, "Found orphaned content after concurrent ingestion"
