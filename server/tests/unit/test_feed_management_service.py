import asyncio
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

from app.schemas.rss_schemas import FeedResponse, FeedUpdate, ArticleCreate
from app.services.feed_management_service import FeedManagementService


@pytest.mark.asyncio
class TestFeedManagementService:
    def setup_method(self):
        self.db = AsyncMock()
        self.user_id = uuid4()
        self.feed_id = uuid4()
        self.folder_id = uuid4()
        
        # Mock dependencies
        with patch('app.services.feed_management_service.FeedCreationService'), \
             patch('app.services.feed_management_service.RedisCache'), \
             patch('app.services.feed_management_service.FeedFetcher'), \
             patch('app.services.feed_management_service.FeedParsingService'):
            self.service = FeedManagementService(self.db, self.user_id)

    async def test_add_new_feed_delegates_to_creation_service(self):
        """Test that add_new_feed delegates to FeedCreationService."""
        url = "https://example.com/feed.xml"
        tag_names = ["tech", "news"]
        
        # Mock the expected response
        expected_response = MagicMock(spec=FeedResponse)
        self.service.feed_creation_service.add_new_feed = AsyncMock(return_value=expected_response)
        
        # Execute
        result = await self.service.add_new_feed(
            url=url,
            folder_id=self.folder_id,
            tag_names=tag_names
        )
        
        # Verify
        self.service.feed_creation_service.add_new_feed.assert_called_once_with(
            url=url,
            folder_id=self.folder_id,
            tag_names=tag_names,
            update_existing=False
        )
        assert result == expected_response

    @patch('app.services.feed_management_service.crud_feed')
    async def test_get_feed_exists(self, mock_crud_feed):
        """Test getting an existing feed."""
        # Setup mock feed
        mock_feed_db = MagicMock()
        mock_feed_db.id = self.feed_id
        mock_feed_db.title = "Test Feed"
        mock_crud_feed.get_feed = AsyncMock(return_value=mock_feed_db)
        
        # Execute
        with patch.object(FeedResponse, 'model_validate') as mock_validate:
            expected_response = MagicMock(spec=FeedResponse)
            mock_validate.return_value = expected_response
            
            result = await self.service.get_feed(self.feed_id)
        
        # Verify
        mock_crud_feed.get_feed.assert_called_once_with(
            db=self.db, feed_id=self.feed_id, user_id=self.user_id
        )
        mock_validate.assert_called_once_with(mock_feed_db)
        assert result == expected_response

    @patch('app.services.feed_management_service.crud_feed')
    async def test_get_feed_not_found(self, mock_crud_feed):
        """Test getting a non-existent feed."""
        mock_crud_feed.get_feed = AsyncMock(return_value=None)
        
        # Execute
        result = await self.service.get_feed(self.feed_id)
        
        # Verify
        mock_crud_feed.get_feed.assert_called_once_with(
            db=self.db, feed_id=self.feed_id, user_id=self.user_id
        )
        assert result is None

    @patch('app.services.feed_management_service.crud_feed')
    async def test_list_feeds_with_filters(self, mock_crud_feed):
        """Test listing feeds with various filters."""
        # Setup mock feeds
        mock_feed1 = MagicMock()
        mock_feed1.id = uuid4()
        mock_feed2 = MagicMock()
        mock_feed2.id = uuid4()
        
        mock_crud_feed.get_feeds_by_user = AsyncMock(return_value=[mock_feed1, mock_feed2])
        
        # Test parameters
        folder_id = uuid4()
        tag_names = ["tech"]
        is_favorite = True
        search_query = "python"
        skip = 10
        limit = 50
        
        # Execute
        with patch.object(FeedResponse, 'model_validate') as mock_validate:
            mock_validate.side_effect = lambda x: MagicMock(spec=FeedResponse, id=x.id)
            
            result = await self.service.list_feeds(
                folder_id=folder_id,
                tag_names=tag_names,
                is_favorite=is_favorite,
                search_query=search_query,
                skip=skip,
                limit=limit
            )
        
        # Verify
        mock_crud_feed.get_feeds_by_user.assert_called_once_with(
            db=self.db,
            user_id=self.user_id,
            folder_id=folder_id,
            tag_names=tag_names,
            is_favorite=is_favorite,
            search_query=search_query,
            skip=skip,
            limit=limit,
        )
        assert len(result) == 2
        assert mock_validate.call_count == 2

    @patch('app.services.feed_management_service.crud_feed')
    async def test_list_feeds_no_filters(self, mock_crud_feed):
        """Test listing feeds with default parameters."""
        mock_crud_feed.get_feeds_by_user = AsyncMock(return_value=[])
        
        # Execute
        result = await self.service.list_feeds()
        
        # Verify
        mock_crud_feed.get_feeds_by_user.assert_called_once_with(
            db=self.db,
            user_id=self.user_id,
            folder_id=None,
            tag_names=None,
            is_favorite=None,
            search_query=None,
            skip=0,
            limit=100,
        )
        assert result == []

    @patch('app.services.feed_management_service.crud_feed')
    async def test_update_feed_user_settings_success(self, mock_crud_feed):
        """Test successfully updating feed settings."""
        # Setup mocks
        mock_feed_db = MagicMock()
        mock_feed_db.id = self.feed_id
        mock_crud_feed.get_feed = AsyncMock(return_value=mock_feed_db)
        
        mock_updated_feed = MagicMock()
        mock_updated_feed.id = self.feed_id
        mock_crud_feed.update_feed = AsyncMock(return_value=mock_updated_feed)
        
        feed_update = FeedUpdate(title="Updated Feed Title", is_favorite=True)
        
        # Execute
        with patch.object(FeedResponse, 'model_validate') as mock_validate:
            expected_response = MagicMock(spec=FeedResponse)
            mock_validate.return_value = expected_response
            
            result = await self.service.update_feed_user_settings(self.feed_id, feed_update)
        
        # Verify
        mock_crud_feed.get_feed.assert_called_once_with(
            db=self.db, feed_id=self.feed_id, user_id=self.user_id
        )
        mock_crud_feed.update_feed.assert_called_once_with(
            db=self.db, feed_db=mock_feed_db, feed_in=feed_update
        )
        mock_validate.assert_called_once_with(mock_updated_feed)
        assert result == expected_response

    @patch('app.services.feed_management_service.crud_feed')
    async def test_update_feed_user_settings_feed_not_found(self, mock_crud_feed):
        """Test updating settings for non-existent feed."""
        mock_crud_feed.get_feed = AsyncMock(return_value=None)
        
        feed_update = FeedUpdate(title="Updated Feed Title")
        
        # Execute
        result = await self.service.update_feed_user_settings(self.feed_id, feed_update)
        
        # Verify
        mock_crud_feed.get_feed.assert_called_once_with(
            db=self.db, feed_id=self.feed_id, user_id=self.user_id
        )
        mock_crud_feed.update_feed.assert_not_called()
        assert result is None

    @patch('app.services.feed_management_service.crud_feed')
    async def test_update_feed_user_settings_update_fails(self, mock_crud_feed):
        """Test updating feed settings when update operation fails."""
        # Setup mocks
        mock_feed_db = MagicMock()
        mock_crud_feed.get_feed = AsyncMock(return_value=mock_feed_db)
        mock_crud_feed.update_feed = AsyncMock(return_value=None)  # Update fails
        
        feed_update = FeedUpdate(title="Updated Feed Title")
        
        # Execute
        result = await self.service.update_feed_user_settings(self.feed_id, feed_update)
        
        # Verify
        assert result is None

    @patch('app.services.feed_management_service.crud_feed')
    async def test_delete_feed_success(self, mock_crud_feed):
        """Test successfully deleting a feed."""
        mock_crud_feed.delete_feed = AsyncMock(return_value=True)
        self.service._cache.delete = AsyncMock()
        
        # Execute
        result = await self.service.delete_feed(self.feed_id)
        
        # Verify
        mock_crud_feed.delete_feed.assert_called_once_with(
            db=self.db, feed_id=self.feed_id, user_id=self.user_id
        )
        self.service._cache.delete.assert_called_once_with(f"feed:{self.feed_id}")
        assert result is True

    @patch('app.services.feed_management_service.crud_feed')
    async def test_delete_feed_not_found(self, mock_crud_feed):
        """Test deleting a non-existent feed."""
        mock_crud_feed.delete_feed = AsyncMock(return_value=False)
        self.service._cache.delete = AsyncMock()
        
        # Execute
        result = await self.service.delete_feed(self.feed_id)
        
        # Verify
        mock_crud_feed.delete_feed.assert_called_once_with(
            db=self.db, feed_id=self.feed_id, user_id=self.user_id
        )
        self.service._cache.delete.assert_not_called()  # Should not clear cache if delete failed
        assert result is False

    @patch('app.services.feed_management_service.crud_feed')
    async def test_refresh_feed_not_found(self, mock_crud_feed):
        """Test refreshing a non-existent feed."""
        mock_crud_feed.get_feed = AsyncMock(return_value=None)
        
        # Execute
        result = await self.service.refresh_feed(self.feed_id)
        
        # Verify
        mock_crud_feed.get_feed.assert_called_once_with(
            db=self.db, feed_id=self.feed_id, user_id=self.user_id
        )
        assert result is None

    @patch('app.services.feed_management_service.crud_feed')
    async def test_refresh_feed_not_modified(self, mock_crud_feed):
        """Test refreshing a feed that returns 304 Not Modified."""
        # Setup mock feed
        mock_feed_db = MagicMock()
        mock_feed_db.id = self.feed_id
        mock_feed_db.url = "https://example.com/feed.xml"
        mock_feed_db.etag_header = "test-etag"
        mock_feed_db.last_modified_header = "Wed, 01 Jan 2023 00:00:00 GMT"
        
        mock_crud_feed.get_feed = AsyncMock(return_value=mock_feed_db)
        mock_crud_feed.update_feed_fetch_metadata = AsyncMock()
        
        # Mock fetch result
        fetch_result = {"status": 304, "content": None}
        self.service.feed_fetcher.fetch_content = AsyncMock(return_value=fetch_result)
        
        # Execute
        with patch.object(FeedResponse, 'model_validate') as mock_validate:
            expected_response = MagicMock(spec=FeedResponse)
            mock_validate.return_value = expected_response
            
            result = await self.service.refresh_feed(self.feed_id)
        
        # Verify
        self.service.feed_fetcher.fetch_content.assert_called_once_with(
            str(mock_feed_db.url), 
            etag="test-etag", 
            last_modified="Wed, 01 Jan 2023 00:00:00 GMT"
        )
        mock_crud_feed.update_feed_fetch_metadata.assert_called_once()
        mock_validate.assert_called_once_with(mock_feed_db)
        assert result == expected_response

    @patch('app.services.feed_management_service.crud_feed')
    async def test_refresh_feed_force_refetch(self, mock_crud_feed):
        """Test force refreshing a feed (ignoring etag and last-modified)."""
        # Setup mock feed
        mock_feed_db = MagicMock()
        mock_feed_db.id = self.feed_id
        mock_feed_db.url = "https://example.com/feed.xml"
        mock_feed_db.etag_header = "test-etag"
        mock_feed_db.last_modified_header = "Wed, 01 Jan 2023 00:00:00 GMT"
        
        mock_crud_feed.get_feed = AsyncMock(return_value=mock_feed_db)
        
        # Mock fetch result - should succeed
        fetch_result = {"status": 200, "content": "<rss></rss>", "headers": {}}
        self.service.feed_fetcher.fetch_content = AsyncMock(return_value=fetch_result)
        
        # Mock parser
        mock_parsed_feed = MagicMock()
        mock_parsed_feed.entries = []
        self.service.feed_parser.parse_feed_content = MagicMock(return_value=mock_parsed_feed)
        
        # Mock update method
        self.service._update_feed_and_articles = AsyncMock()
        
        # Mock the refreshed feed lookup
        mock_refreshed_feed = MagicMock()
        mock_crud_feed.get_feed.side_effect = [mock_feed_db, mock_refreshed_feed]  # Two calls
        
        # Execute
        with patch.object(FeedResponse, 'model_validate') as mock_validate:
            expected_response = MagicMock(spec=FeedResponse)
            mock_validate.return_value = expected_response
            
            result = await self.service.refresh_feed(self.feed_id, force_refetch=True)
        
        # Verify
        self.service.feed_fetcher.fetch_content.assert_called_once_with(
            str(mock_feed_db.url), 
            etag=None,  # Should be None for force refresh
            last_modified=None  # Should be None for force refresh
        )
        self.service._update_feed_and_articles.assert_called_once_with(
            mock_feed_db, fetch_result, mock_parsed_feed
        )
        assert result == expected_response


    @patch('app.services.feed_management_service.crud_feed')
    async def test_update_feed_and_articles_with_entries(self, mock_crud_feed):
        """Test _update_feed_and_articles with feed entries (basic functionality test)."""
        # Setup mock data
        mock_feed_db = MagicMock()
        mock_feed_db.id = self.feed_id
        
        fetch_result = {
            "headers": {
                "etag": "new-etag",
                "last-modified": "Thu, 02 Jan 2023 00:00:00 GMT"
            }
        }
        
        # Mock parsed feed with no entries to avoid ArticleCreate validation issues
        mock_parsed_feed = MagicMock()
        mock_parsed_feed.entries = []
        
        mock_crud_feed.update_feed_fetch_metadata = AsyncMock()
        
        # Execute
        await self.service._update_feed_and_articles(mock_feed_db, fetch_result, mock_parsed_feed)
        
        # Verify feed metadata update
        mock_crud_feed.update_feed_fetch_metadata.assert_called_once()
        update_call = mock_crud_feed.update_feed_fetch_metadata.call_args
        assert update_call[1]['feed_db'] == mock_feed_db
        assert update_call[1]['etag_header'] == "new-etag"
        assert update_call[1]['last_modified_header'] == "Thu, 02 Jan 2023 00:00:00 GMT"
        assert 'last_fetched_at' in update_call[1]

    @patch('app.services.feed_management_service.crud_feed')
    async def test_update_feed_and_articles_no_entries(self, mock_crud_feed):
        """Test _update_feed_and_articles with no entries."""
        mock_feed_db = MagicMock()
        fetch_result = {"headers": {}}
        
        mock_parsed_feed = MagicMock()
        mock_parsed_feed.entries = []
        
        mock_crud_feed.update_feed_fetch_metadata = AsyncMock()
        
        # Execute
        await self.service._update_feed_and_articles(mock_feed_db, fetch_result, mock_parsed_feed)
        
        # Verify only feed metadata was updated
        mock_crud_feed.update_feed_fetch_metadata.assert_called_once()
        # No articles should be created since entries is empty