"""Unit tests for ArticleExtractor service."""

from datetime import datetime, timezone
from uuid import uuid4

import pytest

from app.schemas.rss_schemas import ArticleCreate
from app.services.article_extractor import ArticleExtractor


@pytest.mark.unit
class TestArticleExtractor:
    """Test ArticleExtractor functionality."""

    def setup_method(self):
        self.extractor = ArticleExtractor()
        self.feed_id = uuid4()
        self.user_id = uuid4()

    def test_extract_article_data_complete(self):
        """Test extraction of complete article data."""
        entry = {
            "id": "article-123",
            "title": "Test Article",
            "link": "http://example.com/article",
            "summary": "Article summary",
            "content": [{"type": "text/html", "value": "<p>Article content</p>"}],
            "published_parsed": (2023, 10, 15, 12, 0, 0),
            "author": "Test Author",
        }

        result = self.extractor.extract_article_data(entry, self.feed_id, self.user_id)

        assert isinstance(result, ArticleCreate)
        assert result.title == "Test Article"
        assert str(result.link) == "http://example.com/article"
        # The summary extraction prioritizes content over short summaries
        assert (
            "Article" in result.description
        )  # Should contain content since it's longer
        assert result.content == "Article content"  # HTML tags stripped
        assert result.author == "Test Author"
        assert result.feed_id == self.feed_id
        assert result.user_id == self.user_id
        assert isinstance(result.published_at, datetime)

    def test_extract_article_data_minimal(self):
        """Test extraction with minimal required data."""
        entry = {"link": "http://example.com/article", "title": "Minimal Article"}

        result = self.extractor.extract_article_data(entry, self.feed_id, self.user_id)

        assert result.title == "Minimal Article"
        assert str(result.link) == "http://example.com/article"
        assert result.guid == "http://example.com/article"  # Uses link as fallback

    def test_extract_title(self):
        """Test title extraction with various formats."""
        test_cases = [
            ({"title": "Simple Title"}, "Simple Title"),
            ({"title": {"value": "Dict Title"}}, "Dict Title"),
            ({"title": "<b>HTML Title</b>"}, "HTML Title"),
            ({"title": "  Whitespace Title  "}, "Whitespace Title"),
            ({}, "Untitled Article"),
        ]

        for entry, expected in test_cases:
            result = self.extractor._extract_title(entry)
            assert result == expected

    def test_extract_link(self):
        """Test link extraction with various formats."""
        test_cases = [
            ({"link": "http://example.com"}, "http://example.com"),
            ({"link": [{"href": "http://example.com"}]}, "http://example.com"),
            ({"link": {"href": "http://example.com"}}, "http://example.com"),
            ({"link": ["http://example.com"]}, "http://example.com"),
            ({}, ""),
        ]

        for entry, expected in test_cases:
            result = self.extractor._extract_link(entry)
            assert result == expected

    def test_extract_guid(self):
        """Test GUID extraction with fallbacks."""
        test_cases = [
            ({"id": "unique-id"}, "http://fallback.com", "unique-id"),
            ({"guid": "guid-value"}, "http://fallback.com", "guid-value"),
            ({"guid": {"value": "guid-dict"}}, "http://fallback.com", "guid-dict"),
            ({}, "http://fallback.com", "http://fallback.com"),
        ]

        for entry, fallback_link, expected in test_cases:
            result = self.extractor._extract_guid(entry, fallback_link)
            assert result == expected

    def test_extract_published_date_various_formats(self):
        """Test date extraction from various formats."""
        # Test with parsed tuple
        entry1 = {"published_parsed": (2023, 10, 15, 12, 0, 0)}
        result1 = self.extractor._extract_published_date(entry1)
        assert result1.year == 2023
        assert result1.month == 10
        assert result1.day == 15

        # Test with updated_parsed as fallback
        entry2 = {"updated_parsed": (2023, 11, 16, 13, 30, 0)}
        result2 = self.extractor._extract_published_date(entry2)
        assert result2.year == 2023
        assert result2.month == 11

        # Test with no valid date (should use current time)
        entry3 = {}
        result3 = self.extractor._extract_published_date(entry3)
        assert isinstance(result3, datetime)
        assert result3.tzinfo == timezone.utc

    def test_extract_content_priority(self):
        """Test content extraction prioritizes content over summary."""
        entry_with_both = {
            "content": [{"type": "text/html", "value": "<p>HTML Content</p>"}],
            "summary": "Summary text",
        }

        result = self.extractor._extract_content(entry_with_both)
        assert result == "HTML Content"  # HTML tags stripped

    def test_extract_content_fallback_to_summary(self):
        """Test content extraction falls back to summary."""
        entry_summary_only = {"summary": "<p>Summary content</p>"}

        result = self.extractor._extract_content(entry_summary_only)
        assert result == "Summary content"  # HTML tags stripped

    def test_extract_summary_creation_from_content(self):
        """Test summary creation from long content."""
        long_content = "A" * 400  # Long content that should be truncated
        entry = {
            "summary": "",  # Empty summary
        }

        result = self.extractor._extract_summary(entry, long_content)
        assert len(result) <= 1000  # Summary limit is 1000, content limit is 300
        # Should use first 300 characters from content if summary is empty
        assert len(result) >= 300

    def test_extract_author_various_formats(self):
        """Test author extraction from various formats."""
        test_cases = [
            ({"author": "Simple Author"}, "Simple Author"),
            ({"author": {"name": "Dict Author"}}, "Dict Author"),
            ({"author": [{"name": "List Author"}]}, "List Author"),
            ({"dc_creator": "DC Creator"}, "DC Creator"),
            ({}, None),
        ]

        for entry, expected in test_cases:
            result = self.extractor._extract_author(entry)
            assert result == expected

    def test_calculate_read_time(self):
        """Test read time calculation."""
        test_cases = [
            ("", 1),  # Empty content, minimum 1 minute
            ("word " * 200, 1),  # 200 words = 1 minute at 200 wpm
            ("word " * 400, 2),  # 400 words = 2 minutes
            ("word " * 12000, 60),  # Very long content capped at 60 minutes
        ]

        for content, expected_minutes in test_cases:
            result = self.extractor._calculate_read_time(content)
            assert result == expected_minutes

    def test_extract_image_url_from_media_content(self):
        """Test image extraction from media_content."""
        entry = {
            "media_content": [
                {"medium": "image", "url": "http://example.com/image.jpg"}
            ]
        }

        result = self.extractor._extract_image_url(entry, "")
        assert result == "http://example.com/image.jpg"

    def test_extract_image_url_from_content_html(self):
        """Test image extraction from HTML content."""
        content = '<p>Some text</p><img src="http://example.com/image.jpg" alt="test">'
        entry = {}

        result = self.extractor._extract_image_url(entry, content)
        assert result == "http://example.com/image.jpg"

    def test_extract_image_url_none_found(self):
        """Test when no image is found."""
        entry = {}
        content = "<p>Just text content</p>"

        result = self.extractor._extract_image_url(entry, content)
        assert result is None
