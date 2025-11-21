"""Unit tests for FeedParsingService."""

import time
from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock

import feedparser
import pytest

from app.core.constants import MIN_VALID_PUBLISHED_YEAR
from app.services.feeds.parser import FeedParsingService


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


class TestFeedParsingServiceExtractArticleDataDateValidation:
    """Test suite for article date validation in FeedParsingService.extract_article_data method."""

    def setup_method(self):
        """Set up test fixtures."""
        self.parser = FeedParsingService()

    def test_extract_article_data_with_future_published_date(self):
        """Test that future publication dates are capped to current time."""
        # Create a date 1 day in the future
        future_date = datetime.now(timezone.utc) + timedelta(days=1)
        future_time_tuple = future_date.timetuple()[:6]

        entry = MagicMock()
        entry.published_parsed = time.struct_time(future_time_tuple + (0, 0, 0))
        entry.__contains__ = lambda self, key: key in ["published_parsed", "id", "title", "link"]
        entry.get.side_effect = lambda key, default=None: {
            "id": "test-article-1",
            "title": "Test Article",
            "link": "https://example.com/article",
        }.get(key, default)

        result = self.parser.extract_article_data(entry, "https://example.com/feed")

        # The published_at should be capped to now (or very close to it)
        assert result["published_at"] is not None
        time_diff = future_date - result["published_at"]
        # Should be capped to current time, so difference should be ~1 day
        assert time_diff.total_seconds() > 86000  # Almost 1 day (accounting for execution time)

    def test_extract_article_data_with_future_updated_date(self):
        """Test that future updated dates are capped to current time when no published_parsed exists."""
        # Create a date 2 hours in the future
        future_date = datetime.now(timezone.utc) + timedelta(hours=2)
        future_time_tuple = future_date.timetuple()[:6]

        entry = MagicMock()
        entry.published_parsed = None  # No published_parsed
        entry.updated_parsed = time.struct_time(future_time_tuple + (0, 0, 0))
        entry.__contains__ = lambda self, key: key in ["updated_parsed", "id", "title", "link"]
        entry.get.side_effect = lambda key, default=None: {
            "id": "test-article-2",
            "title": "Test Article",
            "link": "https://example.com/article",
        }.get(key, default)

        result = self.parser.extract_article_data(entry, "https://example.com/feed")

        # The published_at should be capped to now
        assert result["published_at"] is not None
        time_diff = future_date - result["published_at"]
        # Should be capped to current time, so difference should be ~2 hours
        assert time_diff.total_seconds() > 7000  # Almost 2 hours (accounting for execution time)

    def test_extract_article_data_with_valid_past_date(self):
        """Test that valid past dates are preserved unchanged."""
        # Create a date 3 days in the past
        past_date = datetime.now(timezone.utc) - timedelta(days=3)
        past_time_tuple = past_date.timetuple()[:6]

        entry = MagicMock()
        entry.published_parsed = time.struct_time(past_time_tuple + (0, 0, 0))
        entry.__contains__ = lambda self, key: key in ["published_parsed", "id", "title", "link"]
        entry.get.side_effect = lambda key, default=None: {
            "id": "test-article-3",
            "title": "Test Article",
            "link": "https://example.com/article",
        }.get(key, default)

        result = self.parser.extract_article_data(entry, "https://example.com/feed")

        # The published_at should be preserved (not capped to now)
        assert result["published_at"] is not None
        # Verify it's in the past (not now) - time_struct_time loses microseconds so compare to now
        now = datetime.now(timezone.utc)
        time_since_published = (now - result["published_at"]).total_seconds()
        # Should be approximately 3 days ago (259200 seconds), allow some tolerance
        assert 259000 < time_since_published < 260000  # Between ~3 days and a bit more

    def test_extract_article_data_with_date_before_min_year(self):
        """Test that dates before MIN_VALID_PUBLISHED_YEAR are capped to current time."""
        # Create a date in 1985 (before MIN_VALID_PUBLISHED_YEAR of 1990)
        old_date = datetime(1985, 6, 15, 12, 0, 0)
        old_time_tuple = old_date.timetuple()[:6]

        entry = MagicMock()
        entry.published_parsed = time.struct_time(old_time_tuple + (0, 0, 0))
        entry.__contains__ = lambda self, key: key in ["published_parsed", "id", "title", "link"]
        entry.get.side_effect = lambda key, default=None: {
            "id": "test-article-4",
            "title": "Test Article",
            "link": "https://example.com/article",
        }.get(key, default)

        result = self.parser.extract_article_data(entry, "https://example.com/feed")

        # The published_at should be capped to current time (not the old date)
        assert result["published_at"] is not None
        now = datetime.now(timezone.utc)
        time_diff = abs((result["published_at"] - now).total_seconds())
        # Should be very close to now (within a few seconds)
        assert time_diff < 5

    def test_extract_article_data_with_exact_current_time(self):
        """Test that dates exactly at current time are preserved."""
        # Use current time
        now = datetime.now(timezone.utc)
        now_time_tuple = now.timetuple()[:6]

        entry = MagicMock()
        entry.published_parsed = time.struct_time(now_time_tuple + (0, 0, 0))
        entry.__contains__ = lambda self, key: key in ["published_parsed", "id", "title", "link"]
        entry.get.side_effect = lambda key, default=None: {
            "id": "test-article-5",
            "title": "Test Article",
            "link": "https://example.com/article",
        }.get(key, default)

        result = self.parser.extract_article_data(entry, "https://example.com/feed")

        # The published_at should be preserved (not capped)
        assert result["published_at"] is not None
        time_diff = abs((result["published_at"] - now).total_seconds())
        # Should be very close to the input time (within 1 second)
        assert time_diff < 1

    def test_extract_article_data_with_no_date_uses_current_time(self):
        """Test that missing dates fall back to current time."""
        entry = MagicMock()
        entry.published_parsed = None
        entry.updated_parsed = None
        entry.__contains__ = lambda self, key: key in ["id", "title", "link"]
        entry.get.side_effect = lambda key, default=None: {
            "id": "test-article-6",
            "title": "Test Article",
            "link": "https://example.com/article",
        }.get(key, default)

        result = self.parser.extract_article_data(entry, "https://example.com/feed")

        # Should fallback to current time
        assert result["published_at"] is not None
        now = datetime.now(timezone.utc)
        time_diff = abs((result["published_at"] - now).total_seconds())
        # Should be very close to now (within a few seconds)
        assert time_diff < 5
