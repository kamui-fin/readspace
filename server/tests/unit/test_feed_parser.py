"""
Unit tests for feed parsing logic - no database dependencies
"""

from datetime import datetime
from unittest.mock import Mock, patch

import pytest

from app.core.custom_exceptions import FeedParsingError
from app.services.feed_parser import FeedParsingService


@pytest.mark.unit
class TestFeedParsingService:
    """Test feed parsing business logic"""

    def setup_method(self):
        self.parser = FeedParsingService(default_wpm=200)

    def test_parse_valid_rss_feed(self):
        """Test parsing a valid RSS feed"""
        rss_content = """<?xml version="1.0" encoding="UTF-8"?>
        <rss version="2.0">
            <channel>
                <title>Test Feed</title>
                <description>A test RSS feed</description>
                <link>https://example.com</link>
                <item>
                    <title>Test Article</title>
                    <link>https://example.com/article1</link>
                    <description>Test description</description>
                    <guid>test-guid-1</guid>
                    <pubDate>Mon, 01 Jan 2024 12:00:00 GMT</pubDate>
                </item>
            </channel>
        </rss>"""

        parsed_feed = self.parser.parse_feed_data(rss_content, "https://example.com/feed.xml")

        assert parsed_feed is not None
        assert parsed_feed.feed.title == "Test Feed"
        assert len(parsed_feed.entries) == 1
        assert parsed_feed.entries[0].title == "Test Article"

    def test_parse_invalid_xml(self):
        """Test parsing invalid XML content"""
        invalid_content = "This is not XML at all"

        # feedparser is quite lenient, so we need to test validation failure
        with pytest.raises(FeedParsingError, match="Feed has severe parsing errors"):
            self.parser.parse_feed_data(invalid_content, "https://example.com/feed.xml")

    def test_parse_feed_missing_structure(self):
        """Test parsing XML that's not a valid feed"""
        invalid_feed = """<?xml version="1.0"?>
        <root>
            <not_a_feed>Some content</not_a_feed>
        </root>"""

        with pytest.raises(FeedParsingError, match="Feed content does not contain valid feed structure"):
            self.parser.parse_feed_data(invalid_feed, "https://example.com/feed.xml")

    def test_extract_feed_metadata_basic(self):
        """Test extracting basic feed metadata"""
        mock_parsed_feed = Mock()
        mock_parsed_feed.get.return_value = {
            "title": "Test Blog",
            "description": "A test blog",
            "link": "https://testblog.com",
            "language": "en",
        }

        metadata = self.parser.extract_feed_metadata(mock_parsed_feed, "https://testblog.com/feed.xml")

        assert metadata.title == "Test Blog"
        assert metadata.description == "A test blog"
        assert str(metadata.link) == "https://testblog.com/"
        assert metadata.language == "en"
        assert str(metadata.url) == "https://testblog.com/feed.xml"

    def test_extract_feed_metadata_with_image(self):
        """Test extracting feed metadata with image"""
        mock_parsed_feed = Mock()
        mock_parsed_feed.get.return_value = {
            "title": "Test Blog",
            "image": {"href": "https://testblog.com/logo.png"},
        }

        metadata = self.parser.extract_feed_metadata(mock_parsed_feed, "https://testblog.com/feed.xml")

        assert str(metadata.image_url) == "https://testblog.com/logo.png"

    def test_extract_feed_metadata_favicon_fallback(self):
        """Test fallback to favicon when no image provided"""
        mock_parsed_feed = Mock()
        mock_parsed_feed.get.return_value = {
            "title": "Test Blog",
            "link": "https://testblog.com",
        }

        metadata = self.parser.extract_feed_metadata(mock_parsed_feed, "https://testblog.com/feed.xml")

        assert str(metadata.image_url) == "https://testblog.com/favicon.ico"

    def test_extract_article_data_valid(self):
        """Test extracting valid article data"""
        mock_entry = Mock()
        mock_entry.get = Mock(
            side_effect=lambda key, default=None: {
                "id": "test-guid-123",
                "title": "Test Article",
                "link": "https://example.com/article",
                "summary": "Test description",
                "author": "Test Author",
                "published_parsed": (2024, 1, 1, 12, 0, 0),
            }.get(key, default)
        )
        mock_entry.content = [Mock(type="text/html", value="<p>Test content</p>")]
        mock_entry.published_parsed = (2024, 1, 1, 12, 0, 0)

        # Mock "in" operator for checking keys in entry
        def mock_contains_content(self, key):
            return key in ["content", "published_parsed"]

        mock_entry.__contains__ = mock_contains_content

        article_data = self.parser.extract_article_data(mock_entry, "https://example.com/feed.xml")

        assert article_data is not None
        assert article_data["guid"] == "test-guid-123"
        assert article_data["title"] == "Test Article"
        assert article_data["link"] == "https://example.com/article"
        assert article_data["description"] == "Test description"
        assert article_data["content"] == "<p>Test content</p>"
        assert article_data["author"] == "Test Author"
        assert isinstance(article_data["published_at"], datetime)

    def test_extract_article_data_no_guid(self):
        """Test extracting article data without GUID"""
        mock_entry = {"title": "Test Article", "summary": "Test description"}

        article_data = self.parser.extract_article_data(mock_entry)

        assert article_data is None

    def test_extract_article_data_no_link(self):
        """Test extracting article data without link"""
        mock_entry = {
            "id": "test-guid-123",
            "title": "Test Article",
            "summary": "Test description",
        }

        article_data = self.parser.extract_article_data(mock_entry)

        assert article_data is None

    def test_extract_article_data_no_content(self):
        """Test extracting article data with no meaningful content"""
        mock_entry = {"id": "test-guid-123", "link": "https://example.com/article"}

        article_data = self.parser.extract_article_data(mock_entry)

        assert article_data is None

    def test_calculate_estimated_read_time(self):
        """Test read time calculation"""
        # Test with normal text (200 WPM setting)
        text = " ".join(["word"] * 200)  # 200 words
        read_time = self.parser.calculate_estimated_read_time(text)
        assert read_time == 1  # 200 words / 200 WPM = 1 minute

        # Test with HTML content
        html_text = "<p>" + " ".join(["word"] * 400) + "</p>"  # 400 words
        read_time = self.parser.calculate_estimated_read_time(html_text)
        assert read_time == 2  # 400 words / 200 WPM = 2 minutes

        # Test with empty content
        assert self.parser.calculate_estimated_read_time("") is None
        assert self.parser.calculate_estimated_read_time(None) is None

    @patch("app.services.feed_parser.BeautifulSoup")
    def test_calculate_read_time_fallback(self, mock_soup):
        """Test read time calculation with BeautifulSoup failure"""
        # Mock BeautifulSoup to raise exception
        mock_soup.side_effect = Exception("Parsing failed")

        # Should fall back to regex
        text = "<p>" + " ".join(["word"] * 100) + "</p>"
        read_time = self.parser.calculate_estimated_read_time(text)
        assert read_time == 1  # Should still work with regex fallback

    def test_find_best_article_image_media_content(self):
        """Test finding image from media_content"""
        # Create a proper mock object with attributes instead of a dict
        mock_entry = Mock()
        mock_media = Mock()
        mock_media.get = Mock(
            side_effect=lambda key: {
                "medium": "image",
                "url": "https://example.com/image.jpg",
            }.get(key)
        )
        mock_entry.media_content = [mock_media]

        # Mock contains method
        def mock_contains(self, key):
            return key == "media_content"

        mock_entry.__contains__ = mock_contains

        image_url = self.parser.find_best_article_image(mock_entry, None)
        assert image_url == "https://example.com/image.jpg"

    def test_find_best_article_image_enclosures(self):
        """Test finding image from enclosures"""
        # Create a proper mock object with attributes instead of a dict
        mock_entry = Mock()
        mock_entry.media_content = []  # No media_content, should skip to enclosures
        mock_entry.enclosures = [Mock()]
        mock_entry.enclosures[0].get = Mock(
            side_effect=lambda key, default="": {
                "type": "image/jpeg",
                "href": "https://example.com/photo.jpg",
            }.get(key, default)
        )

        # Mock contains method
        def mock_contains(self, key):
            return key in ["media_content", "enclosures"]

        mock_entry.__contains__ = mock_contains

        image_url = self.parser.find_best_article_image(mock_entry, None)
        assert image_url == "https://example.com/photo.jpg"

    def test_find_best_article_image_html_content(self):
        """Test finding image from HTML content"""
        mock_entry = {}
        html_content = '<p>Some text</p><img src="https://example.com/content-image.png" alt="Test">'

        image_url = self.parser.find_best_article_image(mock_entry, html_content, "https://example.com/feed.xml")
        assert image_url == "https://example.com/content-image.png"

    def test_find_best_article_image_relative_url(self):
        """Test converting relative image URL to absolute"""
        mock_entry = {}
        html_content = '<img src="/images/photo.jpg" alt="Test">'

        image_url = self.parser.find_best_article_image(mock_entry, html_content, "https://example.com/feed.xml")
        assert image_url == "https://example.com/images/photo.jpg"

    def test_find_best_article_image_skip_tracking_pixel(self):
        """Test skipping 1x1 tracking pixels"""
        mock_entry = {}
        html_content = '<img src="https://tracker.com/pixel.gif" width="1" height="1">'

        image_url = self.parser.find_best_article_image(mock_entry, html_content)
        assert image_url is None

    def test_extract_feed_scheduling_data(self):
        """Test extracting TTL and scheduling data"""
        mock_parsed_feed = Mock()
        mock_parsed_feed.feed = {
            "ttl": "60",
            "skipHours": {"hour": ["2", "3", "4"]},
            "skipDays": {"day": ["Saturday", "Sunday"]},
        }

        scheduling_data = self.parser.extract_feed_scheduling_data(mock_parsed_feed)

        assert scheduling_data["ttl"] == 60
        assert scheduling_data["skip_hours"] == [2, 3, 4]
        assert scheduling_data["skip_days"] == ["Saturday", "Sunday"]

    def test_extract_feed_scheduling_data_invalid_values(self):
        """Test handling invalid scheduling data"""
        mock_parsed_feed = Mock()
        mock_parsed_feed.feed = {
            "ttl": "invalid",
            "skipHours": {"hour": ["invalid", "25", "5"]},  # 25 is invalid hour
            "skipDays": {"day": ["InvalidDay", "Monday"]},
        }

        scheduling_data = self.parser.extract_feed_scheduling_data(mock_parsed_feed)

        assert scheduling_data["ttl"] is None
        assert scheduling_data["skip_hours"] == [5]  # Only valid hour
        assert scheduling_data["skip_days"] == ["Monday"]  # Only valid day

    def test_validate_feed_quality_valid_feed(self):
        """Test feed quality validation for good feed"""
        mock_parsed_feed = Mock()
        mock_parsed_feed.entries = [
            {
                "id": "guid1",
                "title": "Article 1",
                "link": "https://example.com/1",
                "summary": "Description 1",
            },
            {
                "id": "guid2",
                "title": "Article 2",
                "link": "https://example.com/2",
                "summary": "Description 2",
            },
        ]

        result = self.parser.validate_feed_quality(mock_parsed_feed, min_article_count=1)

        assert result["is_valid"] is True
        assert result["total_entries"] == 2
        assert result["valid_articles"] == 2
        assert len(result["validation_errors"]) == 0

    def test_validate_feed_quality_no_valid_articles(self):
        """Test feed quality validation for feed with no valid articles"""
        mock_parsed_feed = Mock()
        mock_parsed_feed.entries = [
            {"id": "guid1"},  # Missing required fields
            {"title": "Article 2"},  # Missing required fields
        ]

        result = self.parser.validate_feed_quality(mock_parsed_feed, min_article_count=1)

        assert result["is_valid"] is False
        assert result["total_entries"] == 2
        assert result["valid_articles"] == 0
        assert "no valid articles" in result["validation_errors"][0]

    def test_validate_feed_quality_empty_feed(self):
        """Test feed quality validation for empty feed"""
        mock_parsed_feed = Mock()
        mock_parsed_feed.entries = []

        result = self.parser.validate_feed_quality(mock_parsed_feed, min_article_count=1)

        assert result["is_valid"] is False
        assert result["total_entries"] == 0
        assert result["valid_articles"] == 0
        assert "no entries at all" in result["validation_errors"][0]
