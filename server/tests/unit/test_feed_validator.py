"""Unit tests for FeedValidator service."""

import pytest
from unittest.mock import Mock

from app.services.feed_validator import FeedValidator
from app.core.custom_exceptions import ValidationError


@pytest.mark.unit
class TestFeedValidator:
    """Test FeedValidator functionality."""
    
    def setup_method(self):
        self.validator = FeedValidator()
    
    def test_validate_feed_structure_valid(self):
        """Test validation of valid feed structure."""
        mock_feed = Mock()
        mock_feed.feed = {"title": "Test Feed", "description": "Test Description"}
        mock_feed.entries = [
            {"title": "Entry 1", "link": "http://example.com/1"},
            {"title": "Entry 2", "link": "http://example.com/2"}
        ]
        mock_feed.get.return_value = mock_feed.entries
        
        # Should not raise an exception
        self.validator.validate_feed_structure(mock_feed)
    
    def test_validate_feed_structure_no_feed_data(self):
        """Test validation with missing feed data."""
        mock_feed = Mock()
        mock_feed.get.return_value = None
        
        with pytest.raises(ValidationError, match="Invalid feed format: No feed data found"):
            self.validator.validate_feed_structure(mock_feed)
    
    def test_validate_feed_structure_no_title(self):
        """Test validation with missing feed title."""
        mock_feed = Mock()
        mock_feed.feed = {"description": "Test Description"}
        mock_feed.entries = [{"title": "Entry 1"}]
        mock_feed.get.return_value = mock_feed.entries
        
        with pytest.raises(ValidationError, match="Invalid feed format: Feed title is missing"):
            self.validator.validate_feed_structure(mock_feed)
    
    def test_validate_feed_structure_no_entries(self):
        """Test validation with no entries."""
        mock_feed = Mock()
        mock_feed.feed = {"title": "Test Feed"}
        mock_feed.entries = []
        # Mock the get method to return the feed dict when called with 'feed'
        def mock_get(key, default=None):
            if key == 'feed':
                return mock_feed.feed
            elif key == 'entries':
                return mock_feed.entries
            return default
        mock_feed.get = mock_get
        
        with pytest.raises(ValidationError, match="Invalid feed format: No articles found in feed"):
            self.validator.validate_feed_structure(mock_feed)
    
    def test_validate_feed_structure_insufficient_content(self):
        """Test validation with insufficient content."""
        mock_feed = Mock()
        mock_feed.feed = {"title": "Test Feed"}
        mock_feed.entries = []  # Empty entries list
        def mock_get(key, default=None):
            if key == 'feed':
                return mock_feed.feed
            elif key == 'entries':
                return mock_feed.entries
            return default
        mock_feed.get = mock_get
        
        with pytest.raises(ValidationError, match="Invalid feed format: No articles found in feed"):
            self.validator.validate_feed_structure(mock_feed)
    
    def test_validate_feed_articles_valid(self):
        """Test validation of valid feed articles."""
        entries = [
            {"title": "Article 1", "summary": "Summary 1", "link": "http://example.com/1"},
            {"title": "Article 2", "summary": "Summary 2", "link": "http://example.com/2"}
        ]
        
        result = self.validator.validate_feed_articles(entries)
        
        assert result == True
    
    def test_validate_feed_articles_no_entries(self):
        """Test validation with no entries."""
        result = self.validator.validate_feed_articles([])
        
        assert result == False
    
    def test_validate_feed_articles_invalid_entries(self):
        """Test validation with invalid entries."""
        entries = [
            {},  # No title or summary or link
            {"other_field": "value"}  # Still no required fields
        ]
        
        result = self.validator.validate_feed_articles(entries)
        
        assert result == False
    
    def test_validate_feed_url_valid(self):
        """Test validation of valid URLs."""
        valid_urls = [
            "http://example.com/feed.xml",
            "https://example.com/rss",
            "https://subdomain.example.com/feeds/all.xml"
        ]
        
        for url in valid_urls:
            # Should not raise an exception
            self.validator.validate_feed_url(url)
    
    def test_validate_feed_url_invalid(self):
        """Test validation of invalid URLs."""
        # Test each case individually
        with pytest.raises(ValidationError, match="Feed URL cannot be empty"):
            self.validator.validate_feed_url("")
            
        with pytest.raises(ValidationError, match="Feed URL cannot be empty"):
            self.validator.validate_feed_url("   ")
            
        with pytest.raises(ValidationError, match="Feed URL must start with http:// or https://"):
            self.validator.validate_feed_url("ftp://example.com/feed")
            
        with pytest.raises(ValidationError, match="Feed URL must start with http:// or https://"):
            self.validator.validate_feed_url("not-a-url")
            
        with pytest.raises(ValidationError, match="Feed URL is too long \\(max 2000 characters\\)"):
            self.validator.validate_feed_url("http://example.com/" + "a" * 2100)
            
        with pytest.raises(ValidationError, match="Feed URL contains invalid characters"):
            self.validator.validate_feed_url("http://example .com/feed")
            
    
    def test_extract_feed_metadata(self):
        """Test extraction of feed metadata."""
        mock_feed = Mock()
        mock_feed.feed = {
            "title": "Test Feed",
            "description": "Test Description",
            "link": "http://example.com",
            "language": "en-US"
        }
        
        metadata = self.validator.extract_feed_metadata(mock_feed)
        
        assert metadata["title"] == "Test Feed"
        assert metadata["description"] == "Test Description"
        assert metadata["link"] == "http://example.com"
        assert metadata["language"] == "en"
    
    def test_extract_feed_metadata_with_defaults(self):
        """Test extraction with missing fields uses defaults."""
        mock_feed = Mock()
        mock_feed.feed = {}
        
        metadata = self.validator.extract_feed_metadata(mock_feed)
        
        assert metadata["title"] == "Untitled Feed"
        assert metadata["description"] == ""
        assert metadata["link"] == ""
        assert metadata["language"] == "en"
    
    def test_extract_feed_metadata_truncates_long_values(self):
        """Test that long values are truncated."""
        mock_feed = Mock()
        mock_feed.feed = {
            "title": "A" * 600,  # Over 500 char limit
            "description": "B" * 1100,  # Over 1000 char limit
            "link": "http://example.com/" + "c" * 2000,  # Over 2000 char limit
            "language": "en-US-extended"  # Over 10 char limit
        }
        
        metadata = self.validator.extract_feed_metadata(mock_feed)
        
        assert len(metadata["title"]) == 500
        assert len(metadata["description"]) == 1000
        assert len(metadata["link"]) == 2000
        assert len(metadata["language"]) == 2  # "en" after normalization