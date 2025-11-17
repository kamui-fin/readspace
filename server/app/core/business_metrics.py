"""Business KPI metrics for Readspace.

This module defines metrics that track business-level activity and health indicators,
separate from technical infrastructure metrics. These metrics help understand user
behavior, content processing, and overall platform health.

Usage:
    Import specific metrics and use them in business logic:

    from app.core.business_metrics import user_actions_total, articles_processed_total

    # Track user action
    user_actions_total.labels(action="subscribe").inc()

    # Track article processing
    articles_processed_total.labels(status="new").inc()
"""

from prometheus_client import Counter, Gauge, Histogram

# ============================================================================
# USER ACTIVITY METRICS
# ============================================================================

user_actions_total = Counter(
    "readspace_user_actions_total",
    "Total user actions performed",
    ["action"],  # subscribe, unsubscribe, read, save, favorite, unfavorite
)

user_sessions_total = Counter(
    "readspace_user_sessions_total",
    "Total user session starts",
    ["platform"],  # web, extension, api
)

articles_per_user = Histogram(
    "readspace_articles_per_user",
    "Distribution of articles per user",
    buckets=[0, 10, 50, 100, 250, 500, 1000, 2500, 5000, 10000],
)

feeds_per_user = Histogram(
    "readspace_feeds_per_user",
    "Distribution of feeds per user",
    buckets=[0, 5, 10, 25, 50, 100, 250, 500, 1000],
)

# ============================================================================
# CONTENT PROCESSING METRICS
# ============================================================================

articles_processed_total = Counter(
    "readspace_articles_processed_total",
    "Total articles processed from feeds",
    ["status"],  # new, duplicate, updated, failed
)

articles_extracted_total = Counter(
    "readspace_articles_extracted_total",
    "Total articles with full content extraction",
    ["status", "method"],  # status: success/failure, method: readability/trafilatura/fallback
)

feed_refresh_success_rate = Gauge(
    "readspace_feed_refresh_success_rate",
    "Feed refresh success rate (percentage)",
)

article_age_at_read_hours = Histogram(
    "readspace_article_age_at_read_hours",
    "Age of articles when read (in hours)",
    buckets=[1, 6, 12, 24, 48, 72, 168, 336, 720],  # 1h to 30 days
)

# ============================================================================
# FEED HEALTH METRICS
# ============================================================================

feed_update_frequency_minutes = Histogram(
    "readspace_feed_update_frequency_minutes",
    "Time between feed updates (in minutes)",
    buckets=[5, 15, 30, 60, 120, 360, 720, 1440, 2880],  # 5 min to 2 days
)

articles_per_feed_refresh = Histogram(
    "readspace_articles_per_feed_refresh",
    "Number of new articles per feed refresh",
    buckets=[0, 1, 5, 10, 25, 50, 100, 250, 500],
)

unread_articles_per_feed = Histogram(
    "readspace_unread_articles_per_feed",
    "Unread article distribution per feed",
    buckets=[0, 10, 50, 100, 250, 500, 1000, 2500, 5000],
)

dead_feeds_total = Gauge(
    "readspace_dead_feeds_total",
    "Number of feeds with consecutive failures",
)

# ============================================================================
# READING BEHAVIOR METRICS
# ============================================================================

read_time_seconds = Histogram(
    "readspace_read_time_seconds",
    "Time spent reading articles (estimated)",
    buckets=[10, 30, 60, 120, 300, 600, 1200, 1800, 3600],  # 10s to 1h
)

reading_completion_rate = Histogram(
    "readspace_reading_completion_rate",
    "Percentage of article read",
    buckets=[0.1, 0.25, 0.5, 0.75, 0.9, 1.0],
)

favorite_rate = Gauge(
    "readspace_favorite_rate",
    "Percentage of read articles marked as favorite",
)

# ============================================================================
# SUBSCRIPTION BEHAVIOR METRICS
# ============================================================================

subscription_retention_days = Histogram(
    "readspace_subscription_retention_days",
    "How long subscriptions remain active (days)",
    buckets=[1, 7, 14, 30, 60, 90, 180, 365, 730],  # 1 day to 2 years
)

subscriptions_per_folder = Histogram(
    "readspace_subscriptions_per_folder",
    "Number of subscriptions per folder",
    buckets=[0, 5, 10, 25, 50, 100],
)

# ============================================================================
# CONTENT DISCOVERY METRICS
# ============================================================================

feed_discovery_total = Counter(
    "readspace_feed_discovery_total",
    "Total feed discoveries",
    ["source"],  # manual_url, opml_import, search, suggested
)

feed_discovery_success_rate = Gauge(
    "readspace_feed_discovery_success_rate",
    "Feed discovery success rate (percentage)",
)

# ============================================================================
# SYSTEM HEALTH INDICATORS
# ============================================================================

active_users_daily = Gauge(
    "readspace_active_users_daily",
    "Number of active users in the last 24 hours",
)

active_users_weekly = Gauge(
    "readspace_active_users_weekly",
    "Number of active users in the last 7 days",
)

total_articles_stored = Gauge(
    "readspace_total_articles_stored",
    "Total number of articles in the database",
)

total_feeds_tracked = Gauge(
    "readspace_total_feeds_tracked",
    "Total number of unique feeds being tracked",
)

total_subscriptions = Gauge(
    "readspace_total_subscriptions",
    "Total number of active feed subscriptions",
)

# ============================================================================
# ERROR TRACKING
# ============================================================================

user_errors_total = Counter(
    "readspace_user_errors_total",
    "Total user-facing errors",
    ["error_type", "severity"],  # error_type: validation/not_found/unauthorized, severity: low/medium/high
)

# ============================================================================
# PERFORMANCE INDICATORS
# ============================================================================

time_to_first_article_seconds = Histogram(
    "readspace_time_to_first_article_seconds",
    "Time from subscription to first article appearing",
    buckets=[1, 5, 10, 30, 60, 120, 300, 600],  # 1s to 10 minutes
)

feed_refresh_backlog = Gauge(
    "readspace_feed_refresh_backlog",
    "Number of feeds pending refresh",
)

article_processing_backlog = Gauge(
    "readspace_article_processing_backlog",
    "Number of articles pending processing",
)
