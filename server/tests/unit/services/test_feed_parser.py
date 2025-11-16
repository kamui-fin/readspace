"""Unit tests for FeedParsingService."""

from unittest.mock import MagicMock

import feedparser
import pytest

from app.services.feeds.feed_parser import FeedParsingService


class TestFeedParsingServiceExtractFeedMetadata:
    """Test suite for FeedParsingService.extract_feed_metadata method."""

    def setup_method(self):
        """Set up test fixtures."""
        self.parser = FeedParsingService()

    def test_extract_feed_metadata_with_title(self):
        """Test extracting metadata when feed has a title."""
        parsed_feed = MagicMock(spec=feedparser.FeedParserDict)
        feed_info = {
            "title": "Example Feed Title",
            "subtitle": "Example subtitle",
            "link": "https://example.com",
            "language": "en",
        }
        parsed_feed.get.return_value = feed_info

        result = self.parser.extract_feed_metadata(parsed_feed, "https://example.com/feed")

        assert result.title == "Example Feed Title"
        assert str(result.url) == "https://example.com/feed"

    def test_extract_feed_metadata_without_title_uses_link_domain(self):
        """Test that domain from link is used when title is missing."""
        parsed_feed = MagicMock(spec=feedparser.FeedParserDict)
        feed_info = {
            "title": "",  # Empty title
            "link": "https://www.example.com",
            "language": "en",
        }
        parsed_feed.get.return_value = feed_info

        result = self.parser.extract_feed_metadata(parsed_feed, "https://example.com/feed.xml")

        # Should use domain from link, removing www
        assert result.title == "example.com"
        assert str(result.url) == "https://example.com/feed.xml"

    def test_extract_feed_metadata_without_title_or_link_uses_feed_url_domain(self):
        """Test that feed URL domain is used when both title and link are missing."""
        parsed_feed = MagicMock(spec=feedparser.FeedParserDict)
        feed_info = {
            "title": "",
            "link": None,
            "language": "en",
        }
        parsed_feed.get.return_value = feed_info

        result = self.parser.extract_feed_metadata(parsed_feed, "https://blog.example.com/rss")

        # Should use domain from feed URL
        assert result.title == "blog.example.com"

    def test_extract_feed_metadata_with_whitespace_title_uses_domain(self):
        """Test that whitespace-only title is treated as missing."""
        parsed_feed = MagicMock()
        feed_info = {
            "title": "   ",  # Whitespace only
            "link": "https://example.com",
            "language": "en",
        }
        parsed_feed.get.return_value = feed_info

        result = self.parser.extract_feed_metadata(parsed_feed, "https://example.com/feed")

        assert result.title == "example.com"

    def test_extract_feed_metadata_removes_www_from_domain(self):
        """Test that www prefix is removed from domain fallback."""
        parsed_feed = MagicMock()
        feed_info = {
            "title": "",
            "link": "https://www.example.com/blog",
            "language": "en",
        }
        parsed_feed.get.return_value = feed_info

        result = self.parser.extract_feed_metadata(parsed_feed, "https://www.example.com/feed")

        assert result.title == "example.com"

    def test_extract_feed_metadata_preserves_subdomain(self):
        """Test that subdomains are preserved in fallback title."""
        parsed_feed = MagicMock()
        feed_info = {
            "title": "",
            "link": "https://blog.example.com",
            "language": "en",
        }
        parsed_feed.get.return_value = feed_info

        result = self.parser.extract_feed_metadata(parsed_feed, "https://blog.example.com/feed")

        assert result.title == "blog.example.com"

    def test_extract_feed_metadata_with_port_in_url(self):
        """Test that port is removed from domain fallback."""
        parsed_feed = MagicMock()
        feed_info = {
            "title": "",
            "link": "https://example.com:8080",
            "language": "en",
        }
        parsed_feed.get.return_value = feed_info

        result = self.parser.extract_feed_metadata(parsed_feed, "https://example.com:8080/feed")

        assert result.title == "example.com"

    def test_extract_feed_metadata_all_fields_populated(self):
        """Test that all metadata fields are properly extracted."""
        parsed_feed = MagicMock()
        feed_info = {
            "title": "Test Feed",
            "subtitle": "Test subtitle",
            "description": "Test description",
            "link": "https://example.com",
            "language": "en-US",
            "image": {"href": "https://example.com/image.png"},
        }
        parsed_feed.get.return_value = feed_info

        result = self.parser.extract_feed_metadata(parsed_feed, "https://example.com/feed")

        assert result.title == "Test Feed"
        assert result.description == "Test subtitle"  # subtitle takes precedence
        assert str(result.link) == "https://example.com/"
        assert result.language == "en"  # normalized

    def test_extract_feed_metadata_description_fallback(self):
        """Test that description falls back to description field when subtitle is missing."""
        parsed_feed = MagicMock()
        feed_info = {
            "title": "Test Feed",
            "subtitle": None,
            "description": "Test description",
            "link": "https://example.com",
            "language": "en",
        }
        parsed_feed.get.return_value = feed_info

        result = self.parser.extract_feed_metadata(parsed_feed, "https://example.com/feed")

        assert result.description == "Test description"
