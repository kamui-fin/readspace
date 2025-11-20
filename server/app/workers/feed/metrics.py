"""Prometheus metrics for feed workers."""

from prometheus_client import Counter, Gauge, Histogram

# Counter: Total feeds refreshed
feeds_refreshed_total = Counter(
    "readspace_feeds_refreshed_total",
    "Total number of feeds successfully refreshed",
)

# Counter: Total feeds failed
feeds_failed_total = Counter(
    "readspace_feeds_failed_total",
    "Total number of feeds that failed to refresh",
)

# Gauge: Feeds currently being refreshed
feeds_in_progress = Gauge(
    "readspace_feeds_in_progress",
    "Number of feeds currently being refreshed",
)

# Histogram: Feed refresh duration
feed_refresh_duration = Histogram(
    "readspace_feed_refresh_duration_seconds",
    "Time taken to refresh a single feed",
    buckets=[0.1, 0.5, 1.0, 2.0, 5.0, 10.0, 30.0, 60.0],
)

# Gauge: Feeds scheduled in last cycle
feeds_scheduled_last_cycle = Gauge(
    "readspace_feeds_scheduled_last_cycle",
    "Number of feeds scheduled in the last scheduling cycle",
)

# Histogram: Batch scheduling duration
batch_scheduling_duration = Histogram(
    "readspace_batch_scheduling_duration_seconds",
    "Time taken to schedule a batch of feed refreshes",
    buckets=[0.1, 0.5, 1.0, 5.0, 10.0, 30.0],
)
