"""Unit tests for RSS feeds router endpoints."""

import pytest
from unittest.mock import AsyncMock, Mock, patch
from uuid import uuid4
from datetime import datetime, timezone

from fastapi import HTTPException, status
from fastapi.testclient import TestClient

from app.main import app
from app.schemas.rss_schemas import FeedCreate, FeedResponse, FeedUpdate
from app.schemas.auth import TokenData
from app.routers.rss_feeds import (
    add_new_feed,
    list_feeds,
    get_feed,
    update_feed_settings,
    delete_feed,
    refresh_all_feeds,
    refresh_folder_feeds,
    refresh_feed
)


@pytest.mark.unit 
class TestRssFeedsRouter:
    """Test RSS feeds router endpoints."""

    def setup_method(self):
        self.db = AsyncMock()
        self.user_id = uuid4()
        self.current_user = TokenData(sub=str(self.user_id))

    @pytest.mark.asyncio
    async def test_add_new_feed_success(self):
        """Test successful feed creation."""
        folder_id = uuid4()
        tag_ids = [uuid4(), uuid4()]
        
        feed_in = FeedCreate(
            url="https://example.com/feed.xml",
            folder_id=folder_id,
            tag_ids=tag_ids
        )
        
        # Mock tag lookup with AsyncMock for async function
        mock_tag1 = Mock()
        mock_tag1.name = "tag1"
        mock_tag2 = Mock()
        mock_tag2.name = "tag2"
        
        with patch('app.crud.crud_tag.get_tag', new=AsyncMock()) as mock_get_tag:
            mock_get_tag.side_effect = [mock_tag1, mock_tag2]
            
            # Mock RSS service 
            with patch('app.routers.rss_feeds.RssService') as mock_service_class:
                mock_service = Mock()
                mock_service.add_new_feed = AsyncMock()
                mock_service_class.return_value = mock_service
                
                expected_feed = Mock()  # Use Mock instead of real FeedResponse
                mock_service.add_new_feed = AsyncMock(return_value=expected_feed)
                
                result = await add_new_feed(
                    db=self.db,
                    feed_in=feed_in,
                    current_user=self.current_user
                )
                
                assert result == expected_feed
                mock_service.add_new_feed.assert_called_once_with(
                    url=str(feed_in.url),
                    folder_id=folder_id,
                    tag_names=["tag1", "tag2"]
                )

    @pytest.mark.asyncio
    async def test_add_new_feed_tag_not_found(self):
        """Test feed creation with invalid tag ID."""
        folder_id = uuid4()
        invalid_tag_id = uuid4()
        
        feed_in = FeedCreate(
            url="https://example.com/feed.xml",
            folder_id=folder_id,
            tag_ids=[invalid_tag_id]
        )
        
        with patch('app.crud.crud_tag.get_tag', new=AsyncMock(return_value=None)):
            with pytest.raises(HTTPException) as exc_info:
                await add_new_feed(
                    db=self.db,
                    feed_in=feed_in,
                    current_user=self.current_user
                )
            
            assert exc_info.value.status_code == status.HTTP_400_BAD_REQUEST
            assert f"Tag with ID {invalid_tag_id} not found" in str(exc_info.value.detail)

    @pytest.mark.asyncio
    async def test_add_new_feed_no_tags(self):
        """Test feed creation without tags."""
        folder_id = uuid4()
        
        feed_in = FeedCreate(
            url="https://example.com/feed.xml",
            folder_id=folder_id,
            tag_ids=[]
        )
        
        with patch('app.routers.rss_feeds.RssService') as mock_service_class:
            mock_service = Mock()
            mock_service_class.return_value = mock_service
            
            expected_feed = Mock()
            mock_service.add_new_feed = AsyncMock(return_value=expected_feed)
            
            result = await add_new_feed(
                db=self.db,
                feed_in=feed_in,
                current_user=self.current_user
            )
            
            assert result == expected_feed
            mock_service.add_new_feed.assert_called_once_with(
                url=str(feed_in.url),
                folder_id=folder_id,
                tag_names=None
            )

    @pytest.mark.asyncio
    async def test_add_new_feed_service_error(self):
        """Test handling RSS service errors."""
        folder_id = uuid4()
        
        feed_in = FeedCreate(
            url="https://example.com/feed.xml",
            folder_id=folder_id,
            tag_ids=[]
        )
        
        with patch('app.routers.rss_feeds.RssService') as mock_service_class:
            mock_service = Mock()
            mock_service_class.return_value = mock_service
            mock_service.add_new_feed = AsyncMock(side_effect=ValueError("Feed already exists"))
            
            with pytest.raises(HTTPException) as exc_info:
                await add_new_feed(
                    db=self.db,
                    feed_in=feed_in,
                    current_user=self.current_user
                )
            
            assert exc_info.value.status_code == status.HTTP_400_BAD_REQUEST
            assert "Feed already exists" in str(exc_info.value.detail)

    @pytest.mark.asyncio
    async def test_list_feeds_success(self):
        """Test successful feed listing."""
        folder_id = uuid4()
        
        with patch('app.routers.rss_feeds.RssService') as mock_service_class:
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
                current_user=self.current_user
            )
            
            assert result == expected_feeds
            mock_service.list_feeds.assert_called_once_with(
                folder_id=folder_id,
                tag_names=None,
                is_favorite=None,
                search_query=None,
                skip=0,
                limit=100
            )

    @pytest.mark.asyncio
    async def test_list_feeds_with_filters(self):
        """Test feed listing with filters."""
        tag_names = ["tag1", "tag2"]
        
        with patch('app.routers.rss_feeds.RssService') as mock_service_class:
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
                current_user=self.current_user
            )
            
            assert result == expected_feeds
            mock_service.list_feeds.assert_called_once_with(
                folder_id=None,
                tag_names=tag_names,
                is_favorite=True,
                search_query="test",
                skip=10,
                limit=50
            )

    @pytest.mark.asyncio
    async def test_get_feed_success(self):
        """Test successful single feed retrieval."""
        feed_id = uuid4()
        
        with patch('app.routers.rss_feeds.RssService') as mock_service_class:
            mock_service = Mock()
            mock_service_class.return_value = mock_service
            
            expected_feed = Mock()
            mock_service.get_feed = AsyncMock(return_value=expected_feed)
            
            result = await get_feed(
                feed_id=feed_id,
                db=self.db,
                current_user=self.current_user
            )
            
            assert result == expected_feed
            mock_service.get_feed.assert_called_once_with(feed_id=feed_id)

    @pytest.mark.asyncio
    async def test_get_feed_not_found(self):
        """Test feed retrieval when feed doesn't exist."""
        feed_id = uuid4()
        
        with patch('app.routers.rss_feeds.RssService') as mock_service_class:
            mock_service = Mock()
            mock_service_class.return_value = mock_service
            mock_service.get_feed = AsyncMock(return_value=None)
            
            with pytest.raises(HTTPException) as exc_info:
                await get_feed(
                    feed_id=feed_id,
                    db=self.db,
                    current_user=self.current_user
                )
            
            assert exc_info.value.status_code == status.HTTP_404_NOT_FOUND
            assert "Feed not found" in str(exc_info.value.detail)

    @pytest.mark.asyncio
    async def test_update_feed_settings_success(self):
        """Test successful feed update."""
        feed_id = uuid4()
        new_folder_id = uuid4()
        
        feed_update = FeedUpdate(folder_id=new_folder_id)
        
        with patch('app.routers.rss_feeds.RssService') as mock_service_class:
            mock_service = Mock()
            mock_service_class.return_value = mock_service
            
            expected_feed = Mock()
            mock_service.update_feed_user_settings = AsyncMock(return_value=expected_feed)
            
            result = await update_feed_settings(
                feed_id=feed_id,
                feed_in=feed_update,
                db=self.db,
                current_user=self.current_user
            )
            
            assert result == expected_feed
            mock_service.update_feed_user_settings.assert_called_once_with(
                feed_id=feed_id, feed_in=feed_update
            )

    @pytest.mark.asyncio
    async def test_update_feed_settings_not_found(self):
        """Test feed update when feed doesn't exist."""
        feed_id = uuid4()
        feed_update = FeedUpdate(folder_id=uuid4())
        
        with patch('app.routers.rss_feeds.RssService') as mock_service_class:
            mock_service = Mock()
            mock_service_class.return_value = mock_service
            mock_service.update_feed_user_settings = AsyncMock(side_effect=ValueError("Feed not found"))
            
            with pytest.raises(HTTPException) as exc_info:
                await update_feed_settings(
                    feed_id=feed_id,
                    feed_in=feed_update,
                    db=self.db,
                    current_user=self.current_user
                )
            
            assert exc_info.value.status_code == status.HTTP_400_BAD_REQUEST
            assert "Feed not found" in str(exc_info.value.detail)

    @pytest.mark.asyncio
    async def test_delete_feed_success(self):
        """Test successful feed deletion."""
        feed_id = uuid4()
        
        with patch('app.routers.rss_feeds.RssService') as mock_service_class:
            mock_service = Mock()
            mock_service_class.return_value = mock_service
            mock_service.delete_feed = AsyncMock(return_value=True)
            
            result = await delete_feed(
                feed_id=feed_id,
                db=self.db,
                current_user=self.current_user
            )
            
            # The actual router returns a JSONResponse, not a dict
            assert result.status_code == 200
            mock_service.delete_feed.assert_called_once_with(feed_id=feed_id)

    @pytest.mark.asyncio
    async def test_delete_feed_not_found(self):
        """Test feed deletion when feed doesn't exist."""
        feed_id = uuid4()
        
        with patch('app.routers.rss_feeds.RssService') as mock_service_class:
            mock_service = Mock()
            mock_service_class.return_value = mock_service
            mock_service.delete_feed = AsyncMock(return_value=False)
            
            with pytest.raises(HTTPException) as exc_info:
                await delete_feed(
                    feed_id=feed_id,
                    db=self.db,
                    current_user=self.current_user
                )
            
            assert exc_info.value.status_code == status.HTTP_404_NOT_FOUND
            assert "Feed not found" in str(exc_info.value.detail)


    @pytest.mark.asyncio
    async def test_refresh_all_feeds_success(self):
        """Test triggering refresh of all user feeds."""
        with patch('app.workers.tasks.refresh_all_user_feeds_task.delay') as mock_task:
            mock_task.return_value.id = 'task-123'
            result = await refresh_all_feeds(
                db=self.db,
                current_user=self.current_user
            )
            
            assert "message" in result
            assert "task_id" in result
            mock_task.assert_called_once_with(user_id=str(self.user_id))

    @pytest.mark.asyncio
    async def test_refresh_folder_feeds_success(self):
        """Test triggering refresh of folder feeds."""
        folder_id = uuid4()
        
        # Mock folder exists
        with patch('app.crud.crud_folder.get_folder', new=AsyncMock(return_value=Mock())):
            with patch('app.workers.tasks.refresh_folder_feeds_task.delay') as mock_task:
                mock_task.return_value.id = 'task-456'
                result = await refresh_folder_feeds(
                    folder_id=folder_id,
                    db=self.db,
                    current_user=self.current_user
                )
                
                assert "message" in result
                assert "task_id" in result
                mock_task.assert_called_once_with(user_id=str(self.user_id), folder_id=str(folder_id))

    @pytest.mark.asyncio
    async def test_refresh_folder_feeds_folder_not_found(self):
        """Test refresh folder feeds when folder doesn't exist."""
        folder_id = uuid4()
        
        with patch('app.crud.crud_folder.get_folder', new=AsyncMock(return_value=None)):
            with pytest.raises(HTTPException) as exc_info:
                await refresh_folder_feeds(
                    folder_id=folder_id,
                    db=self.db,
                    current_user=self.current_user
                )
            
            assert exc_info.value.status_code == status.HTTP_404_NOT_FOUND
            assert "Folder not found" in str(exc_info.value.detail)

    @pytest.mark.asyncio
    async def test_refresh_feed_success(self):
        """Test triggering single feed refresh."""
        feed_id = uuid4()
        
        with patch('app.routers.rss_feeds.RssService') as mock_service_class:
            mock_service = Mock()
            mock_service_class.return_value = mock_service
            
            expected_feed = Mock()
            mock_service.refresh_feed = AsyncMock(return_value=expected_feed)
            
            result = await refresh_feed(
                feed_id=feed_id,
                force_refetch=False,
                db=self.db,
                current_user=self.current_user
            )
            
            assert result == expected_feed
            mock_service.refresh_feed.assert_called_once_with(
                feed_id=feed_id, force_refetch=False
            )

    @pytest.mark.asyncio
    async def test_refresh_feed_force_refetch(self):
        """Test forcing feed refresh."""
        feed_id = uuid4()
        
        with patch('app.routers.rss_feeds.RssService') as mock_service_class:
            mock_service = Mock()
            mock_service_class.return_value = mock_service
            
            expected_feed = Mock()
            mock_service.refresh_feed = AsyncMock(return_value=expected_feed)
            
            result = await refresh_feed(
                feed_id=feed_id,
                force_refetch=True,
                db=self.db,
                current_user=self.current_user
            )
            
            assert result == expected_feed
            mock_service.refresh_feed.assert_called_once_with(
                feed_id=feed_id, force_refetch=True
            )

    @pytest.mark.asyncio
    async def test_refresh_feed_not_found(self):
        """Test refresh when feed doesn't exist."""
        feed_id = uuid4()
        
        with patch('app.routers.rss_feeds.RssService') as mock_service_class:
            mock_service = Mock()
            mock_service_class.return_value = mock_service
            mock_service.refresh_feed = AsyncMock(return_value=None)
            
            with pytest.raises(HTTPException) as exc_info:
                await refresh_feed(
                    feed_id=feed_id,
                    force_refetch=False,
                    db=self.db,
                    current_user=self.current_user
                )
            
            assert exc_info.value.status_code == status.HTTP_404_NOT_FOUND
            assert "Feed not found" in str(exc_info.value.detail)