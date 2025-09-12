"""Unit tests for FeedCreationService."""

import pytest
from unittest.mock import AsyncMock, Mock, patch
from uuid import uuid4
from datetime import datetime, timezone

from app.services.feed_creation_service import FeedCreationService
from app.schemas.rss_schemas import ArticleCreate, FeedBase
from app.schemas.subscription_schemas import LegacyFeedResponse
from app.core.custom_exceptions import ValidationError, FeedSubscriptionError, FeedValidationError, NotFoundError, FeedConnectionError


@pytest.mark.unit
class TestFeedCreationService:
    """Test FeedCreationService functionality."""

    def setup_method(self):
        self.db = AsyncMock()
        self.user_id = uuid4()
        self.service = FeedCreationService(self.db, self.user_id)
        
        # Mock the dependencies
        self.service.feed_fetcher = Mock()
        self.service.feed_validator = Mock()
        self.service.article_extractor = Mock()
        self.service.feed_parser = Mock()

    @pytest.mark.asyncio
    async def test_add_new_feed_success(self):
        """Test successful feed creation."""
        url = "https://example.com/feed.xml"
        folder_id = uuid4()
        
        # Mock no existing feed
        with patch('app.crud.crud_feed.get_feed_by_url', new_callable=AsyncMock, return_value=None):
            # Mock folder validation
            with patch('app.crud.crud_folder.get_folder', new_callable=AsyncMock, return_value=Mock()):
                # Mock feed fetching and parsing
                self.service._fetch_and_parse_feed = AsyncMock()
                mock_parsed_feed = Mock()
                mock_parsed_feed.entries = [Mock()]
                self.service._fetch_and_parse_feed.return_value = mock_parsed_feed
                
                # Mock feed creation
                expected_response = Mock(spec=LegacyFeedResponse)
                expected_response.url = url
                self.service._create_new_feed = AsyncMock(return_value=expected_response)
                
                # Mock the deduplication service to prevent any issues
                with patch('app.services.feed_creation_service.FeedDeduplicationService') as mock_dedup_class:
                    mock_dedup = Mock()
                    mock_dedup.check_for_duplicates = AsyncMock()
                    mock_dedup_class.return_value = mock_dedup
                    
                    result = await self.service.add_new_feed(url, folder_id)
                
                assert result == expected_response
                self.service._fetch_and_parse_feed.assert_called_once_with(url)
                self.service._create_new_feed.assert_called_once()

    @pytest.mark.asyncio
    async def test_add_new_feed_existing_feed_update_false(self):
        """Test adding existing feed with update_existing=False should raise error."""
        url = "https://example.com/feed.xml"
        folder_id = uuid4()
        
        existing_feed = Mock()
        existing_feed.id = uuid4()
        
        with patch('app.crud.crud_feed.get_feed_by_url', return_value=existing_feed):
            # Mock that subscription already exists to trigger error
            existing_subscription = Mock()
            with patch('app.crud.crud_subscription.get_subscription_by_feed_id', return_value=existing_subscription):
                with pytest.raises(FeedSubscriptionError, match="You are already subscribed to feed"):
                    await self.service.add_new_feed(url, folder_id, update_existing=False)

    @pytest.mark.asyncio
    async def test_add_new_feed_existing_feed_update_true(self):
        """Test updating existing feed when update_existing=True."""
        url = "https://example.com/feed.xml"
        folder_id = uuid4()
        tag_names = ["tag1", "tag2"]
        
        existing_feed = Mock()
        existing_feed.id = uuid4()
        
        with patch('app.crud.crud_feed.get_feed_by_url', return_value=existing_feed):
            self.service._handle_existing_feed = AsyncMock()
            expected_response = Mock()
            self.service._handle_existing_feed.return_value = expected_response
            
            result = await self.service.add_new_feed(
                url, folder_id, tag_names, update_existing=True
            )
            
            assert result == expected_response
            self.service._handle_existing_feed.assert_called_once_with(
                existing_feed, url, folder_id, tag_names, True
            )

    @pytest.mark.asyncio
    async def test_validate_folder_success(self):
        """Test successful folder validation."""
        folder_id = uuid4()
        folder = Mock()
        
        with patch('app.crud.crud_folder.get_folder', return_value=folder):
            # Should not raise an exception
            await self.service._validate_folder(folder_id)

    @pytest.mark.asyncio
    async def test_validate_folder_not_found(self):
        """Test folder validation when folder not found."""
        folder_id = uuid4()
        
        with patch('app.crud.crud_folder.get_folder', return_value=None):
            with pytest.raises(NotFoundError, match="Folder with ID .* not found"):
                await self.service._validate_folder(folder_id)

    @pytest.mark.asyncio
    async def test_fetch_and_parse_feed_success(self):
        """Test successful feed fetching and parsing."""
        url = "https://example.com/feed.xml"
        
        # Mock successful fetch
        self.service._fetch_feed_content = AsyncMock()
        self.service._fetch_feed_content.return_value = {
            "status": 200,
            "content": "<rss></rss>"
        }
        
        # Mock successful parse
        self.service._parse_feed_data = Mock()
        mock_parsed_feed = Mock()
        self.service._parse_feed_data.return_value = mock_parsed_feed
        
        result = await self.service._fetch_and_parse_feed(url)
        
        assert result == mock_parsed_feed
        self.service._fetch_feed_content.assert_called_once_with(url)
        self.service._parse_feed_data.assert_called_once_with("<rss></rss>", url)

    @pytest.mark.asyncio
    async def test_fetch_and_parse_feed_connection_error(self):
        """Test handling connection errors during feed fetching."""
        url = "https://example.com/feed.xml"
        
        self.service._fetch_feed_content = AsyncMock()
        self.service._fetch_feed_content.side_effect = ConnectionError("Network error")
        
        with pytest.raises(ConnectionError):
            await self.service._fetch_and_parse_feed(url)

    @pytest.mark.asyncio
    async def test_fetch_and_parse_feed_invalid_status(self):
        """Test handling invalid HTTP status."""
        url = "https://example.com/feed.xml"
        
        self.service._fetch_feed_content = AsyncMock()
        self.service._fetch_feed_content.return_value = {
            "status": 404,
            "content": None
        }
        
        with pytest.raises(FeedConnectionError, match="Could not fetch feed content"):
            await self.service._fetch_and_parse_feed(url)


    @pytest.mark.asyncio
    async def test_validate_articles_success(self):
        """Test successful article validation."""
        db_feed = Mock()
        articles = [Mock(), Mock()]  # 2 valid articles
        total_entries = 2
        url = "https://example.com/feed.xml"
        
        # Should not raise an exception
        await self.service._validate_articles(db_feed, articles, total_entries, url)

    @pytest.mark.asyncio
    async def test_validate_articles_no_articles(self):
        """Test validation failure when no valid articles."""
        db_feed = Mock()
        db_feed.id = uuid4()
        articles = []  # No valid articles
        total_entries = 0
        url = "https://example.com/feed.xml"
        
        with pytest.raises(FeedValidationError, match="Feed appears to be broken: no entries found"):
            await self.service._validate_articles(db_feed, articles, total_entries, url)

    @pytest.mark.asyncio
    async def test_validate_articles_has_entries_no_valid_articles(self):
        """Test validation when feed has entries but no valid articles."""
        db_feed = Mock()
        db_feed.id = uuid4()
        articles = []  # No valid articles
        total_entries = 5  # But has entries
        url = "https://example.com/feed.xml"
        
        with pytest.raises(FeedValidationError, match="no valid articles found despite having entries"):
            await self.service._validate_articles(db_feed, articles, total_entries, url)

    def test_extract_ttl_valid(self):
        """Test TTL extraction with valid value."""
        parsed_feed = Mock()
        parsed_feed.feed = {"ttl": "60"}
        feed_id = uuid4()
        
        result = self.service._extract_ttl(parsed_feed, feed_id)
        
        assert result == 60

    def test_extract_ttl_invalid(self):
        """Test TTL extraction with invalid value."""
        parsed_feed = Mock()
        parsed_feed.feed = {"ttl": "invalid"}
        feed_id = uuid4()
        
        result = self.service._extract_ttl(parsed_feed, feed_id)
        
        assert result is None

    def test_extract_ttl_missing(self):
        """Test TTL extraction when not present."""
        parsed_feed = Mock()
        parsed_feed.feed = {}
        feed_id = uuid4()
        
        result = self.service._extract_ttl(parsed_feed, feed_id)
        
        assert result is None

    def test_extract_skip_hours_valid(self):
        """Test skip hours extraction with valid values."""
        parsed_feed = Mock()
        parsed_feed.feed = {"skipHours": {"hour": [1, 2, 23]}}
        feed_id = uuid4()
        
        result = self.service._extract_skip_hours(parsed_feed, feed_id)
        
        assert result == [1, 2, 23]

    def test_extract_skip_hours_invalid_values(self):
        """Test skip hours extraction with some invalid values."""
        parsed_feed = Mock()
        parsed_feed.feed = {"skipHours": {"hour": [1, 25, "invalid", 12]}}  # 25 and "invalid" are invalid
        feed_id = uuid4()
        
        result = self.service._extract_skip_hours(parsed_feed, feed_id)
        
        assert result == [1, 12]

    def test_extract_skip_days_valid(self):
        """Test skip days extraction with valid values."""
        parsed_feed = Mock()
        parsed_feed.feed = {"skipDays": {"day": ["Monday", "Friday"]}}
        feed_id = uuid4()
        
        result = self.service._extract_skip_days(parsed_feed, feed_id)
        
        assert result == ["Monday", "Friday"]

    def test_extract_skip_days_invalid_values(self):
        """Test skip days extraction with some invalid values."""
        parsed_feed = Mock()
        parsed_feed.feed = {"skipDays": {"day": ["Monday", "InvalidDay", "Friday"]}}
        feed_id = uuid4()
        
        result = self.service._extract_skip_days(parsed_feed, feed_id)
        
        assert result == ["Monday", "Friday"]

    def test_extract_article_data_success(self):
        """Test successful article data extraction."""
        entry = Mock()
        feed_id = uuid4()
        
        expected_article = ArticleCreate(
            title="Test Article",
            link="https://example.com/article",
            content="Test content",
            author="Test Author",
            published_at=None,
            guid="test-guid",
            feed_id=feed_id,
            user_id=self.user_id,
            image_url=None,
            estimated_read_time_minutes=None,
        )
        
        # Mock the feed_parser.extract_article_data method
        article_dict = {
            "title": "Test Article",
            "link": "https://example.com/article",
            "content": "Test content",
            "author": "Test Author",
            "published_at": None,
            "guid": "test-guid",
            "image_url": None,
            "estimated_read_time_minutes": None,
        }
        self.service.feed_parser.extract_article_data.return_value = article_dict
        
        result = self.service._extract_article_data(entry, feed_id, self.user_id)
        
        assert result == expected_article
        self.service.feed_parser.extract_article_data.assert_called_once_with(
            entry, None
        )

    def test_extract_article_data_failure(self):
        """Test article data extraction failure."""
        entry = Mock()
        entry.get.return_value = "test-id"
        feed_id = uuid4()
        
        self.service.feed_parser.extract_article_data.side_effect = Exception("Extraction error")
        
        result = self.service._extract_article_data(entry, feed_id, self.user_id)
        
        assert result is None

    def test_extract_feed_metadata(self):
        """Test feed metadata extraction."""
        parsed_feed = Mock()
        parsed_feed.get.return_value = {"title": "Test", "image": {"href": "http://example.com/img.png"}}
        feed_url = "https://example.com/feed.xml"
        
        # Mock validator response
        self.service.feed_validator.extract_feed_metadata.return_value = {
            "title": "Test Feed",
            "description": "Test Description", 
            "link": "https://example.com",
            "language": "en"
        }
        
        result = self.service._extract_feed_metadata(parsed_feed, feed_url)
        
        assert isinstance(result, FeedBase)
        assert result.title == "Test Feed"
        assert str(result.url) == feed_url