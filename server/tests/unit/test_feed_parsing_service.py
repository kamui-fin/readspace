"""Unit tests for feed parsing service isolated logic."""

from datetime import datetime, timezone

import pytest

from app.core.constants import MIN_VALID_PUBLISHED_YEAR
from app.core.custom_exceptions import FeedParsingError
from app.services.feeds.feed_parser import FeedParsingService


@pytest.mark.unit
class TestReadingTimeCalculation:
    """Test reading time calculation."""

    def setup_method(self):
        """Set up test fixtures."""
        self.service = FeedParsingService(default_wpm=230)

    def test_calculate_reading_time_from_text(self):
        """Test reading time calculation."""
        # 230 words should take 1 minute (default WPM)
        text = " ".join(["word"] * 230)

        reading_time = self.service.calculate_estimated_read_time(text)

        assert reading_time == 1

    def test_calculate_reading_time_from_html(self):
        """Test reading time calculation from HTML."""
        html_content = "<p>" + " ".join(["word"] * 460) + "</p>"  # 2 minutes

        reading_time = self.service.calculate_estimated_read_time(html_content)

        assert reading_time == 2

    def test_calculate_reading_time_empty_content(self):
        """Test reading time for empty content."""
        assert self.service.calculate_estimated_read_time(None) is None
        assert self.service.calculate_estimated_read_time("") is None
        assert self.service.calculate_estimated_read_time("   ") is None


@pytest.mark.unit
class TestFeedDataParsing:
    """Test feed data parsing logic."""

    def setup_method(self):
        """Set up test fixtures."""
        self.service = FeedParsingService()

    def test_parse_valid_rss_feed(self):
        """Test parsing of valid RSS feed."""
        feed_xml = """<?xml version="1.0"?>
<rss version="2.0">
    <channel>
        <title>Test Feed</title>
        <link>https://example.com</link>
        <description>A test feed</description>
        <item>
            <title>Article 1</title>
            <link>https://example.com/1</link>
            <description>Article description</description>
        </item>
    </channel>
</rss>"""

        parsed = self.service.parse_feed_data(feed_xml, "https://example.com/feed")

        assert parsed is not None
        assert parsed.feed.title == "Test Feed"
        assert len(parsed.entries) == 1

    def test_reject_oversized_feed(self):
        """Test that feeds over size limit are rejected."""
        # Create a feed larger than MAX_FEED_CONTENT_SIZE_BYTES (10MB)
        large_content = "x" * (11 * 1024 * 1024)

        with pytest.raises(FeedParsingError, match="too large"):
            self.service.parse_feed_data(large_content, "https://example.com/feed")

    def test_parse_invalid_xml(self):
        """Test parsing invalid XML raises error."""
        invalid_xml = "This is not XML at all"

        # Should raise FeedParsingError because it's completely invalid
        with pytest.raises(FeedParsingError):
            self.service.parse_feed_data(invalid_xml, "https://example.com/feed")


@pytest.mark.unit
class TestFeedSchedulingData:
    """Test feed scheduling data extraction."""

    def setup_method(self):
        """Set up test fixtures."""
        self.service = FeedParsingService()

    def test_extract_ttl_value(self):
        """Test extraction of TTL value."""
        # Create a mock feedparser object
        class MockFeed:
            def get(self, key, default=None):
                if key == "ttl":
                    return "60"
                return default

        parsed_feed = type('obj', (object,), {"feed": MockFeed()})()

        scheduling_data = self.service.extract_feed_scheduling_data(parsed_feed)

        assert scheduling_data["ttl"] == 60

    def test_extract_skip_hours(self):
        """Test extraction of skip hours."""
        class MockFeed:
            def get(self, key, default=None):
                if key == "skipHours":
                    return {"hour": ["0", "1", "23"]}
                return default

        parsed_feed = type('obj', (object,), {"feed": MockFeed()})()

        scheduling_data = self.service.extract_feed_scheduling_data(parsed_feed)

        assert scheduling_data["skip_hours"] == [0, 1, 23]

    def test_extract_skip_days(self):
        """Test extraction of skip days."""
        class MockFeed:
            def get(self, key, default=None):
                if key == "skipDays":
                    return {"day": ["Monday", "Sunday"]}
                return default

        parsed_feed = type('obj', (object,), {"feed": MockFeed()})()

        scheduling_data = self.service.extract_feed_scheduling_data(parsed_feed)

        assert scheduling_data["skip_days"] == ["Monday", "Sunday"]

    def test_handle_invalid_ttl(self):
        """Test handling of invalid TTL values."""
        class MockFeed:
            def get(self, key, default=None):
                if key == "ttl":
                    return "invalid"
                return default

        parsed_feed = type('obj', (object,), {"feed": MockFeed()})()

        scheduling_data = self.service.extract_feed_scheduling_data(parsed_feed)

        assert scheduling_data["ttl"] is None

    def test_handle_invalid_skip_hours(self):
        """Test handling of invalid skip hour values."""
        class MockFeed:
            def get(self, key, default=None):
                if key == "skipHours":
                    return {"hour": ["25", "invalid"]}  # 25 is invalid
                return default

        parsed_feed = type('obj', (object,), {"feed": MockFeed()})()

        scheduling_data = self.service.extract_feed_scheduling_data(parsed_feed)

        assert scheduling_data["skip_hours"] == []

    def test_handle_invalid_skip_days(self):
        """Test handling of invalid skip day values."""
        class MockFeed:
            def get(self, key, default=None):
                if key == "skipDays":
                    return {"day": ["InvalidDay", "Monday"]}
                return default

        parsed_feed = type('obj', (object,), {"feed": MockFeed()})()

        scheduling_data = self.service.extract_feed_scheduling_data(parsed_feed)

        assert scheduling_data["skip_days"] == ["Monday"]


@pytest.mark.unit
class TestFeedMetadataExtraction:
    """Test feed metadata extraction."""

    def setup_method(self):
        """Set up test fixtures."""
        self.service = FeedParsingService()

    def test_extract_metadata_from_parsed_feed(self):
        """Test metadata extraction from real parsed feed."""
        feed_xml = """<?xml version="1.0"?>
<rss version="2.0">
    <channel>
        <title>Tech Blog</title>
        <link>https://techblog.example.com</link>
        <description>Latest tech news</description>
        <language>en-US</language>
    </channel>
</rss>"""

        parsed_feed = self.service.parse_feed_data(feed_xml, "https://techblog.example.com/feed")
        metadata = self.service.extract_feed_metadata(parsed_feed, "https://techblog.example.com/feed")

        assert metadata.title == "Tech Blog"
        # feedparser may normalize the link (adding trailing slash)
        assert str(metadata.link).startswith("https://techblog.example.com")
        # RSS feeds use <description>, Atom feeds use <subtitle>
        assert metadata.description is not None
        assert metadata.language == "en"  # Normalized from en-US

    def test_extract_metadata_with_missing_fields(self):
        """Test metadata extraction with minimal feed."""
        feed_xml = """<?xml version="1.0"?>
<rss version="2.0">
    <channel>
        <title>Minimal Feed</title>
    </channel>
</rss>"""

        parsed_feed = self.service.parse_feed_data(feed_xml, "https://example.com/feed")
        metadata = self.service.extract_feed_metadata(parsed_feed, "https://example.com/feed")

        assert metadata.title == "Minimal Feed"
        # Other fields should have defaults
        assert metadata.language is None or metadata.language == "en"


@pytest.mark.unit
class TestFeedQualityValidation:
    """Test feed quality validation."""

    def setup_method(self):
        """Set up test fixtures."""
        self.service = FeedParsingService()

    def test_validate_quality_of_good_feed(self):
        """Test quality validation of a good feed."""
        feed_xml = """<?xml version="1.0"?>
<rss version="2.0">
    <channel>
        <title>Good Feed</title>
        <item>
            <title>Article 1</title>
            <link>https://example.com/1</link>
            <description>Good article</description>
            <guid>article-1</guid>
        </item>
        <item>
            <title>Article 2</title>
            <link>https://example.com/2</link>
            <description>Another good article</description>
            <guid>article-2</guid>
        </item>
    </channel>
</rss>"""

        parsed_feed = self.service.parse_feed_data(feed_xml, "https://example.com/feed")
        validation_result = self.service.validate_feed_quality(parsed_feed)

        assert validation_result["is_valid"] is True
        assert validation_result["valid_articles"] >= 2
        assert len(validation_result["validation_errors"]) == 0

    def test_validate_quality_rejects_empty_feed(self):
        """Test quality validation rejects empty feeds."""
        feed_xml = """<?xml version="1.0"?>
<rss version="2.0">
    <channel>
        <title>Empty Feed</title>
    </channel>
</rss>"""

        parsed_feed = self.service.parse_feed_data(feed_xml, "https://example.com/feed")
        validation_result = self.service.validate_feed_quality(parsed_feed)

        assert validation_result["is_valid"] is False
        assert "no entries" in str(validation_result["validation_errors"]).lower()

    def test_validate_quality_with_min_article_count(self):
        """Test quality validation with minimum article requirement."""
        feed_xml = """<?xml version="1.0"?>
<rss version="2.0">
    <channel>
        <title>Small Feed</title>
        <item>
            <title>Single Article</title>
            <link>https://example.com/1</link>
            <guid>article-1</guid>
        </item>
    </channel>
</rss>"""

        parsed_feed = self.service.parse_feed_data(feed_xml, "https://example.com/feed")

        # Should pass with min_article_count=1
        validation_result = self.service.validate_feed_quality(parsed_feed, min_article_count=1)
        assert validation_result["is_valid"] is True

        # Should fail with min_article_count=2
        validation_result = self.service.validate_feed_quality(parsed_feed, min_article_count=2)
        assert validation_result["is_valid"] is False
