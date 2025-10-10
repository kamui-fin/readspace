"""Unit tests for adaptive feed scheduler - pure logic only, no database."""

from app.core.constants import DEFAULT_REFRESH_INTERVAL_MINUTES, MAX_ERROR_BACKOFF_MINUTES
from app.services.adaptive_feed_scheduler import calculate_error_backoff_interval


def test_calculate_error_backoff_no_errors():
    """Test backoff calculation with no errors."""
    interval = calculate_error_backoff_interval(0)
    assert interval == DEFAULT_REFRESH_INTERVAL_MINUTES


def test_calculate_error_backoff_one_error():
    """Test backoff calculation with 1 error."""
    interval = calculate_error_backoff_interval(1)
    # 2^1 * 60 = 120 minutes (2 hours) ± 25% jitter
    assert 90 <= interval <= 150, f"Expected 90-150, got {interval}"


def test_calculate_error_backoff_two_errors():
    """Test backoff calculation with 2 errors."""
    interval = calculate_error_backoff_interval(2)
    # 2^2 * 60 = 240 minutes (4 hours) ± 25% jitter
    assert 180 <= interval <= 300, f"Expected 180-300, got {interval}"


def test_calculate_error_backoff_three_errors():
    """Test backoff calculation with 3 errors."""
    interval = calculate_error_backoff_interval(3)
    # 2^3 * 60 = 480 minutes (8 hours) ± 25% jitter
    assert 360 <= interval <= 600, f"Expected 360-600, got {interval}"


def test_calculate_error_backoff_many_errors_capped():
    """Test backoff calculation caps at max (12 hours)."""
    interval = calculate_error_backoff_interval(10)
    # Should be capped at MAX_ERROR_BACKOFF_MINUTES (720 min) ± 25% jitter
    assert 540 <= interval <= 900, f"Expected 540-900, got {interval}"


def test_calculate_error_backoff_includes_jitter():
    """Test that backoff includes randomization to prevent thundering herd."""
    intervals = [calculate_error_backoff_interval(2) for _ in range(10)]

    # Not all intervals should be identical due to jitter
    unique_intervals = len(set(intervals))
    assert unique_intervals > 1, f"Jitter should produce varied intervals, got {unique_intervals} unique values"

    # All should be within expected range
    for interval in intervals:
        assert 180 <= interval <= 300, f"Interval {interval} outside expected range 180-300"


def test_calculate_error_backoff_progression():
    """Test that backoff increases exponentially."""
    backoff_0 = calculate_error_backoff_interval(0)
    backoff_1 = calculate_error_backoff_interval(1)
    backoff_2 = calculate_error_backoff_interval(2)
    backoff_3 = calculate_error_backoff_interval(3)

    # Each level should have higher average (accounting for jitter)
    # Just check general progression holds
    assert backoff_0 < backoff_1  # 35 < ~120
    assert backoff_1 < backoff_2  # ~120 < ~240
    assert backoff_2 < backoff_3  # ~240 < ~480


def test_content_hash_calculation():
    """Test content hash calculation produces consistent hashes."""
    from app.services.feed_service import FeedService

    # Mock entries with minimal interface
    class MockEntry:
        def __init__(self, title: str, link: str):
            self.title = title
            self.link = link

    entries = [
        MockEntry("Article 1", "https://example.com/1"),
        MockEntry("Article 2", "https://example.com/2"),
        MockEntry("Article 3", "https://example.com/3"),
    ]

    service = FeedService(db=None)  # type: ignore - we're not using DB methods
    hash1 = service._calculate_content_hash(entries)

    # Same content should produce same hash (deterministic)
    hash2 = service._calculate_content_hash(entries)
    assert hash1 == hash2, "Same content should produce identical hash"
    assert len(hash1) == 64, "SHA-256 should produce 64 hex characters"


def test_content_hash_detects_differences():
    """Test content hash produces different hashes for different content."""
    from app.services.feed_service import FeedService

    class MockEntry:
        def __init__(self, title: str, link: str):
            self.title = title
            self.link = link

    entries1 = [
        MockEntry("Article 1", "https://example.com/1"),
        MockEntry("Article 2", "https://example.com/2"),
    ]

    entries2 = [
        MockEntry("Different Article", "https://example.com/1"),  # Different title
        MockEntry("Article 2", "https://example.com/2"),
    ]

    service = FeedService(db=None)  # type: ignore
    hash1 = service._calculate_content_hash(entries1)
    hash2 = service._calculate_content_hash(entries2)

    assert hash1 != hash2, "Different content should produce different hashes"


def test_content_hash_empty_entries():
    """Test content hash handles empty entry list."""
    from app.services.feed_service import FeedService

    service = FeedService(db=None)  # type: ignore
    hash_result = service._calculate_content_hash([])

    assert hash_result == "", "Empty entries should return empty string"


def test_content_hash_only_uses_top_10():
    """Test that content hash only considers first 10 articles."""
    from app.services.feed_service import FeedService

    class MockEntry:
        def __init__(self, title: str, link: str):
            self.title = title
            self.link = link

    # Create 15 entries
    entries = [MockEntry(f"Article {i}", f"https://example.com/{i}") for i in range(15)]

    service = FeedService(db=None)  # type: ignore
    hash1 = service._calculate_content_hash(entries)

    # Modify entries beyond 10th - hash should remain same
    entries_modified = entries[:10] + [MockEntry("Completely Different", "https://different.com/999")] * 5

    hash2 = service._calculate_content_hash(entries_modified)

    assert hash1 == hash2, "Hash should only consider first 10 articles, changes beyond that ignored"


def test_content_hash_handles_missing_attributes():
    """Test content hash handles entries with missing title/link gracefully."""
    from app.services.feed_service import FeedService

    class PartialEntry:
        """Entry with only some attributes."""

        pass

    # Entry with no title or link
    entries = [PartialEntry()]

    service = FeedService(db=None)  # type: ignore
    # Should not crash, should use empty strings for missing attrs
    hash_result = service._calculate_content_hash(entries)

    assert isinstance(hash_result, str), "Should return string even with missing attributes"
    assert len(hash_result) == 64, "Should still produce valid SHA-256"


def test_content_hash_order_matters():
    """Test that article order affects the hash."""
    from app.services.feed_service import FeedService

    class MockEntry:
        def __init__(self, title: str, link: str):
            self.title = title
            self.link = link

    entries1 = [
        MockEntry("Article A", "https://example.com/a"),
        MockEntry("Article B", "https://example.com/b"),
    ]

    entries2 = [
        MockEntry("Article B", "https://example.com/b"),  # Swapped order
        MockEntry("Article A", "https://example.com/a"),
    ]

    service = FeedService(db=None)  # type: ignore
    hash1 = service._calculate_content_hash(entries1)
    hash2 = service._calculate_content_hash(entries2)

    assert hash1 != hash2, "Article order should affect hash (feeds show most recent first)"
