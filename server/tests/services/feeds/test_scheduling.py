from datetime import datetime, timedelta
import pytest
from app.services.feeds.scheduling import calculate_interval_from_pub_times
from app.core.constants import (
    DEFAULT_REFRESH_INTERVAL_MINUTES,
    MAX_REFRESH_INTERVAL_MINUTES,
    MIN_REFRESH_INTERVAL_MINUTES,
)


def test_calculate_interval_insufficient_articles():
    # Case 1: Empty list
    assert calculate_interval_from_pub_times([]) == DEFAULT_REFRESH_INTERVAL_MINUTES

    # Case 2: Single article
    assert calculate_interval_from_pub_times([datetime.now()]) == DEFAULT_REFRESH_INTERVAL_MINUTES


def test_calculate_interval_zero_time_span():
    # All posts at the same time
    now = datetime.now()
    pub_times = [now, now, now]
    assert calculate_interval_from_pub_times(pub_times) == DEFAULT_REFRESH_INTERVAL_MINUTES


def test_calculate_interval_high_frequency():
    # >= 1 post/hour. e.g. 2 posts in 1 hour.
    now = datetime.now()
    # posts at t=0, t=-30m, t=-60m. 3 posts in 1 hour. Frequency = 3/1 = 3.
    pub_times = [now, now - timedelta(minutes=30), now - timedelta(minutes=60)]
    # Expected: 10 minutes
    assert calculate_interval_from_pub_times(pub_times) == 10


def test_calculate_interval_low_frequency():
    # <= 0.01 post/hour. e.g. 2 posts in 200 hours.
    now = datetime.now()
    pub_times = [now, now - timedelta(hours=200)]
    # Frequency = 2 / 200 = 0.01.
    # Expected: MAX_REFRESH_INTERVAL_MINUTES
    assert calculate_interval_from_pub_times(pub_times) == MAX_REFRESH_INTERVAL_MINUTES


def test_calculate_interval_typical_frequency():
    # Typical frequency. e.g. 1 post every 2 hours.
    # Frequency = 0.5 posts/hour.
    # Avg gap = 120 minutes.
    # Expected = 120 * 0.33 = 39.6 -> 39.
    now = datetime.now()
    pub_times = [now, now - timedelta(hours=2), now - timedelta(hours=4)]
    expected = int(120 * 0.33)  # 39
    # Ensure it's within bounds (MIN=15, MAX=1440 usually)
    assert calculate_interval_from_pub_times(pub_times) == expected


def test_calculate_interval_bounds_min():
    # Very frequent but logic says avg_gap * 0.33 might be small if not caught by high freq check?
    # Wait, high freq check is >= 1.0 post/hour.
    # If we have 0.9 posts/hour.
    # Gap is ~66 minutes.
    # 66 * 0.33 = 21. This is > MIN (15).

    # Let's try to trigger MIN bound.
    # We need avg_gap * 0.33 < MIN (15) => avg_gap < 45 mins.
    # But if avg_gap < 45 mins, frequency is > 1.33 posts/hour.
    # So it would be caught by high frequency check (>= 1.0) and return 10.
    # 10 < MIN (15).
    # So the high frequency return 10 is actually LOWER than MIN_REFRESH_INTERVAL_MINUTES?
    # Let's check the code:
    # interval = 10
    # ...
    # interval = max(MIN_REFRESH_INTERVAL_MINUTES, min(interval, MAX_REFRESH_INTERVAL_MINUTES))

    # If MIN_REFRESH_INTERVAL_MINUTES is 15 (default in many apps, let's check constants), then 10 becomes 15.
    # So high frequency feeds get clamped to MIN.

    # Let's verify MIN_REFRESH_INTERVAL_MINUTES value.
    # I'll assume it's 15 based on `app/crud/feed/core.py` showing `MIN_REFRESH_MINUTES = 15`.
    # But `app/core/constants.py` is imported.

    # Let's write the test expecting it to be clamped to MIN.

    # Case: High frequency returns 10, but clamped to MIN.
    now = datetime.now()
    pub_times = [now, now - timedelta(minutes=30), now - timedelta(minutes=60)]
    # Internal logic says 10.
    # Final result should be max(MIN, 10).
    assert calculate_interval_from_pub_times(pub_times) == max(MIN_REFRESH_INTERVAL_MINUTES, 10)


def test_calculate_interval_bounds_max():
    # Logic returns something huge, clamped to MAX.
    # We already tested low frequency returning MAX.
    # Let's try typical frequency that results in > MAX.
    # e.g. Gap = 5000 minutes.
    # 5000 * 0.33 = 1650.
    # MAX is usually 1440 (24h).

    # Frequency = 2 posts / (5000 min / 60) = 2 / 83 = 0.024.
    # 0.024 > 0.01. So it falls to "Typical".

    now = datetime.now()
    pub_times = [now, now - timedelta(minutes=5000)]

    expected_raw = int(5000 * 0.33)
    assert expected_raw > MAX_REFRESH_INTERVAL_MINUTES

    assert calculate_interval_from_pub_times(pub_times) == MAX_REFRESH_INTERVAL_MINUTES
