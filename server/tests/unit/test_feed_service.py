"""Tests for the FeedService."""

import pytest
from uuid import UUID, uuid4
from unittest.mock import Mock, AsyncMock, patch
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.services.feed_service import FeedService
from app.schemas.rss_schemas import FeedBase
from app.models.rss_models import Feed


@pytest.fixture
def mock_db():
    """Mock database session."""
    return Mock(spec=AsyncSession)


@pytest.fixture
def feed_service(mock_db):
    """Create FeedService instance."""
    return FeedService(mock_db)


@pytest.fixture
def sample_feed_data():
    """Sample feed data."""
    return FeedBase(
        url="https://example.com/feed.xml",
        title="Sample Feed",
        description="A sample feed",
        link="https://example.com",
        language="en",
        image_url="https://example.com/image.jpg",
        ttl=60,
    )


@pytest.fixture
def sample_feed_db():
    """Sample feed database object."""
    feed_id = uuid4()
    return Mock(
        id=feed_id,
        url="https://example.com/feed.xml",
        title="Sample Feed",
        description="A sample feed",
        link="https://example.com",
        language="en",
        image_url="https://example.com/image.jpg",
        ttl=60,
        skip_hours=None,
        skip_days=None,
        last_fetched_at=None,
        last_modified_header=None,
        etag_header=None,
        last_article_published_at=None,
        fetch_error_count=0,
        last_error_message=None,
        subscriber_count=5,
        average_update_frequency=None,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )


class TestFeedService:
    """Test cases for FeedService."""

    @pytest.mark.asyncio
    async def test_get_or_create_feed_creates_new(self, feed_service, sample_feed_data):
        """Should create new feed when it doesn't exist."""
        with patch('app.crud.crud_feed.create_feed') as mock_create:
            mock_feed = Mock()
            mock_feed.id = uuid4()
            mock_feed.url = str(sample_feed_data.url)
            mock_feed.subscriber_count = 1
            mock_create.return_value = mock_feed
            
            result = await feed_service.get_or_create_feed(feed_data=sample_feed_data)
            
            assert result == mock_feed
            mock_create.assert_called_once_with(feed_service.db, feed_data=sample_feed_data)

    @pytest.mark.asyncio
    async def test_get_feed_by_id_found(self, feed_service, sample_feed_db):
        """Should return feed when found by ID."""
        feed_id = sample_feed_db.id
        
        with patch('app.crud.crud_feed.get_feed_by_id') as mock_get:
            mock_get.return_value = sample_feed_db
            
            result = await feed_service.get_feed_by_id(feed_id=feed_id)
            
            assert result == sample_feed_db
            mock_get.assert_called_once_with(feed_service.db, feed_id=feed_id)

    @pytest.mark.asyncio
    async def test_get_feed_by_id_not_found(self, feed_service):
        """Should return None when feed not found."""
        feed_id = uuid4()
        
        with patch('app.crud.crud_feed.get_feed_by_id') as mock_get:
            mock_get.return_value = None
            
            result = await feed_service.get_feed_by_id(feed_id=feed_id)
            
            assert result is None

    @pytest.mark.asyncio
    async def test_get_feed_by_url_found(self, feed_service, sample_feed_db):
        """Should return feed when found by URL."""
        url = "https://example.com/feed.xml"
        
        with patch('app.crud.crud_feed.get_feed_by_url') as mock_get:
            mock_get.return_value = sample_feed_db
            
            result = await feed_service.get_feed_by_url(url=url)
            
            assert result == sample_feed_db
            mock_get.assert_called_once_with(feed_service.db, url=url)

    @pytest.mark.asyncio
    async def test_refresh_feed_not_found(self, feed_service):
        """Should return None when feed not found for refresh."""
        feed_id = uuid4()
        
        with patch('app.crud.crud_feed.get_feed_by_id') as mock_get:
            mock_get.return_value = None
            
            result = await feed_service.refresh_feed(feed_id=feed_id)
            
            assert result is None

    @pytest.mark.asyncio
    async def test_refresh_feed_not_modified(self, feed_service, sample_feed_db):
        """Should handle 304 Not Modified response."""
        feed_id = sample_feed_db.id
        
        # Mock successful fetch that returns 304
        mock_fetch_result = {
            "status_code": 304,
            "content": None,
            "headers": {}
        }
        
        with patch('app.crud.crud_feed.get_feed_by_id') as mock_get, \
             patch.object(feed_service.feed_fetcher, 'fetch_content') as mock_fetch, \
             patch('app.crud.crud_feed.update_feed_metadata') as mock_update:
            
            mock_get.return_value = sample_feed_db
            mock_fetch.return_value = mock_fetch_result
            mock_update.return_value = sample_feed_db
            
            result = await feed_service.refresh_feed(feed_id=feed_id)
            
            assert result is not None
            mock_fetch.assert_called_once()
            mock_update.assert_called_once()

    @pytest.mark.asyncio
    async def test_refresh_feed_fetch_error(self, feed_service, sample_feed_db):
        """Should handle fetch errors."""
        feed_id = sample_feed_db.id
        
        mock_fetch_result = {
            "status_code": 404,
            "content": None,
            "headers": {}
        }
        
        with patch('app.crud.crud_feed.get_feed_by_id') as mock_get, \
             patch.object(feed_service.feed_fetcher, 'fetch_content') as mock_fetch:
            
            mock_get.return_value = sample_feed_db
            mock_fetch.return_value = mock_fetch_result
            
            result = await feed_service.refresh_feed(feed_id=feed_id)
            
            assert result is None

    @pytest.mark.asyncio
    async def test_refresh_feed_successful_parse_and_update(self, feed_service, sample_feed_db):
        """Should successfully parse and update feed."""
        feed_id = sample_feed_db.id
        
        # Mock successful fetch with content
        mock_fetch_result = {
            "status_code": 200,
            "content": "<?xml version='1.0'?><rss><channel><title>Test</title></channel></rss>",
            "headers": {
                "etag": "test-etag",
                "last-modified": "Wed, 01 Jan 2023 00:00:00 GMT"
            }
        }
        
        # Mock parsed feed
        mock_parsed_feed = Mock()
        mock_parsed_feed.feed = Mock()
        mock_parsed_feed.feed.title = "Updated Title"
        mock_parsed_feed.feed.description = "Updated Description"
        mock_parsed_feed.entries = [Mock()]  # Add at least one entry
        
        with patch('app.crud.crud_feed.get_feed_by_id') as mock_get, \
             patch.object(feed_service.feed_fetcher, 'fetch_content') as mock_fetch, \
             patch.object(feed_service.feed_parser, 'parse_feed_data') as mock_parse, \
             patch.object(feed_service.feed_parser, 'extract_article_data') as mock_extract, \
             patch('app.crud.crud_feed.update_feed_metadata') as mock_update, \
             patch.object(feed_service, '_create_new_articles') as mock_create_articles:
            
            mock_get.return_value = sample_feed_db
            mock_fetch.return_value = mock_fetch_result
            mock_parse.return_value = mock_parsed_feed
            mock_extract.return_value = {"published_at": datetime.now(timezone.utc)}
            mock_update.return_value = sample_feed_db
            mock_create_articles.return_value = 0
            
            result = await feed_service.refresh_feed(feed_id=feed_id)
            
            assert result is not None
            mock_parse.assert_called_once()
            mock_update.assert_called_once()
            mock_create_articles.assert_called_once_with(sample_feed_db, [mock_parsed_feed.entries[0]])

    @pytest.mark.asyncio
    async def test_get_feeds_needing_refresh(self, feed_service):
        """Should get feeds needing refresh."""
        mock_feeds = [Mock(), Mock(), Mock()]
        
        with patch('app.crud.crud_feed.get_feeds_needing_refresh') as mock_get:
            mock_get.return_value = mock_feeds
            
            result = await feed_service.get_feeds_needing_refresh(limit=100)
            
            assert result == mock_feeds
            mock_get.assert_called_once_with(feed_service.db, limit=100)


    @pytest.mark.asyncio
    async def test_refresh_feed_force_refetch_ignores_cache_headers(
        self, feed_service, sample_feed_db
    ):
        """Should ignore cache headers when force_refetch is True."""
        feed_id = sample_feed_db.id
        sample_feed_db.etag_header = "existing-etag"
        sample_feed_db.last_modified_header = "existing-modified"
        
        mock_fetch_result = {
            "status_code": 200,
            "content": "<?xml version='1.0'?><rss><channel><title>Test</title></channel></rss>",
            "headers": {}
        }
        
        mock_parsed_feed = Mock()
        mock_parsed_feed.feed = Mock()
        mock_parsed_feed.entries = []
        
        with patch('app.crud.crud_feed.get_feed_by_id') as mock_get, \
             patch.object(feed_service.feed_fetcher, 'fetch_content') as mock_fetch, \
             patch.object(feed_service.feed_parser, 'parse_feed_data') as mock_parse, \
             patch('app.crud.crud_feed.update_feed_metadata') as mock_update, \
             patch.object(feed_service, '_create_new_articles') as mock_create_articles:
            
            mock_get.return_value = sample_feed_db
            mock_fetch.return_value = mock_fetch_result
            mock_parse.return_value = mock_parsed_feed
            mock_update.return_value = sample_feed_db
            mock_create_articles.return_value = 0
            
            await feed_service.refresh_feed(feed_id=feed_id, force_refetch=True)
            
            # Should call fetch_content with None for cache headers
            mock_fetch.assert_called_once_with(
                str(sample_feed_db.url), 
                etag=None, 
                last_modified=None
            )