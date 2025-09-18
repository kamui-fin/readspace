"""Unit tests for RSS feeds router endpoints."""

from unittest.mock import AsyncMock, Mock, patch
from uuid import uuid4

import pytest
from fastapi import HTTPException, status

from app.routers.rss_feeds import (
    delete_feed,
    get_feed,
    list_feeds,
    refresh_feed,
    update_feed_settings,
)
from app.schemas.auth import TokenData
from app.schemas.rss_schemas import FeedUpdate


@pytest.mark.unit
class TestRssFeedsRouter:
    """Test RSS feeds router endpoints."""

    def setup_method(self):
        self.db = AsyncMock()
        self.user_id = uuid4()
        self.current_user = TokenData(sub=str(self.user_id))

    @pytest.mark.asyncio
    async def test_list_feeds_success(self):
        """Test successful feed listing."""
        folder_id = uuid4()

        with patch("app.routers.rss_feeds.RssOrchestrationService") as mock_service_class:
            mock_service = Mock()
            mock_service_class.return_value = mock_service

            expected_feeds = [Mock(), Mock()]
            mock_service.list_feeds = AsyncMock(return_value=expected_feeds)

            result = await list_feeds(
                folder_id=folder_id,
                tag_names=None,
                is_favorite=None,
                search_query=None,
                skip=0,
                limit=100,
                db=self.db,
                current_user=self.current_user,
            )

            assert result == expected_feeds
            mock_service.list_feeds.assert_called_once_with(
                folder_id=folder_id,
                tag_names=None,
                is_favorite=None,
                search_query=None,
                skip=0,
                limit=100,
            )

    @pytest.mark.asyncio
    async def test_list_feeds_with_filters(self):
        """Test feed listing with filters."""
        tag_names = ["tag1", "tag2"]

        with patch("app.routers.rss_feeds.RssOrchestrationService") as mock_service_class:
            mock_service = Mock()
            mock_service_class.return_value = mock_service

            expected_feeds = [Mock()]
            mock_service.list_feeds = AsyncMock(return_value=expected_feeds)

            result = await list_feeds(
                folder_id=None,
                tag_names=tag_names,
                is_favorite=True,
                search_query="test",
                skip=10,
                limit=50,
                db=self.db,
                current_user=self.current_user,
            )

            assert result == expected_feeds
            mock_service.list_feeds.assert_called_once_with(
                folder_id=None,
                tag_names=tag_names,
                is_favorite=True,
                search_query="test",
                skip=10,
                limit=50,
            )

    @pytest.mark.asyncio
    async def test_get_feed_success(self):
        """Test successful single feed retrieval."""
        feed_id = uuid4()

        with patch("app.routers.rss_feeds.RssOrchestrationService") as mock_service_class:
            mock_service = Mock()
            mock_service_class.return_value = mock_service

            expected_feed = Mock()
            mock_service.get_feed = AsyncMock(return_value=expected_feed)

            result = await get_feed(feed_id=feed_id, db=self.db, current_user=self.current_user)

            assert result == expected_feed
            mock_service.get_feed.assert_called_once_with(feed_id=feed_id)

    @pytest.mark.asyncio
    async def test_get_feed_not_found(self):
        """Test feed retrieval when feed doesn't exist."""
        feed_id = uuid4()

        with patch("app.routers.rss_feeds.RssOrchestrationService") as mock_service_class:
            mock_service = Mock()
            mock_service_class.return_value = mock_service
            mock_service.get_feed = AsyncMock(return_value=None)

            with pytest.raises(HTTPException) as exc_info:
                await get_feed(feed_id=feed_id, db=self.db, current_user=self.current_user)

            assert exc_info.value.status_code == status.HTTP_404_NOT_FOUND
            assert "Feed not found" in str(exc_info.value.detail)

    @pytest.mark.asyncio
    async def test_update_feed_settings_success(self):
        """Test successful feed update."""
        feed_id = uuid4()
        new_folder_id = uuid4()

        feed_update = FeedUpdate(folder_id=new_folder_id)

        with patch("app.routers.rss_feeds.RssOrchestrationService") as mock_service_class:
            mock_service = Mock()
            mock_service_class.return_value = mock_service

            expected_feed = Mock()
            mock_service.update_feed_user_settings = AsyncMock(return_value=expected_feed)

            result = await update_feed_settings(
                feed_id=feed_id,
                feed_in=feed_update,
                db=self.db,
                current_user=self.current_user,
            )

            assert result == expected_feed
            mock_service.update_feed_user_settings.assert_called_once_with(feed_id=feed_id, feed_in=feed_update)

    @pytest.mark.asyncio
    async def test_update_feed_settings_not_found(self):
        """Test feed update when feed doesn't exist."""
        feed_id = uuid4()
        feed_update = FeedUpdate(folder_id=uuid4())

        from app.core.custom_exceptions import NotFoundError

        with patch("app.routers.rss_feeds.RssOrchestrationService") as mock_service_class:
            mock_service = Mock()
            mock_service_class.return_value = mock_service
            mock_service.update_feed_user_settings = AsyncMock(side_effect=NotFoundError("Feed not found"))

            with pytest.raises(HTTPException) as exc_info:
                await update_feed_settings(
                    feed_id=feed_id,
                    feed_in=feed_update,
                    db=self.db,
                    current_user=self.current_user,
                )

            assert exc_info.value.status_code == status.HTTP_400_BAD_REQUEST
            assert "Feed not found" in str(exc_info.value.detail)

    @pytest.mark.asyncio
    async def test_delete_feed_success(self):
        """Test successful feed deletion."""
        feed_id = uuid4()

        with patch("app.routers.rss_feeds.RssOrchestrationService") as mock_service_class:
            mock_service = Mock()
            mock_service_class.return_value = mock_service
            mock_service.delete_feed = AsyncMock(return_value=True)

            result = await delete_feed(feed_id=feed_id, db=self.db, current_user=self.current_user)

            # The actual router returns a JSONResponse, not a dict
            assert result.status_code == 200
            mock_service.delete_feed.assert_called_once_with(feed_id=feed_id)

    @pytest.mark.asyncio
    async def test_delete_feed_not_found(self):
        """Test feed deletion when feed doesn't exist."""
        feed_id = uuid4()

        with patch("app.routers.rss_feeds.RssOrchestrationService") as mock_service_class:
            mock_service = Mock()
            mock_service_class.return_value = mock_service
            mock_service.delete_feed = AsyncMock(return_value=False)

            with pytest.raises(HTTPException) as exc_info:
                await delete_feed(feed_id=feed_id, db=self.db, current_user=self.current_user)

            assert exc_info.value.status_code == status.HTTP_404_NOT_FOUND
            assert "Feed not found" in str(exc_info.value.detail)

    @pytest.mark.asyncio
    async def test_refresh_feed_success(self):
        """Test triggering single feed refresh."""
        feed_id = uuid4()

        with patch("app.routers.rss_feeds.RssOrchestrationService") as mock_service_class:
            mock_service = Mock()
            mock_service_class.return_value = mock_service

            expected_feed = Mock()
            mock_service.refresh_feed = AsyncMock(return_value=expected_feed)

            result = await refresh_feed(
                feed_id=feed_id,
                force_refetch=False,
                preview=False,
                db=self.db,
                current_user=self.current_user,
            )

            assert result == expected_feed
            mock_service.refresh_feed.assert_called_once_with(feed_id=feed_id, force_refetch=False, preview_mode=False)

    @pytest.mark.asyncio
    async def test_refresh_feed_force_refetch(self):
        """Test forcing feed refresh."""
        feed_id = uuid4()

        with patch("app.routers.rss_feeds.RssOrchestrationService") as mock_service_class:
            mock_service = Mock()
            mock_service_class.return_value = mock_service

            expected_feed = Mock()
            mock_service.refresh_feed = AsyncMock(return_value=expected_feed)

            result = await refresh_feed(
                feed_id=feed_id,
                force_refetch=True,
                preview=False,
                db=self.db,
                current_user=self.current_user,
            )

            assert result == expected_feed
            mock_service.refresh_feed.assert_called_once_with(feed_id=feed_id, force_refetch=True, preview_mode=False)

    @pytest.mark.asyncio
    async def test_refresh_feed_not_found(self):
        """Test refresh when feed doesn't exist."""
        feed_id = uuid4()

        with patch("app.routers.rss_feeds.RssOrchestrationService") as mock_service_class:
            mock_service = Mock()
            mock_service_class.return_value = mock_service
            mock_service.refresh_feed = AsyncMock(return_value=None)

            with pytest.raises(HTTPException) as exc_info:
                await refresh_feed(
                    feed_id=feed_id,
                    force_refetch=False,
                    preview=False,
                    db=self.db,
                    current_user=self.current_user,
                )

            assert exc_info.value.status_code == status.HTTP_404_NOT_FOUND
            assert "Feed not found" in str(exc_info.value.detail)
