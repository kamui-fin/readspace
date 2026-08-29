"""Integration tests for Meilisearch sync operations.

Tests that feed operations (create, update, delete, OPML import) properly sync to Meilisearch.
"""

from uuid import uuid4

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.models.feed import Feed
from app.models.folder import Folder
from app.models.user import Profile


class TestMeilisearchSyncOnFeedCreate:
    """Test Meilisearch sync when creating feeds."""

    @pytest.mark.asyncio
    async def test_add_feed_syncs_to_meilisearch(
        self,
        async_client: AsyncClient,
        test_folder: Folder,
        meili_test_index: str,
        meili_client,
        db_session: AsyncSession,
    ):
        """Test that adding a new feed syncs to Meilisearch."""
        # Mock external dependencies
        from unittest.mock import patch

        with (
            patch("app.services.feeds.fetching.fetch_feed_content") as mock_fetch,
            patch("app.services.feeds.parsing.parse_feed_content") as mock_parse,
        ):
            mock_fetch.return_value = {
                "content": "dummy",
                "headers": {},
                "status_code": 200,
                "not_modified": False,
                "error": None,
                "final_url": "https://techcrunch.com/feed",
                "permanent_redirect": False,
            }

            from app.typing.feeds import ParsedFeed

            mock_parse.return_value = ParsedFeed(
                title="TechCrunch",
                description="Tech news",
                link="https://techcrunch.com",
                language="en",
                articles=[],
                image_url=None,
                author_name=None,
                last_updated_at=None,
                tags=[],
            )

            # Add a new feed
            response = await async_client.post(
                "/api/feeds/",
                json={
                    "url": "https://techcrunch.com/feed",
                    "folder_id": str(test_folder.id),
                },
            )

        assert response.status_code == 201

        # Get feed ID from database since response only returns message
        from sqlalchemy import select

        stmt = select(Feed).where(Feed.url == "https://techcrunch.com/feed")
        result = await db_session.execute(stmt)
        feed = result.scalar_one()
        feed_id = str(feed.id)

        # Wait for Meilisearch indexing
        import asyncio

        await asyncio.sleep(0.5)

        # Verify feed exists in Meilisearch
        settings = get_settings()
        index = await meili_client.get_index(settings.MEILISEARCH_INDEX_NAME)
        doc = await index.get_document(feed_id)

        assert doc is not None
        assert doc["id"] == feed_id
        assert doc["url"] == "https://techcrunch.com/feed"
        assert doc["title"] is not None


class TestMeilisearchSyncOnAdminUpdate:
    """Test Meilisearch sync when admin updates feeds."""

    @pytest.mark.asyncio
    async def test_admin_update_feed_syncs_to_meilisearch(
        self,
        async_admin_client: AsyncClient,
        test_feed: Feed,
        db_session: AsyncSession,
        meili_test_index: str,
        meili_client,
    ):
        """Test that admin updating feed syncs to Meilisearch."""
        # First, ensure feed is in Meilisearch
        from app.services.feeds.meilisearch import sync_feed

        settings = get_settings()
        await sync_feed(settings, test_feed)

        import asyncio

        await asyncio.sleep(0.5)

        # Admin updates the feed
        response = await async_admin_client.put(
            f"/api/feeds/{test_feed.id}/admin",
            json={
                "title": "Admin Updated Title",
                "description": "Admin updated description",
                "popularity_score": 100.0,
            },
        )

        assert response.status_code == 200

        # Wait for Meilisearch indexing
        await asyncio.sleep(0.5)

        # Verify updated in Meilisearch
        index = await meili_client.get_index(settings.MEILISEARCH_INDEX_NAME)
        doc = await index.get_document(str(test_feed.id))

        assert doc["title"] == "Admin Updated Title"
        assert doc["description"] == "Admin updated description"
        assert doc["popularity_score"] == 100.0


class TestMeilisearchSyncOnAdminDelete:
    """Test Meilisearch sync when admin deletes feeds."""

    @pytest.mark.asyncio
    async def test_admin_delete_feed_removes_from_meilisearch(
        self,
        async_admin_client: AsyncClient,
        db_session: AsyncSession,
        meili_test_index: str,
        meili_client,
    ):
        """Test that admin deleting feed removes from Meilisearch."""
        # Create a feed
        feed = Feed(
            id=uuid4(),
            url=f"https://example-delete-{uuid4().hex[:8]}.com/feed",
            title="Feed to Delete",
            description="This will be deleted",
            language="en",
        )
        db_session.add(feed)
        await db_session.flush()
        await db_session.commit()  # Commit before syncing to Meilisearch

        # Sync to Meilisearch
        from app.services.feeds.meilisearch import sync_feed

        settings = get_settings()
        await sync_feed(settings, feed)

        import asyncio

        await asyncio.sleep(0.5)

        # Verify it exists
        index = await meili_client.get_index(settings.MEILISEARCH_INDEX_NAME)
        doc = await index.get_document(str(feed.id))
        assert doc is not None

        # Admin deletes the feed
        response = await async_admin_client.delete(f"/api/feeds/{feed.id}/admin")
        assert response.status_code == 204

        # Wait for deletion
        await asyncio.sleep(0.5)

        # Verify removed from Meilisearch
        with pytest.raises(Exception):  # Meilisearch raises exception for missing docs
            await index.get_document(str(feed.id))


class TestMeilisearchSyncOnOPMLImport:
    """Test Meilisearch sync during OPML import."""

    @pytest.mark.asyncio
    async def test_opml_import_syncs_feeds_to_meilisearch(
        self,
        async_client: AsyncClient,
        test_user: Profile,
        db_session: AsyncSession,
        meili_test_index: str,
        meili_client,
        monkeypatch,
    ):
        """Test that OPML import syncs all feeds to Meilisearch."""
        # Create minimal OPML content
        opml_content = """<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
    <head><title>Test OPML</title></head>
    <body>
        <outline type="rss" text="Test Feed 1" xmlUrl="https://example1.com/feed" />
    </body>
</opml>"""

        # Mock the feed fetching to avoid external calls
        async def mock_fetch(*args, **kwargs):
            return {
                "content": """<?xml version="1.0"?>
<rss version="2.0">
    <channel>
        <title>Mock Feed</title>
        <link>https://example.com</link>
        <description>Mock Description</description>
    </channel>
</rss>""",
                "headers": {},
                "status_code": 200,
                "not_modified": False,
                "error": None,
                "final_url": kwargs.get("url", "https://example.com/feed"),
                "permanent_redirect": False,
            }

        monkeypatch.setattr("app.services.feeds.fetching.fetch_feed_content", mock_fetch)

        # Upload OPML file
        from io import BytesIO

        files = {
            "opml_file": (
                "test.opml",
                BytesIO(opml_content.encode()),
                "application/xml",
            )
        }

        response = await async_client.post(
            "/api/opml/import/",
            files=files,
            data={"default_folder_name": "Imported Feeds"},
        )

        assert response.status_code == 200 or response.status_code == 202
        task_data = response.json()
        task_id = task_data["task_id"]

        # Wait for import to complete
        import asyncio

        for _ in range(20):
            status_response = await async_client.get(f"/api/opml/import/status/{task_id}")
            if status_response.status_code == 200 and status_response.json()["status"] in ("completed", "failed"):
                break
            await asyncio.sleep(0.1)

        # Check import status
        status_response = await async_client.get(f"/api/opml/import/status/{task_id}")
        assert status_response.status_code == 200

        # Wait for Meilisearch indexing
        await asyncio.sleep(1.0)

        # Verify feeds are in Meilisearch
        settings = get_settings()
        index = await meili_client.get_index(settings.MEILISEARCH_INDEX_NAME)

        # Search for the feeds
        search_result = await index.search("Mock Feed")
        assert search_result.hits is not None
        # At least one feed should be indexed (may be 2 if both succeeded)
        assert len(search_result.hits) >= 1


class TestMeilisearchSyncOnFeedRefresh:
    """Test Meilisearch sync when refreshing feeds."""

    @pytest.mark.asyncio
    async def test_feed_refresh_syncs_updates_to_meilisearch(
        self,
        async_client: AsyncClient,
        test_feed: Feed,
        test_user: Profile,
        test_folder: Folder,
        db_session: AsyncSession,
        meili_test_index: str,
        meili_client,
        monkeypatch,
    ):
        """Test that refreshing a feed syncs updates to Meilisearch."""
        # Create subscription
        from app.models.feed import FeedSubscription

        subscription = FeedSubscription(
            user_id=test_user.id,
            feed_id=test_feed.id,
            folder_id=test_folder.id,
        )
        db_session.add(subscription)
        await db_session.commit()

        # Sync initial state to Meilisearch
        from app.services.feeds.meilisearch import sync_feed

        settings = get_settings()
        await sync_feed(settings, test_feed)

        import asyncio

        await asyncio.sleep(0.5)

        # Mock feed fetch with updated content
        async def mock_fetch(*args, **kwargs):
            return {
                "content": """<?xml version="1.0"?>
<rss version="2.0">
    <channel>
        <title>Updated Feed Title</title>
        <link>https://example.com</link>
        <description>Updated Description</description>
    </channel>
</rss>""",
                "headers": {},
                "status_code": 200,
                "not_modified": False,
                "error": None,
                "final_url": str(test_feed.url),
                "permanent_redirect": False,
            }

        monkeypatch.setattr("app.services.feeds.fetching.fetch_feed_content", mock_fetch)

        # Refresh the feed
        response = await async_client.post(f"/api/feeds/{test_feed.id}/refresh")
        assert response.status_code == 200

        # Wait for Meilisearch indexing
        await asyncio.sleep(0.5)

        # Verify updated in Meilisearch
        index = await meili_client.get_index(settings.MEILISEARCH_INDEX_NAME)
        doc = await index.get_document(str(test_feed.id))

        assert doc["title"] == "Updated Feed Title"
        assert doc["description"] == "Updated Description"
