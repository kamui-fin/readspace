"""E2E tests for similar feeds routes."""

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Feed, FeedSubscription, Profile, Folder


class TestGetSimilarFeeds:
    """Test get similar feeds endpoint."""

    @pytest.mark.asyncio
    async def test_get_similar_feeds_success(
        self, async_client: AsyncClient, test_feed: Feed, test_user: Profile, test_folder: Folder, db_session: AsyncSession
    ):
        """Test getting similar feeds for a subscribed feed."""
        # Create subscription
        subscription = FeedSubscription(user_id=test_user.id, feed_id=test_feed.id, folder_id=test_folder.id)
        db_session.add(subscription)
        await db_session.flush()

        response = await async_client.get(f"/api/similar/{test_feed.id}")

        assert response.status_code == 200
        data = response.json()
        assert "source_feed" in data
        assert "similar_feeds" in data
        assert isinstance(data["similar_feeds"], list)

    @pytest.mark.asyncio
    async def test_get_similar_feeds_with_limit(
        self, async_client: AsyncClient, test_feed: Feed, test_user: Profile, test_folder: Folder, db_session: AsyncSession
    ):
        """Test limiting similar feed results."""
        subscription = FeedSubscription(user_id=test_user.id, feed_id=test_feed.id, folder_id=test_folder.id)
        db_session.add(subscription)
        await db_session.flush()

        response = await async_client.get(f"/api/similar/{test_feed.id}?limit=5")

        assert response.status_code == 200
        data = response.json()
        assert len(data["similar_feeds"]) <= 5

    @pytest.mark.asyncio
    async def test_get_similar_feeds_with_min_similarity(
        self, async_client: AsyncClient, test_feed: Feed, test_user: Profile, test_folder: Folder, db_session: AsyncSession
    ):
        """Test filtering by minimum similarity score."""
        subscription = FeedSubscription(user_id=test_user.id, feed_id=test_feed.id, folder_id=test_folder.id)
        db_session.add(subscription)
        await db_session.flush()

        response = await async_client.get(f"/api/similar/{test_feed.id}?min_similarity=0.5")

        assert response.status_code == 200
        data = response.json()
        # All results should have similarity >= 0.5
        for feed in data["similar_feeds"]:
            if "similarity_score" in feed:
                assert feed["similarity_score"] >= 0.5

    @pytest.mark.asyncio
    async def test_get_similar_feeds_not_subscribed(self, async_client: AsyncClient, test_feed: Feed):
        """Test getting similar feeds for non-subscribed feed."""
        response = await async_client.get(f"/api/similar/{test_feed.id}")

        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_get_similar_feeds_not_found(self, async_client: AsyncClient):
        """Test getting similar feeds for non-existent feed."""
        from uuid import uuid4

        fake_id = uuid4()
        response = await async_client.get(f"/api/similar/{fake_id}")

        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_get_similar_feeds_invalid_uuid(self, async_client: AsyncClient):
        """Test with invalid UUID format."""
        response = await async_client.get("/api/similar/invalid-uuid")

        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_get_similar_feeds_invalid_limit(self, async_client: AsyncClient, test_feed: Feed):
        """Test with invalid limit parameter."""
        response = await async_client.get(f"/api/similar/{test_feed.id}?limit=0")

        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_get_similar_feeds_invalid_similarity(self, async_client: AsyncClient, test_feed: Feed):
        """Test with invalid similarity threshold."""
        response = await async_client.get(f"/api/similar/{test_feed.id}?min_similarity=2.0")

        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_similar_feeds_source_info(
        self, async_client: AsyncClient, test_feed: Feed, test_user: Profile, test_folder: Folder, db_session: AsyncSession
    ):
        """Test that source feed info is included in response."""
        subscription = FeedSubscription(user_id=test_user.id, feed_id=test_feed.id, folder_id=test_folder.id)
        db_session.add(subscription)
        await db_session.flush()

        response = await async_client.get(f"/api/similar/{test_feed.id}")

        assert response.status_code == 200
        data = response.json()

        source = data["source_feed"]
        assert source["id"] == str(test_feed.id)
        assert source["title"] == test_feed.title
        assert "url" in source
        assert "description" in source

    @pytest.mark.asyncio
    async def test_similar_feeds_result_structure(
        self, async_client: AsyncClient, test_feed: Feed, test_user: Profile, test_folder: Folder, db_session: AsyncSession
    ):
        """Test structure of similar feed results."""
        subscription = FeedSubscription(user_id=test_user.id, feed_id=test_feed.id, folder_id=test_folder.id)
        db_session.add(subscription)
        await db_session.flush()

        response = await async_client.get(f"/api/similar/{test_feed.id}")

        assert response.status_code == 200
        data = response.json()

        if len(data["similar_feeds"]) > 0:
            feed = data["similar_feeds"][0]
            # Check required fields
            assert "id" in feed
            assert "title" in feed
            assert "url" in feed
