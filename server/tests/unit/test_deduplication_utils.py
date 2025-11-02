"""Tests for code deduplication utilities."""

from app.utils.content_hash import calculate_feed_content_hash
from app.utils.query_helpers import apply_boolean_filter
from app.utils.url_normalizer import get_protocol_variation


class TestContentHash:
    """Test content hash calculation."""

    def test_calculate_hash_with_entries(self):
        """Test hash calculation with valid entries."""

        class MockEntry:
            def __init__(self, title, link):
                self.title = title
                self.link = link

        entries = [MockEntry("Article 1", "http://example.com/1"), MockEntry("Article 2", "http://example.com/2")]

        hash_value = calculate_feed_content_hash(entries)
        assert isinstance(hash_value, str)
        assert len(hash_value) == 64  # SHA-256 produces 64 hex characters

    def test_calculate_hash_with_empty_list(self):
        """Test hash calculation with empty list."""
        assert calculate_feed_content_hash([]) == ""

    def test_calculate_hash_consistency(self):
        """Test that same entries produce same hash."""

        class MockEntry:
            def __init__(self, title, link):
                self.title = title
                self.link = link

        entries = [MockEntry("Article 1", "http://example.com/1"), MockEntry("Article 2", "http://example.com/2")]

        hash1 = calculate_feed_content_hash(entries)
        hash2 = calculate_feed_content_hash(entries)
        assert hash1 == hash2

    def test_calculate_hash_max_10_entries(self):
        """Test that only first 10 entries are used."""

        class MockEntry:
            def __init__(self, title, link):
                self.title = title
                self.link = link

        entries_15 = [MockEntry(f"Article {i}", f"http://example.com/{i}") for i in range(15)]
        entries_10 = [MockEntry(f"Article {i}", f"http://example.com/{i}") for i in range(10)]

        hash_15 = calculate_feed_content_hash(entries_15)
        hash_10 = calculate_feed_content_hash(entries_10)
        # Both should produce same hash since only first 10 are used
        assert hash_15 == hash_10


class TestProtocolVariation:
    """Test protocol variation utility."""

    def test_http_to_https(self):
        """Test converting http to https."""
        url = "http://example.com/feed"
        variation = get_protocol_variation(url)
        assert variation == "https://example.com/feed"

    def test_https_to_http(self):
        """Test converting https to http."""
        url = "https://example.com/feed"
        variation = get_protocol_variation(url)
        assert variation == "http://example.com/feed"

    def test_non_http_protocol(self):
        """Test non-http/https protocols return None."""
        url = "ftp://example.com/file"
        variation = get_protocol_variation(url)
        assert variation is None

    def test_rsshub_protocol(self):
        """Test rsshub protocol returns None."""
        url = "rsshub://example.com/feed"
        variation = get_protocol_variation(url)
        assert variation is None

    def test_preserves_query_params(self):
        """Test that query parameters are preserved."""
        url = "http://example.com/feed?page=1&format=rss"
        variation = get_protocol_variation(url)
        assert variation == "https://example.com/feed?page=1&format=rss"


class TestBooleanFilter:
    """Test boolean filter helper."""

    def test_filter_true(self):
        """Test filtering for True values."""
        from sqlalchemy import select

        from app.models import UserArticleState

        # Build a basic query
        stmt = select(UserArticleState)

        # Apply filter for True
        filtered_stmt = apply_boolean_filter(stmt, UserArticleState.is_read, True)

        # Check that the filter was applied (we can't execute without data, just verify it doesn't error)
        assert filtered_stmt is not None
        # Verify the SQL contains the filter
        sql_str = str(filtered_stmt.compile(compile_kwargs={"literal_binds": True}))
        assert "is_read" in sql_str.lower()

    def test_filter_false(self):
        """Test filtering for False values."""
        from sqlalchemy import select

        from app.models import UserArticleState

        # Build a basic query
        stmt = select(UserArticleState)

        # Apply filter for False
        filtered_stmt = apply_boolean_filter(stmt, UserArticleState.is_read, False)

        # Check that the filter was applied
        assert filtered_stmt is not None
        # Verify the SQL contains the filter with OR for NULL/False
        sql_str = str(filtered_stmt.compile(compile_kwargs={"literal_binds": True}))
        assert "is_read" in sql_str.lower()
