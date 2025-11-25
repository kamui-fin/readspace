"""E2E tests for feed routes."""

from uuid import uuid4

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.feed import Feed, FeedSubscription
from app.models.folder import Folder
from app.models.user import Profile


class TestFeedSubscribe:
    """Test feed subscription endpoint."""

    @pytest.mark.asyncio
    async def test_subscribe_to_feed_success(
        self,
        async_client: AsyncClient,
        test_feed: Feed,
        test_user: Profile,
        test_folder: Folder,
        db_session: AsyncSession,
    ):
        """Test subscribing to an existing feed."""
        response = await async_client.post(
            f"/api/feeds/{test_feed.id}/subscribe", json={"folder_id": str(test_folder.id)}
        )

        assert response.status_code == 201
        data = response.json()
        assert data["feed"]["id"] == str(test_feed.id)
        assert data["user_id"] == str(test_user.id)

        # Verify subscription in database
        result = await db_session.execute(
            select(FeedSubscription).where(
                FeedSubscription.feed_id == test_feed.id, FeedSubscription.user_id == test_user.id
            )
        )
        subscription = result.scalar_one_or_none()
        assert subscription is not None

    @pytest.mark.asyncio
    async def test_subscribe_with_folder(
        self, async_client: AsyncClient, test_feed: Feed, test_folder: Folder, db_session: AsyncSession
    ):
        """Test subscribing to feed with folder assignment."""
        response = await async_client.post(
            f"/api/feeds/{test_feed.id}/subscribe",
            json={"folder_id": str(test_folder.id)},
        )

        assert response.status_code == 201
        data = response.json()
        assert data["folder_id"] == str(test_folder.id)

        # Verify in database
        result = await db_session.execute(select(FeedSubscription).where(FeedSubscription.feed_id == test_feed.id))
        subscription = result.scalar_one()
        assert subscription.folder_id == test_folder.id

    @pytest.mark.asyncio
    async def test_subscribe_feed_not_found(self, async_client: AsyncClient, test_folder: Folder):
        """Test subscribing to non-existent feed."""
        fake_id = uuid4()
        response = await async_client.post(f"/api/feeds/{fake_id}/subscribe", json={"folder_id": str(test_folder.id)})

        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_subscribe_already_subscribed(
        self,
        async_client: AsyncClient,
        test_feed: Feed,
        test_user: Profile,
        test_folder: Folder,
        db_session: AsyncSession,
    ):
        """Test subscribing to already subscribed feed."""
        # Create existing subscription
        subscription = FeedSubscription(user_id=test_user.id, feed_id=test_feed.id, folder_id=test_folder.id)
        db_session.add(subscription)
        await db_session.flush()

        response = await async_client.post(
            f"/api/feeds/{test_feed.id}/subscribe", json={"folder_id": str(test_folder.id)}
        )

        assert response.status_code == 400
        response_data = response.json()
        # Handle both string and structured error responses
        if isinstance(response_data["detail"], str):
            assert "already subscribed" in response_data["detail"].lower()
        else:
            assert "already subscribed" in response_data["detail"]["message"].lower()


class TestFeedAdd:
    """Test add new feed endpoint."""

    @pytest.mark.asyncio
    async def test_add_feed_success(self, async_client: AsyncClient, test_folder: Folder):
        """Test adding a new feed by URL."""
        response = await async_client.post(
            "/api/feeds/",
            json={"url": "https://techcrunch.com/feed", "folder_id": str(test_folder.id)},
        )

        assert response.status_code == 201
        data = response.json()
        assert "id" in data
        assert "feed" in data
        assert data["feed"]["title"] is not None
        assert data["feed"]["id"] is not None

    @pytest.mark.asyncio
    async def test_add_feed_with_folder(self, async_client: AsyncClient, test_folder: Folder):
        """Test adding feed with folder assignment."""
        response = await async_client.post(
            "/api/feeds/",
            json={"url": "https://twobithistory.org/feed.xml", "folder_id": str(test_folder.id)},
        )

        assert response.status_code == 201
        data = response.json()
        assert data["folder_id"] == str(test_folder.id)

    @pytest.mark.asyncio
    async def test_add_feed_invalid_url(self, async_client: AsyncClient, test_folder: Folder):
        """Test adding feed with invalid URL."""
        response = await async_client.post("/api/feeds/", json={"url": "not-a-url", "folder_id": str(test_folder.id)})

        assert response.status_code == 422  # 422 is correct for validation errors

    @pytest.mark.asyncio
    async def test_add_feed_missing_url(self, async_client: AsyncClient):
        """Test adding feed without URL."""
        response = await async_client.post("/api/feeds/", json={})

        assert response.status_code == 422


class TestFeedList:
    """Test feed listing endpoint."""

    @pytest.mark.asyncio
    async def test_list_feeds_empty(self, async_client: AsyncClient):
        """Test listing feeds when user has no subscriptions."""
        response = await async_client.get("/api/feeds/")

        assert response.status_code == 200
        assert response.json() == []

    @pytest.mark.asyncio
    async def test_list_feeds_with_subscriptions(
        self,
        async_client: AsyncClient,
        test_feed: Feed,
        test_user: Profile,
        test_folder: Folder,
        db_session: AsyncSession,
    ):
        """Test listing feeds returns user's subscriptions."""
        # Create subscription
        subscription = FeedSubscription(user_id=test_user.id, feed_id=test_feed.id, folder_id=test_folder.id)
        db_session.add(subscription)
        await db_session.flush()

        response = await async_client.get("/api/feeds/")

        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 1
        assert any(f["feed"]["id"] == str(test_feed.id) for f in data)

    @pytest.mark.asyncio
    async def test_list_feeds_filter_by_folder(
        self,
        async_client: AsyncClient,
        test_feed: Feed,
        test_folder: Folder,
        test_user: Profile,
        db_session: AsyncSession,
    ):
        """Test filtering feeds by folder."""
        # Create subscription with folder
        subscription = FeedSubscription(user_id=test_user.id, feed_id=test_feed.id, folder_id=test_folder.id)
        db_session.add(subscription)
        await db_session.flush()

        response = await async_client.get(f"/api/feeds/?folder_id={test_folder.id}")

        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 1
        assert all(f["folder_id"] == str(test_folder.id) for f in data)

    @pytest.mark.asyncio
    async def test_list_feeds_filter_by_favorite(
        self,
        async_client: AsyncClient,
        test_feed: Feed,
        test_user: Profile,
        test_folder: Folder,
        db_session: AsyncSession,
    ):
        """Test filtering feeds by favorite status."""
        # Create favorite subscription
        subscription = FeedSubscription(
            user_id=test_user.id, feed_id=test_feed.id, folder_id=test_folder.id, is_favorite=True
        )
        db_session.add(subscription)
        await db_session.flush()

        response = await async_client.get("/api/feeds/?is_favorite=true")

        assert response.status_code == 200
        data = response.json()
        assert all(f["is_favorite"] is True for f in data)

    @pytest.mark.asyncio
    async def test_list_feeds_search(
        self,
        async_client: AsyncClient,
        test_feed: Feed,
        test_user: Profile,
        test_folder: Folder,
        db_session: AsyncSession,
    ):
        """Test searching feeds by title."""
        subscription = FeedSubscription(user_id=test_user.id, feed_id=test_feed.id, folder_id=test_folder.id)
        db_session.add(subscription)
        await db_session.flush()

        response = await async_client.get(f"/api/feeds/?search_query={test_feed.title}")

        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 1

    @pytest.mark.asyncio
    async def test_list_feeds_pagination(self, async_client: AsyncClient):
        """Test feed listing pagination."""
        response = await async_client.get("/api/feeds/?skip=0&limit=10")

        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)


class TestFeedGet:
    """Test get single feed endpoint."""

    @pytest.mark.asyncio
    async def test_get_feed_success(
        self,
        async_client: AsyncClient,
        test_feed: Feed,
        test_user: Profile,
        test_folder: Folder,
        db_session: AsyncSession,
    ):
        """Test getting a feed by ID."""
        # Create subscription
        subscription = FeedSubscription(user_id=test_user.id, feed_id=test_feed.id, folder_id=test_folder.id)
        db_session.add(subscription)
        await db_session.flush()

        response = await async_client.get(f"/api/feeds/{test_feed.id}")

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == str(test_feed.id)
        assert data["title"] == test_feed.title

    @pytest.mark.asyncio
    async def test_get_feed_not_subscribed(self, async_client: AsyncClient, test_feed: Feed):
        """Test getting feed user is not subscribed to returns preview mode."""
        response = await async_client.get(f"/api/feeds/{test_feed.id}")

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == str(test_feed.id)
        assert data["is_subscribed"] is False  # Preview mode

    @pytest.mark.asyncio
    async def test_get_feed_not_found(self, async_client: AsyncClient):
        """Test getting non-existent feed."""
        fake_id = uuid4()
        response = await async_client.get(f"/api/feeds/{fake_id}")

        assert response.status_code == 404


class TestFeedUpdate:
    """Test feed update endpoint."""

    @pytest.mark.asyncio
    async def test_update_feed_custom_title(
        self,
        async_client: AsyncClient,
        test_feed: Feed,
        test_user: Profile,
        test_folder: Folder,
        db_session: AsyncSession,
    ):
        """Test updating feed custom title."""
        subscription = FeedSubscription(user_id=test_user.id, feed_id=test_feed.id, folder_id=test_folder.id)
        db_session.add(subscription)
        await db_session.flush()

        response = await async_client.put(f"/api/feeds/{test_feed.id}", json={"custom_title": "Custom Title"})

        assert response.status_code == 200
        data = response.json()
        assert data["custom_title"] == "Custom Title"

    @pytest.mark.asyncio
    async def test_update_feed_folder(
        self,
        async_client: AsyncClient,
        test_feed: Feed,
        test_folder: Folder,
        test_user: Profile,
        db_session: AsyncSession,
    ):
        """Test moving feed to different folder."""
        # Create another folder for the initial subscription
        from uuid import uuid4

        initial_folder = Folder(id=uuid4(), user_id=test_user.id, name="Initial Folder")
        db_session.add(initial_folder)
        await db_session.flush()

        subscription = FeedSubscription(user_id=test_user.id, feed_id=test_feed.id, folder_id=initial_folder.id)
        db_session.add(subscription)
        await db_session.flush()

        response = await async_client.put(f"/api/feeds/{test_feed.id}", json={"folder_id": str(test_folder.id)})

        assert response.status_code == 200
        data = response.json()
        assert data["folder_id"] == str(test_folder.id)

    @pytest.mark.asyncio
    async def test_update_feed_not_subscribed(self, async_client: AsyncClient, test_feed: Feed):
        """Test updating feed user is not subscribed to."""
        response = await async_client.put(f"/api/feeds/{test_feed.id}", json={"custom_title": "New Title"})

        assert response.status_code == 404


class TestFeedRefresh:
    """Test feed refresh endpoint."""

    @pytest.mark.asyncio
    async def test_refresh_feed_success(
        self,
        async_client: AsyncClient,
        test_feed: Feed,
        test_user: Profile,
        test_folder: Folder,
        db_session: AsyncSession,
    ):
        """Test refreshing a feed."""
        subscription = FeedSubscription(user_id=test_user.id, feed_id=test_feed.id, folder_id=test_folder.id)
        db_session.add(subscription)
        await db_session.commit()  # Commit so the API can see it

        response = await async_client.post(f"/api/feeds/{test_feed.id}/refresh")

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == str(test_feed.id)

    @pytest.mark.asyncio
    async def test_refresh_feed_not_subscribed(self, async_client: AsyncClient, test_feed: Feed):
        """Test refreshing feed user is not subscribed to."""
        response = await async_client.post(f"/api/feeds/{test_feed.id}/refresh")

        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_refresh_feed_preview_mode(self, async_client: AsyncClient, test_feed: Feed, db_session: AsyncSession):
        """Test refreshing feed in preview mode."""
        # Ensure feed is committed
        await db_session.commit()
        
        response = await async_client.post(f"/api/feeds/{test_feed.id}/refresh?preview=true")

        assert response.status_code == 200


class TestFeedDelete:
    """Test feed deletion endpoint."""

    @pytest.mark.asyncio
    async def test_delete_feed_success(
        self,
        async_client: AsyncClient,
        test_feed: Feed,
        test_user: Profile,
        test_folder: Folder,
        db_session: AsyncSession,
    ):
        """Test deleting (unsubscribing from) a feed."""
        subscription = FeedSubscription(user_id=test_user.id, feed_id=test_feed.id, folder_id=test_folder.id)
        db_session.add(subscription)
        await db_session.flush()

        response = await async_client.delete(f"/api/feeds/{test_feed.id}")

        assert response.status_code == 200  # Changed from 204 to 200 based on feeds.py

        # Verify subscription deleted
        result = await db_session.execute(
            select(FeedSubscription).where(
                FeedSubscription.feed_id == test_feed.id, FeedSubscription.user_id == test_user.id
            )
        )
        subscription = result.scalar_one_or_none()
        assert subscription is None

    @pytest.mark.asyncio
    async def test_delete_feed_not_subscribed(self, async_client: AsyncClient, test_feed: Feed):
        """Test deleting feed user is not subscribed to."""
        response = await async_client.delete(f"/api/feeds/{test_feed.id}")

        assert response.status_code == 404


class TestFeedBulkOperations:
    """Test bulk feed operations."""

    @pytest.mark.asyncio
    async def test_bulk_delete_feeds(
        self, async_client: AsyncClient, test_user: Profile, test_folder: Folder, db_session: AsyncSession
    ):
        """Test bulk deleting multiple feeds."""
        # Create multiple feeds and subscriptions with unique URLs
        from uuid import uuid4

        feed_ids = []
        for i in range(3):
            # Use unique URLs to avoid constraint violations
            url = f"https://example-bulk-delete-{uuid4().hex[:8]}.com/feed"
            feed = Feed(url=url, title=f"Bulk Delete Feed {i}")
            db_session.add(feed)
            await db_session.flush()

            subscription = FeedSubscription(user_id=test_user.id, feed_id=feed.id, folder_id=test_folder.id)
            db_session.add(subscription)
            feed_ids.append(str(feed.id))

        await db_session.flush()

        # httpx.AsyncClient.delete() doesn't support json parameter, use request() instead
        response = await async_client.request("DELETE", "/api/feeds/", json={"feed_ids": feed_ids})

        assert response.status_code == 200
        data = response.json()
        assert data["deleted_count"] == 3

    @pytest.mark.asyncio
    async def test_bulk_update_folder(
        self, async_client: AsyncClient, test_folder: Folder, test_user: Profile, db_session: AsyncSession
    ):
        """Test bulk moving feeds to folder."""
        # Create initial folder for subscriptions
        from uuid import uuid4

        initial_folder = Folder(id=uuid4(), user_id=test_user.id, name="Initial Folder")
        db_session.add(initial_folder)
        await db_session.flush()

        # Create multiple feeds and subscriptions with unique URLs
        feed_ids = []
        for i in range(3):
            # Use unique URLs to avoid constraint violations
            url = f"https://example-bulk-update-{uuid4().hex[:8]}.com/feed"
            feed = Feed(url=url, title=f"Bulk Update Feed {i}")
            db_session.add(feed)
            await db_session.flush()

            subscription = FeedSubscription(user_id=test_user.id, feed_id=feed.id, folder_id=initial_folder.id)
            db_session.add(subscription)
            feed_ids.append(str(feed.id))

        await db_session.flush()

        response = await async_client.patch(
            "/api/feeds/folder",
            json={"feed_ids": feed_ids, "folder_id": str(test_folder.id)},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["updated_count"] == 3


class TestAdminFeedOperations:
    """Test admin-only feed operations."""

    @pytest.mark.asyncio
    async def test_admin_update_feed(self, async_admin_client: AsyncClient, test_feed: Feed, db_session: AsyncSession):
        """Test admin updating global feed properties."""
        response = await async_admin_client.put(
            f"/api/feeds/{test_feed.id}/admin",
            json={"title": "Admin Updated Title"},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["title"] == "Admin Updated Title"

        # Verify in database
        await db_session.refresh(test_feed)
        assert test_feed.title == "Admin Updated Title"

    @pytest.mark.asyncio
    async def test_admin_update_feed_non_admin(self, async_client: AsyncClient, test_feed: Feed):
        """Test non-admin cannot update global feed."""
        response = await async_client.put(
            f"/api/feeds/{test_feed.id}/admin",
            json={"title": "Hacked Title"},
        )

        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_admin_delete_feed(self, async_admin_client: AsyncClient, test_feed: Feed, db_session: AsyncSession):
        """Test admin deleting global feed."""
        feed_id = test_feed.id
        response = await async_admin_client.delete(f"/api/feeds/{feed_id}/admin")

        assert response.status_code == 204

        # Verify deleted from database
        result = await db_session.execute(select(Feed).where(Feed.id == feed_id))
        feed = result.scalar_one_or_none()
        assert feed is None

    @pytest.mark.asyncio
    async def test_admin_delete_feed_non_admin(self, async_client: AsyncClient, test_feed: Feed):
        """Test non-admin cannot delete global feed."""
        response = await async_client.delete(f"/api/feeds/{test_feed.id}/admin")

        assert response.status_code == 403
