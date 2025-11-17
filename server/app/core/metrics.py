"""Centralized Prometheus metrics definitions.

This module provides a centralized location for all Prometheus metrics used throughout
the application. Metrics are organized by category for better maintainability.

Naming Convention:
    - Format: readspace_<subsystem>_<name>_<unit>
    - Counters: Use _total suffix
    - Histograms: Use _seconds or _bytes suffix
    - Gauges: Current state (no suffix needed)

Metric Types:
    - Counter: Monotonically increasing values (requests, errors, operations)
    - Gauge: Values that can go up or down (active connections, queue depth)
    - Histogram: Distribution of values (duration, size, count)
"""

from prometheus_client import Counter, Gauge, Histogram

# ============================================================================
# HTTP REQUEST METRICS
# ============================================================================

http_requests_total = Counter(
    "readspace_http_requests_total",
    "Total HTTP requests",
    ["method", "endpoint", "status"],
)

http_requests_in_progress = Gauge(
    "readspace_http_requests_in_progress",
    "Number of HTTP requests currently being processed",
    ["method", "endpoint"],
)

http_request_duration_seconds = Histogram(
    "readspace_http_request_duration_seconds",
    "HTTP request duration in seconds",
    ["method", "endpoint"],
    buckets=[0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0],
)

http_request_size_bytes = Histogram(
    "readspace_http_request_size_bytes",
    "HTTP request body size in bytes",
    ["method", "endpoint"],
    buckets=[100, 1000, 10000, 100000, 1000000, 10000000],
)

http_response_size_bytes = Histogram(
    "readspace_http_response_size_bytes",
    "HTTP response body size in bytes",
    ["method", "endpoint"],
    buckets=[100, 1000, 10000, 100000, 1000000, 10000000],
)

# ============================================================================
# DATABASE METRICS
# ============================================================================

db_query_duration_seconds = Histogram(
    "readspace_db_query_duration_seconds",
    "Database query duration in seconds",
    ["operation", "table"],
    buckets=[0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0],
)

db_queries_total = Counter(
    "readspace_db_queries_total",
    "Total database queries executed",
    ["operation", "table", "status"],
)

db_connections_active = Gauge(
    "readspace_db_connections_active",
    "Number of active database connections",
)

db_connections_idle = Gauge(
    "readspace_db_connections_idle",
    "Number of idle database connections in the pool",
)

db_pool_size = Gauge(
    "readspace_db_pool_size",
    "Current size of the database connection pool",
)

db_pool_overflow = Gauge(
    "readspace_db_pool_overflow",
    "Number of connections exceeding the pool size",
)

db_pool_checkouts_total = Counter(
    "readspace_db_pool_checkouts_total",
    "Total number of connection checkouts from the pool",
)

# ============================================================================
# CACHE METRICS
# ============================================================================

cache_operations_total = Counter(
    "readspace_cache_operations_total",
    "Total cache operations",
    ["operation", "result"],  # operation: get/set/delete, result: hit/miss/error/success
)

cache_operation_duration_seconds = Histogram(
    "readspace_cache_operation_duration_seconds",
    "Cache operation duration in seconds",
    ["operation"],
    buckets=[0.0001, 0.0005, 0.001, 0.005, 0.01, 0.025, 0.05, 0.1],
)

cache_keys_total = Gauge(
    "readspace_cache_keys_total",
    "Total number of keys in the cache",
)

cache_memory_bytes = Gauge(
    "readspace_cache_memory_bytes",
    "Memory used by the cache in bytes",
)

# ============================================================================
# EXTERNAL API METRICS
# ============================================================================

external_api_calls_total = Counter(
    "readspace_external_api_calls_total",
    "Total external API calls",
    ["service", "status"],  # service: rss_feed/ai/content_extraction, status: success/error/timeout
)

external_api_duration_seconds = Histogram(
    "readspace_external_api_duration_seconds",
    "External API call duration in seconds",
    ["service", "cached"],
    buckets=[0.1, 0.5, 1.0, 2.0, 5.0, 10.0, 30.0, 60.0, 120.0],
)

external_api_errors_total = Counter(
    "readspace_external_api_errors_total",
    "Total external API errors",
    ["service", "error_type"],
)

# ============================================================================
# RSS FEED METRICS
# ============================================================================

rss_fetch_total = Counter(
    "readspace_rss_fetch_total",
    "Total RSS feed fetch operations",
    ["status", "cached"],
)

rss_fetch_duration_seconds = Histogram(
    "readspace_rss_fetch_duration_seconds",
    "RSS feed fetch duration in seconds",
    ["cached"],
    buckets=[0.1, 0.5, 1.0, 2.0, 5.0, 10.0, 30.0, 60.0],
)

rss_fetch_size_bytes = Histogram(
    "readspace_rss_fetch_size_bytes",
    "RSS feed content size in bytes",
    buckets=[1000, 10000, 50000, 100000, 500000, 1000000, 5000000],
)

rss_parse_duration_seconds = Histogram(
    "readspace_rss_parse_duration_seconds",
    "RSS feed parsing duration in seconds",
    buckets=[0.01, 0.05, 0.1, 0.5, 1.0, 2.0, 5.0],
)

rss_articles_per_feed = Histogram(
    "readspace_rss_articles_per_feed",
    "Number of articles per RSS feed",
    buckets=[1, 5, 10, 25, 50, 100, 250, 500, 1000],
)

# ============================================================================
# AI SERVICE METRICS
# ============================================================================

ai_requests_total = Counter(
    "readspace_ai_requests_total",
    "Total AI service requests",
    ["operation", "model", "status"],  # operation: summarize/translate/enrich/embed
)

ai_request_duration_seconds = Histogram(
    "readspace_ai_request_duration_seconds",
    "AI service request duration in seconds",
    ["operation", "model"],
    buckets=[0.1, 0.5, 1.0, 2.0, 5.0, 10.0, 30.0, 60.0, 120.0],
)

ai_token_usage_total = Counter(
    "readspace_ai_token_usage_total",
    "Total AI tokens used",
    ["operation", "model", "direction"],  # direction: prompt/response
)

ai_batch_size = Histogram(
    "readspace_ai_batch_size",
    "AI batch operation size",
    ["operation"],
    buckets=[1, 5, 10, 25, 50, 100, 250, 500],
)

# ============================================================================
# CONTENT EXTRACTION METRICS
# ============================================================================

content_extraction_total = Counter(
    "readspace_content_extraction_total",
    "Total content extraction operations",
    ["status"],  # status: success/failure/timeout
)

content_extraction_duration_seconds = Histogram(
    "readspace_content_extraction_duration_seconds",
    "Content extraction duration in seconds",
    buckets=[0.5, 1.0, 2.0, 5.0, 10.0, 30.0, 60.0],
)

extracted_content_size_bytes = Histogram(
    "readspace_extracted_content_size_bytes",
    "Extracted content size in bytes",
    buckets=[1000, 10000, 50000, 100000, 500000, 1000000],
)

# ============================================================================
# ARTICLE OPERATION METRICS
# ============================================================================

article_operations_total = Counter(
    "readspace_article_operations_total",
    "Total article operations",
    ["operation", "status"],  # operation: save/read/favorite/delete/update
)

article_operation_duration_seconds = Histogram(
    "readspace_article_operation_duration_seconds",
    "Article operation duration in seconds",
    ["operation"],
    buckets=[0.01, 0.05, 0.1, 0.5, 1.0, 2.0, 5.0],
)

articles_per_query = Histogram(
    "readspace_articles_per_query",
    "Number of articles returned per query",
    buckets=[1, 10, 25, 50, 100, 250, 500, 1000],
)

# ============================================================================
# FEED OPERATION METRICS
# ============================================================================

feed_operations_total = Counter(
    "readspace_feed_operations_total",
    "Total feed operations",
    ["operation", "status"],  # operation: subscribe/unsubscribe/refresh/delete/bulk_*
)

feed_operation_duration_seconds = Histogram(
    "readspace_feed_operation_duration_seconds",
    "Feed operation duration in seconds",
    ["operation"],
    buckets=[0.01, 0.05, 0.1, 0.5, 1.0, 2.0, 5.0, 10.0],
)

# ============================================================================
# OPML OPERATION METRICS
# ============================================================================

# OPML Import Session Metrics
opml_imports_total = Counter(
    "readspace_opml_imports_total",
    "Total OPML import operations",
    ["status"],  # status: started/completed/cancelled/failed
)

opml_imports_in_progress = Gauge(
    "readspace_opml_imports_in_progress",
    "Number of OPML imports currently in progress",
)

opml_import_duration_seconds = Histogram(
    "readspace_opml_import_duration_seconds",
    "OPML import duration in seconds",
    buckets=[1.0, 5.0, 10.0, 30.0, 60.0, 120.0, 300.0, 600.0],
)

opml_file_size_bytes = Histogram(
    "readspace_opml_file_size_bytes",
    "OPML file size in bytes",
    buckets=[1000, 10000, 50000, 100000, 500000, 1000000],
)

opml_feeds_per_import = Histogram(
    "readspace_opml_feeds_per_import",
    "Number of feeds per OPML import",
    buckets=[1, 5, 10, 25, 50, 100, 250, 500, 1000],
)

# OPML Individual Feed Import Metrics
opml_feeds_imported_total = Counter(
    "readspace_opml_feeds_imported_total",
    "Total number of feeds imported via OPML",
    ["status"],  # success, failed, skipped, already_exists
)

opml_feeds_failed_total = Counter(
    "readspace_opml_feeds_failed_total",
    "Total number of feeds that failed to import via OPML",
)

opml_feeds_in_progress = Gauge(
    "readspace_opml_feeds_in_progress",
    "Number of feeds currently being imported via OPML",
)

opml_feed_import_duration_seconds = Histogram(
    "readspace_opml_feed_import_duration_seconds",
    "Time taken to import a single feed via OPML",
    buckets=[0.5, 1.0, 2.0, 5.0, 10.0, 30.0, 60.0],
)

# ============================================================================
# WORKER METRICS
# ============================================================================

worker_tasks_total = Counter(
    "readspace_worker_tasks_total",
    "Total worker tasks executed",
    ["task_name", "status"],  # status: success/failure/retry
)

worker_task_duration_seconds = Histogram(
    "readspace_worker_task_duration_seconds",
    "Worker task duration in seconds",
    ["task_name"],
    buckets=[0.1, 0.5, 1.0, 5.0, 10.0, 30.0, 60.0, 300.0, 600.0],
)

worker_queue_depth = Gauge(
    "readspace_worker_queue_depth",
    "Number of tasks in the worker queue",
    ["queue_name"],
)

worker_tasks_in_progress = Gauge(
    "readspace_worker_tasks_in_progress",
    "Number of worker tasks currently executing",
    ["task_name"],
)

# ============================================================================
# DISCOVERY & SEARCH METRICS
# ============================================================================

discovery_searches_total = Counter(
    "readspace_discovery_searches_total",
    "Total feed discovery searches",
    ["search_type", "status"],  # search_type: hybrid/category/url/preview, status: success/no_results/error
)

discovery_search_duration_seconds = Histogram(
    "readspace_discovery_search_duration_seconds",
    "Feed discovery search duration in seconds",
    ["search_type"],
    buckets=[0.01, 0.05, 0.1, 0.5, 1.0, 2.0, 5.0, 10.0],
)

discovery_results_per_search = Histogram(
    "readspace_discovery_results_per_search",
    "Number of results returned per search",
    ["search_type"],
    buckets=[0, 1, 5, 10, 25, 50, 100],
)

feed_preview_operations_total = Counter(
    "readspace_feed_preview_operations_total",
    "Total feed preview operations",
    ["status"],  # success/invalid_feed/fetch_error/parse_error
)

feed_preview_duration_seconds = Histogram(
    "readspace_feed_preview_duration_seconds",
    "Feed preview operation duration in seconds",
    buckets=[0.5, 1.0, 2.0, 5.0, 10.0, 30.0, 60.0],
)

# ============================================================================
# SUBSCRIPTION METRICS
# ============================================================================

subscription_lifecycle_total = Counter(
    "readspace_subscription_lifecycle_total",
    "Total subscription lifecycle operations",
    ["operation", "status"],  # operation: create/update/delete, status: success/already_exists/not_found/error
)

subscription_operation_duration_seconds = Histogram(
    "readspace_subscription_operation_duration_seconds",
    "Subscription operation duration in seconds",
    ["operation"],
    buckets=[0.01, 0.05, 0.1, 0.5, 1.0, 2.0, 5.0],
)

subscription_duplicate_attempts_total = Counter(
    "readspace_subscription_duplicate_attempts_total",
    "Total duplicate subscription attempts",
    ["source"],  # direct/opml/search
)

# ============================================================================
# FEED CREATION METRICS
# ============================================================================

feed_creation_total = Counter(
    "readspace_feed_creation_total",
    "Total feed creation operations",
    ["status"],  # success/exists/validation_error/parse_error/connection_error/error
)

feed_creation_duration_seconds = Histogram(
    "readspace_feed_creation_duration_seconds",
    "Feed creation operation duration in seconds",
    ["phase"],  # url_resolution/validation/parsing/deduplication/database_write/total
    buckets=[0.1, 0.5, 1.0, 2.0, 5.0, 10.0, 30.0],
)

feed_duplicate_detected_total = Counter(
    "readspace_feed_duplicate_detected_total",
    "Total duplicate feeds detected during creation",
    ["detection_method"],  # url/link/content_hash/title
)

feed_url_redirects_total = Counter(
    "readspace_feed_url_redirects_total",
    "Total URL redirects during feed resolution",
    ["redirect_count"],  # 0, 1, 2, 3+
)

# ============================================================================
# FEED REFRESH METRICS
# ============================================================================

feed_refresh_phases_duration_seconds = Histogram(
    "readspace_feed_refresh_phases_duration_seconds",
    "Feed refresh phase durations in seconds",
    ["phase"],  # metadata_fetch/network_io/database_write
    buckets=[0.001, 0.01, 0.1, 0.5, 1.0, 5.0, 10.0, 30.0],
)

feed_content_hash_comparison_total = Counter(
    "readspace_feed_content_hash_comparison_total",
    "Total feed content hash comparisons",
    ["result"],  # unchanged/changed/no_previous_hash
)

feed_304_responses_total = Counter(
    "readspace_feed_304_responses_total",
    "Total 304 Not Modified responses from RSS feeds",
    ["etag_used"],  # true/false
)

feed_articles_created_per_refresh = Histogram(
    "readspace_feed_articles_created_per_refresh",
    "Number of new articles created per feed refresh",
    buckets=[0, 1, 5, 10, 25, 50, 100],
)

# ============================================================================
# OPML ROUTER METRICS
# ============================================================================

opml_validation_total = Counter(
    "readspace_opml_validation_total",
    "Total OPML validation operations",
    ["status"],  # success/invalid_xml/invalid_structure/encoding_error/too_large
)

opml_import_requests_total = Counter(
    "readspace_opml_import_requests_total",
    "Total OPML import requests",
    ["status"],  # accepted/rejected_limit/rejected_validation/rejected_size
)

opml_export_total = Counter(
    "readspace_opml_export_total",
    "Total OPML export operations",
    ["status"],  # success/error
)

opml_export_duration_seconds = Histogram(
    "readspace_opml_export_duration_seconds",
    "OPML export operation duration in seconds",
    buckets=[0.1, 0.5, 1.0, 2.0, 5.0, 10.0],
)

# ============================================================================
# FOLDER METRICS
# ============================================================================

folder_operations_total = Counter(
    "readspace_folder_operations_total",
    "Total folder operations",
    ["operation", "status"],  # operation: create/update/delete/list/mark_all_read, status: success/error/not_found
)

folder_operation_duration_seconds = Histogram(
    "readspace_folder_operation_duration_seconds",
    "Folder operation duration in seconds",
    ["operation"],
    buckets=[0.01, 0.05, 0.1, 0.5, 1.0, 2.0, 5.0],
)

folder_mark_all_read_subscriptions_updated = Histogram(
    "readspace_folder_mark_all_read_subscriptions_updated",
    "Number of subscriptions updated in mark-all-read operation",
    buckets=[1, 5, 10, 25, 50, 100],
)

folder_batch_creation_size = Histogram(
    "readspace_folder_batch_creation_size",
    "Number of folders created in batch operation",
    buckets=[1, 5, 10, 25, 50, 100],
)

# ============================================================================
# SIMILAR FEEDS METRICS
# ============================================================================

similar_feed_searches_total = Counter(
    "readspace_similar_feed_searches_total",
    "Total similar feed searches",
    ["status"],  # success/no_results/not_found/error
)

similar_feed_search_duration_seconds = Histogram(
    "readspace_similar_feed_search_duration_seconds",
    "Similar feed search duration in seconds",
    buckets=[0.01, 0.05, 0.1, 0.5, 1.0, 2.0, 5.0],
)

similar_feed_results_returned = Histogram(
    "readspace_similar_feed_results_returned",
    "Number of similar feeds returned per search",
    buckets=[0, 1, 5, 10, 20],
)

# ============================================================================
# ARTICLE ENHANCEMENT METRICS
# ============================================================================

article_enhancement_requests_total = Counter(
    "readspace_article_enhancement_requests_total",
    "Total article enhancement requests",
    ["operation", "status"],  # operation: extract/summarize/translate, status: success/no_content/error/validation_error
)

article_enhancement_duration_seconds = Histogram(
    "readspace_article_enhancement_duration_seconds",
    "Article enhancement operation duration in seconds",
    ["operation"],
    buckets=[0.5, 1.0, 2.0, 5.0, 10.0, 30.0, 60.0],
)

article_content_fallback_used = Counter(
    "readspace_article_content_fallback_used",
    "Article content fallback sources used",
    ["operation", "fallback_source"],  # operation: summarize/translate, fallback_source: request/extracted/article/description
)

article_content_size_validation_failures = Counter(
    "readspace_article_content_size_validation_failures",
    "Article content size validation failures",
    ["operation"],  # summarize/translate
)
