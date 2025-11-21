"""Unit tests for adaptive feed scheduling calculations."""

import pytest

from app.core.constants import DEFAULT_REFRESH_INTERVAL_MINUTES, MAX_ERROR_BACKOFF_MINUTES
from app.services.feeds.scheduler import calculate_error_backoff_interval


@pytest.mark.unit
class TestCalculateErrorBackoffInterval:
    """Tests for calculate_error_backoff_interval function."""

    def test_zero_errors_returns_default(self):
        """Zero consecutive errors should return default interval."""
        result = calculate_error_backoff_interval(0)
        assert result == DEFAULT_REFRESH_INTERVAL_MINUTES

    def test_one_error_returns_two_hours(self):
        """One consecutive error should return ~2 hours (120 minutes)."""
        result = calculate_error_backoff_interval(1)

        # 2^1 * 60 = 120 minutes, with ±25% jitter
        # Jitter range: 90-150 minutes
        assert 90 <= result <= 150

    def test_two_errors_returns_four_hours(self):
        """Two consecutive errors should return ~4 hours (240 minutes)."""
        result = calculate_error_backoff_interval(2)

        # 2^2 * 60 = 240 minutes, with ±25% jitter
        # Jitter range: 180-300 minutes
        assert 180 <= result <= 300

    def test_three_errors_returns_eight_hours(self):
        """Three consecutive errors should return ~8 hours (480 minutes)."""
        result = calculate_error_backoff_interval(3)

        # 2^3 * 60 = 480 minutes, with ±25% jitter
        # Jitter range: 360-600 minutes
        assert 360 <= result <= 600

    def test_four_errors_capped_at_max(self):
        """Four consecutive errors should be capped at MAX_ERROR_BACKOFF_MINUTES."""
        result = calculate_error_backoff_interval(4)

        # 2^4 * 60 = 960 minutes, but capped at 720 (12 hours)
        # With jitter: 540-900 minutes
        assert 540 <= result <= 900
        assert result <= MAX_ERROR_BACKOFF_MINUTES * 1.25  # Account for jitter

    def test_five_errors_stays_at_max(self):
        """Five consecutive errors should still be capped at max."""
        result = calculate_error_backoff_interval(5)

        # 2^5 * 60 = 1920 minutes, but capped at 720 (12 hours)
        # With jitter: 540-900 minutes
        assert 540 <= result <= 900

    def test_very_high_error_count_stays_capped(self):
        """Very high error counts should remain capped."""
        result = calculate_error_backoff_interval(10)

        # Should be capped at 720 minutes (12 hours) with jitter
        assert 540 <= result <= 900

    def test_exponential_growth_pattern(self):
        """Error backoff should follow exponential pattern."""
        # Run multiple times to account for jitter variance
        intervals = []
        for _ in range(10):
            intervals.append(
                (
                    calculate_error_backoff_interval(1),
                    calculate_error_backoff_interval(2),
                    calculate_error_backoff_interval(3),
                )
            )

        # Average out jitter to see exponential pattern
        avg_1 = sum(i[0] for i in intervals) / len(intervals)
        avg_2 = sum(i[1] for i in intervals) / len(intervals)
        avg_3 = sum(i[2] for i in intervals) / len(intervals)

        # avg_2 should be roughly 2x avg_1
        assert 1.5 <= (avg_2 / avg_1) <= 2.5

        # avg_3 should be roughly 2x avg_2
        assert 1.5 <= (avg_3 / avg_2) <= 2.5

    def test_jitter_adds_randomness(self):
        """Multiple calls should produce different results due to jitter."""
        results = [calculate_error_backoff_interval(2) for _ in range(10)]

        # Should have at least some variation (not all identical)
        unique_results = set(results)
        assert len(unique_results) > 1

    def test_jitter_stays_within_bounds(self):
        """Jitter should keep results within ±25% range."""
        # Test 100 times to ensure jitter is working properly
        for _ in range(100):
            result = calculate_error_backoff_interval(2)

            # Base delay: 2^2 * 60 = 240 minutes
            # Jitter range: 240 * 0.75 to 240 * 1.25 = 180-300
            assert 180 <= result <= 300

    def test_result_is_integer(self):
        """Result should always be an integer."""
        for errors in range(0, 6):
            result = calculate_error_backoff_interval(errors)
            assert isinstance(result, int)

    def test_negative_errors_handled_gracefully(self):
        """Negative error count should be handled (though shouldn't happen in practice)."""
        # Should handle gracefully - either treat as 0 or minimal backoff
        result = calculate_error_backoff_interval(-1)
        # Should return a valid interval (exact behavior depends on implementation)
        assert result > 0

    @pytest.mark.parametrize(
        "error_count,min_expected,max_expected",
        [
            (0, DEFAULT_REFRESH_INTERVAL_MINUTES, DEFAULT_REFRESH_INTERVAL_MINUTES),
            (1, 90, 150),  # 2 hours ±25%
            (2, 180, 300),  # 4 hours ±25%
            (3, 360, 600),  # 8 hours ±25%
            (4, 540, 900),  # 12 hours (capped) ±25%
            (5, 540, 900),  # 12 hours (capped) ±25%
        ],
    )
    def test_parametrized_backoff_ranges(self, error_count: int, min_expected: int, max_expected: int):
        """Test backoff intervals fall within expected ranges."""
        result = calculate_error_backoff_interval(error_count)
        assert min_expected <= result <= max_expected

    def test_base_calculation_without_jitter(self):
        """Verify base calculation follows 2^n * 60 formula."""
        # Run many times and average to eliminate jitter
        samples = 100
        results = [calculate_error_backoff_interval(2) for _ in range(samples)]
        avg_result = sum(results) / len(results)

        # Expected base: 2^2 * 60 = 240
        # With jitter average should be close to base (within a few percent)
        expected_base = (2**2) * 60
        # Allow 5% variance in average (should be very close with 100 samples)
        assert abs(avg_result - expected_base) / expected_base < 0.05

    def test_cap_at_max_backoff(self):
        """Verify capping at MAX_ERROR_BACKOFF_MINUTES works."""
        # For high error counts, base delay should be capped before jitter
        result = calculate_error_backoff_interval(10)

        # Even with maximum jitter (1.25x), should not exceed cap * jitter
        assert result <= MAX_ERROR_BACKOFF_MINUTES * 1.25

    def test_single_error_progression(self):
        """Test full progression from 0 to multiple errors."""
        error_0 = calculate_error_backoff_interval(0)
        error_1 = calculate_error_backoff_interval(1)
        error_2 = calculate_error_backoff_interval(2)
        error_3 = calculate_error_backoff_interval(3)

        # Each should generally increase (accounting for jitter variance)
        # error_0 should be exactly DEFAULT_REFRESH_INTERVAL_MINUTES
        assert error_0 == DEFAULT_REFRESH_INTERVAL_MINUTES

        # error_1 should be significantly higher than error_0
        assert error_1 > error_0

        # error_2 should generally be higher than error_1 (may overlap due to jitter)
        # Average should be higher
        avg_1 = sum(calculate_error_backoff_interval(1) for _ in range(20)) / 20
        avg_2 = sum(calculate_error_backoff_interval(2) for _ in range(20)) / 20
        assert avg_2 > avg_1

    def test_jitter_prevents_thundering_herd(self):
        """Jitter should create spread to prevent thundering herd."""
        # Simulate many feeds failing at once
        intervals = [calculate_error_backoff_interval(2) for _ in range(50)]

        # Should have good distribution (at least 10 unique values in 50 samples)
        unique_intervals = set(intervals)
        assert len(unique_intervals) >= 10

        # Standard deviation should be reasonable (not all clustered)
        mean = sum(intervals) / len(intervals)
        variance = sum((x - mean) ** 2 for x in intervals) / len(intervals)
        std_dev = variance**0.5

        # Standard deviation should be meaningful (>1% of mean)
        assert std_dev > mean * 0.01

    def test_consistency_with_constants(self):
        """Ensure function uses correct constants."""
        # Zero errors should return DEFAULT_REFRESH_INTERVAL_MINUTES
        assert calculate_error_backoff_interval(0) == DEFAULT_REFRESH_INTERVAL_MINUTES

        # High errors should respect MAX_ERROR_BACKOFF_MINUTES cap
        for errors in [4, 5, 10, 100]:
            result = calculate_error_backoff_interval(errors)
            # With jitter, max is 1.25x the cap
            assert result <= MAX_ERROR_BACKOFF_MINUTES * 1.25
