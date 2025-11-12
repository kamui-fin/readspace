"""Unit tests for feed validation service."""

import pytest

from app.core.custom_exceptions import FeedValidationError
from app.services.feeds.feed_validator import FeedValidator


@pytest.mark.unit
class TestFeedValidatorURL:
    """Test feed URL validation."""

    def setup_method(self):
        """Set up test fixtures."""
        self.validator = FeedValidator()

    def test_valid_http_url(self):
        """Test validation of valid HTTP URL."""
        self.validator.validate_feed_url("http://example.com/feed.xml")

    def test_valid_https_url(self):
        """Test validation of valid HTTPS URL."""
        self.validator.validate_feed_url("https://example.com/feed.xml")

    def test_empty_url(self):
        """Test validation fails for empty URL."""
        with pytest.raises(FeedValidationError, match="cannot be empty"):
            self.validator.validate_feed_url("")

        with pytest.raises(FeedValidationError, match="cannot be empty"):
            self.validator.validate_feed_url("   ")

    def test_url_without_protocol(self):
        """Test validation fails for URL without protocol."""
        with pytest.raises(FeedValidationError, match="must start with http"):
            self.validator.validate_feed_url("example.com/feed.xml")

    def test_url_with_invalid_protocol(self):
        """Test validation fails for invalid protocol."""
        with pytest.raises(FeedValidationError, match="must start with http"):
            self.validator.validate_feed_url("ftp://example.com/feed.xml")

    def test_url_too_long(self):
        """Test validation fails for very long URLs."""
        long_url = "https://example.com/" + "a" * 2500

        with pytest.raises(FeedValidationError, match="too long"):
            self.validator.validate_feed_url(long_url)

    def test_url_with_whitespace(self):
        """Test validation fails for URLs with whitespace."""
        with pytest.raises(FeedValidationError, match="invalid characters"):
            self.validator.validate_feed_url("https://example.com/feed with spaces.xml")

    def test_url_with_newlines(self):
        """Test validation fails for URLs with newlines."""
        with pytest.raises(FeedValidationError, match="invalid characters"):
            self.validator.validate_feed_url("https://example.com/feed\nxml")

    def test_url_with_tabs(self):
        """Test validation fails for URLs with tabs."""
        with pytest.raises(FeedValidationError, match="invalid characters"):
            self.validator.validate_feed_url("https://example.com/feed\txml")


@pytest.mark.unit
class TestFeedValidatorArticles:
    """Test feed article validation."""

    def setup_method(self):
        """Set up test fixtures."""
        self.validator = FeedValidator()

    def test_valid_articles(self):
        """Test validation of valid articles."""
        # Create mock entry objects
        class Entry1:
            def get(self, key, default=None):
                return {"title": "Article 1", "link": "https://example.com/1", "summary": "Summary 1"}.get(key, default)

        class Entry2:
            def get(self, key, default=None):
                return {"title": "Article 2", "link": "https://example.com/2", "summary": "Summary 2"}.get(key, default)

        entries = [Entry1(), Entry2()]

        assert self.validator.validate_feed_articles(entries) is True

    def test_empty_entries_list(self):
        """Test validation fails for empty entries."""
        assert self.validator.validate_feed_articles([]) is False

    def test_articles_with_title_and_link(self):
        """Test articles with title and link are valid."""
        class Entry:
            def get(self, key, default=None):
                return {"title": "Article 1", "link": "https://example.com/1"}.get(key, default)

        entries = [Entry()]

        assert self.validator.validate_feed_articles(entries) is True

    def test_articles_with_summary_and_link(self):
        """Test articles with summary and link are valid."""
        class Entry:
            def get(self, key, default=None):
                return {"summary": "Article summary", "link": "https://example.com/1"}.get(key, default)

        entries = [Entry()]

        assert self.validator.validate_feed_articles(entries) is True

    def test_invalid_articles_no_title_or_summary(self):
        """Test articles without title or summary are invalid."""
        class Entry:
            def get(self, key, default=None):
                return {"link": "https://example.com/1"}.get(key, default)

        entries = [Entry()]

        assert self.validator.validate_feed_articles(entries) is False

    def test_invalid_articles_no_content_or_link(self):
        """Test articles without content or link are invalid."""
        class Entry:
            def get(self, key, default=None):
                return {"title": "Article"}.get(key, default)

        entries = [Entry()]

        assert self.validator.validate_feed_articles(entries) is False

    def test_mixed_valid_and_invalid_articles(self):
        """Test validation with mix of valid and invalid articles."""
        class ValidEntry:
            def get(self, key, default=None):
                return {"title": "Valid", "link": "https://example.com/1"}.get(key, default)

        class InvalidEntry:
            def get(self, key, default=None):
                return {}.get(key, default)

        entries = [ValidEntry(), InvalidEntry(), ValidEntry(), InvalidEntry()]

        # Should pass if at least half are valid (2 out of 4)
        assert self.validator.validate_feed_articles(entries) is True

    def test_less_than_half_valid_articles(self):
        """Test validation fails when less than half articles are valid."""
        class ValidEntry:
            def get(self, key, default=None):
                return {"title": "Valid", "link": "https://example.com/1"}.get(key, default)

        class InvalidEntry:
            def get(self, key, default=None):
                return {}.get(key, default)

        entries = [ValidEntry(), InvalidEntry(), InvalidEntry(), InvalidEntry()]

        # Only 1 out of 4 is valid (25%), should fail
        assert self.validator.validate_feed_articles(entries) is False
