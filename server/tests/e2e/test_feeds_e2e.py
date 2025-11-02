"""E2E tests for feed routes."""

from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Feed, Folder, Profile, Subscription


class TestFeedSubscribe:
    """Test feed subscription endpoint."""

    @pytest.mark.asyncio
    async def test_subscribe_to_feed_success(
        self, client: TestClient, test_feed: Feed, test_user: Profile, db_session: AsyncSession
    ):
        """Test subscribing to an existing feed."""
        response = client.post(f"/api/v1/feeds/{test_feed.id}/subscribe", json={})

        assert response.status_code == 201
        data = response.json()
        assert data["feed_id"] == str(test_feed.id)
        assert data["user_id"] == str(test_user.id)

        # Verify subscription in database
        result = await db_session.execute(
            select(Subscription).where(Subscription.feed_id == test_feed.id, Subscription.user_id == test_user.id)
        )
        subscription = result.scalar_one_or_none()
        assert subscription is not None

    @pytest.mark.asyncio
    async def test_subscribe_with_folder(
        self, client: TestClient, test_feed: Feed, test_folder: Folder, db_session: AsyncSession
    ):
        """Test subscribing to feed with folder assignment."""
        response = client.post(
            f"/api/v1/feeds/{test_feed.id}/subscribe",
            json={"folder_id": str(test_folder.id)},
        )

        assert response.status_code == 201
        data = response.json()
        assert data["folder_id"] == str(test_folder.id)

        # Verify in database
        result = await db_session.execute(select(Subscription).where(Subscription.feed_id == test_feed.id))
        subscription = result.scalar_one()
        assert subscription.folder_id == test_folder.id

    def test_subscribe_feed_not_found(self, client: TestClient):
        """Test subscribing to non-existent feed."""
        fake_id = uuid4()
        response = client.post(f"/api/v1/feeds/{fake_id}/subscribe", json={})

        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_subscribe_already_subscribed(
        self, client: TestClient, test_feed: Feed, test_user: Profile, db_session: AsyncSession
    ):
        """Test subscribing to already subscribed feed."""
        # Create existing subscription
        subscription = Subscription(user_id=test_user.id, feed_id=test_feed.id)
        db_session.add(subscription)
        await db_session.flush()

        response = client.post(f"/api/v1/feeds/{test_feed.id}/subscribe", json={})

        assert response.status_code == 400
        assert "already subscribed" in response.json()["detail"].lower()


class TestFeedAdd:
    """Test add new feed endpoint."""

    def test_add_feed_success(self, client: TestClient, mock_feed_fetch):
        """Test adding a new feed by URL."""
        response = client.post(
            "/api/v1/feeds/",
            json={"url": "https://example.com/feed.xml"},
        )

        assert response.status_code == 201
        data = response.json()
        assert "id" in data
        assert data["title"] == "Test Feed"
        assert data["is_subscribed"] is True

    def test_add_feed_with_folder(self, client: TestClient, test_folder: Folder, mock_feed_fetch):
        """Test adding feed with folder assignment."""
        response = client.post(
            "/api/v1/feeds/",
            json={"url": "https://example.com/feed.xml", "folder_id": str(test_folder.id)},
        )

        assert response.status_code == 201
        data = response.json()
        assert data["folder_id"] == str(test_folder.id)

    def test_add_feed_invalid_url(self, client: TestClient):
        """Test adding feed with invalid URL."""
        response = client.post("/api/v1/feeds/", json={"url": "not-a-url"})

        assert response.status_code == 422

    def test_add_feed_missing_url(self, client: TestClient):
        """Test adding feed without URL."""
        response = client.post("/api/v1/feeds/", json={})

        assert response.status_code == 422


class TestFeedList:
    """Test feed listing endpoint."""

    @pytest.mark.asyncio
    async def test_list_feeds_empty(self, client: TestClient):
        """Test listing feeds when user has no subscriptions."""
        response = client.get("/api/v1/feeds/")

        assert response.status_code == 200
        assert response.json() == []

    @pytest.mark.asyncio
    async def test_list_feeds_with_subscriptions(
        self, client: TestClient, test_feed: Feed, test_user: Profile, db_session: AsyncSession
    ):
        """Test listing feeds returns user's subscriptions."""
        # Create subscription
        subscription = Subscription(user_id=test_user.id, feed_id=test_feed.id)
        db_session.add(subscription)
        await db_session.flush()

        response = client.get("/api/v1/feeds/")

        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 1
        assert any(f["id"] == str(test_feed.id) for f in data)

    @pytest.mark.asyncio
    async def test_list_feeds_filter_by_folder(
        self, client: TestClient, test_feed: Feed, test_folder: Folder, test_user: Profile, db_session: AsyncSession
    ):
        """Test filtering feeds by folder."""
        # Create subscription with folder
        subscription = Subscription(user_id=test_user.id, feed_id=test_feed.id, folder_id=test_folder.id)
        db_session.add(subscription)
        await db_session.flush()

        response = client.get(f"/api/v1/feeds/?folder_id={test_folder.id}")

        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 1
        assert all(f["folder_id"] == str(test_folder.id) for f in data)

    @pytest.mark.asyncio
    async def test_list_feeds_filter_by_favorite(
        self, client: TestClient, test_feed: Feed, test_user: Profile, db_session: AsyncSession
    ):
        """Test filtering feeds by favorite status."""
        # Create favorite subscription
        subscription = Subscription(user_id=test_user.id, feed_id=test_feed.id, is_favorite=True)
        db_session.add(subscription)
        await db_session.flush()

        response = client.get("/api/v1/feeds/?is_favorite=true")

        assert response.status_code == 200
        data = response.json()
        assert all(f["is_favorite"] is True for f in data)

    @pytest.mark.asyncio
    async def test_list_feeds_search(
        self, client: TestClient, test_feed: Feed, test_user: Profile, db_session: AsyncSession
    ):
        """Test searching feeds by title."""
        subscription = Subscription(user_id=test_user.id, feed_id=test_feed.id)
        db_session.add(subscription)
        await db_session.flush()

        response = client.get(f"/api/v1/feeds/?search_query={test_feed.title}")

        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 1

    def test_list_feeds_pagination(self, client: TestClient):
        """Test feed listing pagination."""
        response = client.get("/api/v1/feeds/?skip=0&limit=10")

        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)


class TestFeedGet:
    """Test get single feed endpoint."""

    @pytest.mark.asyncio
    async def test_get_feed_success(
        self, client: TestClient, test_feed: Feed, test_user: Profile, db_session: AsyncSession
    ):
        """Test getting a feed by ID."""
        # Create subscription
        subscription = Subscription(user_id=test_user.id, feed_id=test_feed.id)
        db_session.add(subscription)
        await db_session.flush()

        response = client.get(f"/api/v1/feeds/{test_feed.id}")

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == str(test_feed.id)
        assert data["title"] == test_feed.title

    def test_get_feed_not_subscribed(self, client: TestClient, test_feed: Feed):
        """Test getting feed user is not subscribed to."""
        response = client.get(f"/api/v1/feeds/{test_feed.id}")

        assert response.status_code == 404

    def test_get_feed_not_found(self, client: TestClient):
        """Test getting non-existent feed."""
        fake_id = uuid4()
        response = client.get(f"/api/v1/feeds/{fake_id}")

        assert response.status_code == 404


class TestFeedUpdate:
    """Test feed update endpoint."""

    @pytest.mark.asyncio
    async def test_update_feed_custom_title(
        self, client: TestClient, test_feed: Feed, test_user: Profile, db_session: AsyncSession
    ):
        """Test updating feed custom title."""
        subscription = Subscription(user_id=test_user.id, feed_id=test_feed.id)
        db_session.add(subscription)
        await db_session.flush()

        response = client.put(f"/api/v1/feeds/{test_feed.id}", json={"title": "Custom Title"})

        assert response.status_code == 200
        data = response.json()
        assert data["custom_feed_title"] == "Custom Title"

    @pytest.mark.asyncio
    async def test_update_feed_folder(
        self,
        client: TestClient,
        test_feed: Feed,
        test_folder: Folder,
        test_user: Profile,
        db_session: AsyncSession,
    ):
        """Test moving feed to different folder."""
        subscription = Subscription(user_id=test_user.id, feed_id=test_feed.id)
        db_session.add(subscription)
        await db_session.flush()

        response = client.put(f"/api/v1/feeds/{test_feed.id}", json={"folder_id": str(test_folder.id)})

        assert response.status_code == 200
        data = response.json()
        assert data["folder_id"] == str(test_folder.id)

    def test_update_feed_not_subscribed(self, client: TestClient, test_feed: Feed):
        """Test updating feed user is not subscribed to."""
        response = client.put(f"/api/v1/feeds/{test_feed.id}", json={"title": "New Title"})

        assert response.status_code == 404


class TestFeedRefresh:
    """Test feed refresh endpoint."""

    @pytest.mark.asyncio
    async def test_refresh_feed_success(
        self, client: TestClient, test_feed: Feed, test_user: Profile, db_session: AsyncSession, mock_feed_fetch
    ):
        """Test refreshing a feed."""
        subscription = Subscription(user_id=test_user.id, feed_id=test_feed.id)
        db_session.add(subscription)
        await db_session.flush()

        response = client.post(f"/api/v1/feeds/{test_feed.id}/refresh")

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == str(test_feed.id)

    def test_refresh_feed_not_subscribed(self, client: TestClient, test_feed: Feed):
        """Test refreshing feed user is not subscribed to."""
        response = client.post(f"/api/v1/feeds/{test_feed.id}/refresh")

        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_refresh_feed_preview_mode(self, client: TestClient, test_feed: Feed, mock_feed_fetch):
        """Test refreshing feed in preview mode."""
        response = client.post(f"/api/v1/feeds/{test_feed.id}/refresh?preview=true")

        assert response.status_code == 200


class TestFeedDelete:
    """Test feed deletion endpoint."""

    @pytest.mark.asyncio
    async def test_delete_feed_success(
        self, client: TestClient, test_feed: Feed, test_user: Profile, db_session: AsyncSession
    ):
        """Test deleting (unsubscribing from) a feed."""
        subscription = Subscription(user_id=test_user.id, feed_id=test_feed.id)
        db_session.add(subscription)
        await db_session.flush()

        response = client.delete(f"/api/v1/feeds/{test_feed.id}")

        assert response.status_code == 200

        # Verify subscription deleted
        result = await db_session.execute(
            select(Subscription).where(Subscription.feed_id == test_feed.id, Subscription.user_id == test_user.id)
        )
        subscription = result.scalar_one_or_none()
        assert subscription is None

    def test_delete_feed_not_subscribed(self, client: TestClient, test_feed: Feed):
        """Test deleting feed user is not subscribed to."""
        response = client.delete(f"/api/v1/feeds/{test_feed.id}")

        assert response.status_code == 404


class TestFeedBulkOperations:
    """Test bulk feed operations."""

    @pytest.mark.asyncio
    async def test_bulk_delete_feeds(self, client: TestClient, test_user: Profile, db_session: AsyncSession):
        """Test bulk deleting multiple feeds."""
        # Create multiple feeds and subscriptions
        feed_ids = []
        for i in range(3):
            feed = Feed(url=f"https://example.com/feed{i}.xml", title=f"Feed {i}")
            db_session.add(feed)
            await db_session.flush()

            subscription = Subscription(user_id=test_user.id, feed_id=feed.id)
            db_session.add(subscription)
            feed_ids.append(str(feed.id))

        await db_session.flush()

        response = client.post("/api/v1/feeds/bulk-delete", json={"feed_ids": feed_ids})

        assert response.status_code == 200
        data = response.json()
        assert data["deleted_count"] == 3

    @pytest.mark.asyncio
    async def test_bulk_update_folder(
        self, client: TestClient, test_folder: Folder, test_user: Profile, db_session: AsyncSession
    ):
        """Test bulk moving feeds to folder."""
        # Create multiple feeds and subscriptions
        feed_ids = []
        for i in range(3):
            feed = Feed(url=f"https://example.com/feed{i}.xml", title=f"Feed {i}")
            db_session.add(feed)
            await db_session.flush()

            subscription = Subscription(user_id=test_user.id, feed_id=feed.id)
            db_session.add(subscription)
            feed_ids.append(str(feed.id))

        await db_session.flush()

        response = client.post(
            "/api/v1/feeds/bulk-update-folder",
            json={"feed_ids": feed_ids, "folder_id": str(test_folder.id)},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["updated_count"] == 3


class TestAdminFeedOperations:
    """Test admin-only feed operations."""

    @pytest.mark.asyncio
    async def test_admin_update_feed(self, admin_client: TestClient, test_feed: Feed, db_session: AsyncSession):
        """Test admin updating global feed properties."""
        response = admin_client.put(
            f"/api/v1/feeds/{test_feed.id}/admin",
            json={"title": "Admin Updated Title"},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["title"] == "Admin Updated Title"

        # Verify in database
        await db_session.refresh(test_feed)
        assert test_feed.title == "Admin Updated Title"

    def test_admin_update_feed_non_admin(self, client: TestClient, test_feed: Feed):
        """Test non-admin cannot update global feed."""
        response = client.put(
            f"/api/v1/feeds/{test_feed.id}/admin",
            json={"title": "Hacked Title"},
        )

        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_admin_delete_feed(self, admin_client: TestClient, test_feed: Feed, db_session: AsyncSession):
        """Test admin deleting global feed."""
        feed_id = test_feed.id
        response = admin_client.delete(f"/api/v1/feeds/{feed_id}/admin")

        assert response.status_code == 204

        # Verify deleted from database
        result = await db_session.execute(select(Feed).where(Feed.id == feed_id))
        feed = result.scalar_one_or_none()
        assert feed is None

    def test_admin_delete_feed_non_admin(self, client: TestClient, test_feed: Feed):
        """Test non-admin cannot delete global feed."""
        response = client.delete(f"/api/v1/feeds/{test_feed.id}/admin")

        assert response.status_code == 403
