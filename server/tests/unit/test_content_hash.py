"""Unit tests for content hashing utilities."""

import hashlib
from typing import Any

import pytest

from app.utils.content_hash import calculate_feed_content_hash


class MockEntry:
    """Mock feed entry for testing."""

    def __init__(self, title: str = "", link: str = ""):
        self.title = title
        self.link = link


@pytest.mark.unit
class TestCalculateFeedContentHash:
    """Tests for calculate_feed_content_hash function."""

    def test_empty_entries_returns_empty_string(self):
        """Empty entry list should return empty string."""
        result = calculate_feed_content_hash([])
        assert result == ""

    def test_single_entry_produces_valid_sha256(self):
        """Single entry should produce valid 64-character SHA-256 hash."""
        entries = [MockEntry(title="Article 1", link="http://example.com/1")]
        result = calculate_feed_content_hash(entries)

        assert len(result) == 64
        assert all(c in "0123456789abcdef" for c in result)

    def test_hash_is_deterministic(self):
        """Same input should always produce same hash."""
        entries = [
            MockEntry(title="Article 1", link="http://example.com/1"),
            MockEntry(title="Article 2", link="http://example.com/2"),
        ]

        hash1 = calculate_feed_content_hash(entries)
        hash2 = calculate_feed_content_hash(entries)

        assert hash1 == hash2

    def test_different_content_produces_different_hash(self):
        """Different content should produce different hashes."""
        entries1 = [MockEntry(title="Article 1", link="http://example.com/1")]
        entries2 = [MockEntry(title="Article 2", link="http://example.com/2")]

        hash1 = calculate_feed_content_hash(entries1)
        hash2 = calculate_feed_content_hash(entries2)

        assert hash1 != hash2

    def test_only_top_10_entries_are_hashed(self):
        """Only first 10 entries should be included in hash."""
        # Create 15 entries
        entries_15 = [MockEntry(title=f"Article {i}", link=f"http://example.com/{i}") for i in range(15)]

        # Create 10 entries (same as first 10)
        entries_10 = [MockEntry(title=f"Article {i}", link=f"http://example.com/{i}") for i in range(10)]

        hash_15 = calculate_feed_content_hash(entries_15)
        hash_10 = calculate_feed_content_hash(entries_10)

        # Hashes should be identical since only first 10 are considered
        assert hash_15 == hash_10

    def test_order_matters(self):
        """Entry order should affect the hash."""
        entries1 = [
            MockEntry(title="Article 1", link="http://example.com/1"),
            MockEntry(title="Article 2", link="http://example.com/2"),
        ]
        entries2 = [
            MockEntry(title="Article 2", link="http://example.com/2"),
            MockEntry(title="Article 1", link="http://example.com/1"),
        ]

        hash1 = calculate_feed_content_hash(entries1)
        hash2 = calculate_feed_content_hash(entries2)

        assert hash1 != hash2

    def test_missing_title_attribute(self):
        """Entries without title attribute should use empty string."""

        class EntryNoTitle:
            def __init__(self):
                self.link = "http://example.com/1"

        entries = [EntryNoTitle()]
        result = calculate_feed_content_hash(entries)

        # Should not raise error and should produce valid hash
        assert len(result) == 64

    def test_missing_link_attribute(self):
        """Entries without link attribute should use empty string."""

        class EntryNoLink:
            def __init__(self):
                self.title = "Article 1"

        entries = [EntryNoLink()]
        result = calculate_feed_content_hash(entries)

        # Should not raise error and should produce valid hash
        assert len(result) == 64

    def test_both_attributes_missing(self):
        """Entries with both attributes missing should still work."""

        class EntryEmpty:
            pass

        entries = [EntryEmpty()]
        result = calculate_feed_content_hash(entries)

        # Should not raise error and should produce valid hash
        assert len(result) == 64

    def test_special_characters_in_content(self):
        """Special characters should be handled correctly."""
        entries = [
            MockEntry(title="Article with émojis 🎉", link="http://example.com/special?param=value&other=test"),
        ]
        result = calculate_feed_content_hash(entries)

        assert len(result) == 64

    def test_unicode_content(self):
        """Unicode characters should be handled correctly."""
        entries = [
            MockEntry(title="文章标题 こんにちは 안녕하세요", link="http://example.com/unicode"),
        ]
        result = calculate_feed_content_hash(entries)

        assert len(result) == 64

    def test_very_long_title_and_link(self):
        """Very long titles and links should be handled."""
        entries = [
            MockEntry(title="A" * 1000, link="http://example.com/" + "path/" * 100),
        ]
        result = calculate_feed_content_hash(entries)

        assert len(result) == 64

    def test_empty_strings_in_title_and_link(self):
        """Empty strings for title and link should produce valid hash."""
        entries = [MockEntry(title="", link="")]
        result = calculate_feed_content_hash(entries)

        assert len(result) == 64

    def test_hash_matches_expected_format(self):
        """Verify hash format matches expected SHA-256 output."""
        entries = [MockEntry(title="Test", link="http://test.com")]
        result = calculate_feed_content_hash(entries)

        # Manually calculate expected hash
        expected = hashlib.sha256("Test|http://test.com".encode()).hexdigest()

        assert result == expected

    def test_multiple_entries_with_separator(self):
        """Verify multiple entries are joined with correct separator."""
        entries = [
            MockEntry(title="Title1", link="Link1"),
            MockEntry(title="Title2", link="Link2"),
        ]
        result = calculate_feed_content_hash(entries)

        # Manually calculate expected hash with separator
        expected = hashlib.sha256("Title1|Link1||Title2|Link2".encode()).hexdigest()

        assert result == expected

    @pytest.mark.parametrize(
        "count,expected_hash_length",
        [
            (1, 64),
            (5, 64),
            (10, 64),
            (20, 64),
            (100, 64),
        ],
    )
    def test_various_entry_counts(self, count: int, expected_hash_length: int):
        """Hash should always be 64 characters regardless of entry count."""
        entries = [MockEntry(title=f"Article {i}", link=f"http://example.com/{i}") for i in range(count)]
        result = calculate_feed_content_hash(entries)

        assert len(result) == expected_hash_length
