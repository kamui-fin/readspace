"""
Application constants
"""

from datetime import timedelta

# RSS Feed Constants
DEFAULT_RSS_TIMEOUT = 180  # seconds
DEFAULT_CACHE_TTL_SECONDS = 15 * 60  # 15 minutes
OPML_IMPORT_TIMEOUT_SECONDS = 8  # seconds
MIN_ARTICLE_COUNT = 1  # Minimum articles required for valid feed

# OPML Import Constants
MAX_OPML_FILE_SIZE_MB = 50  # Maximum OPML file size (50MB)
OPML_IMPORT_TASK_TTL_SECONDS = 24 * 60 * 60  # Redis TTL for import tasks (24 hours)
SUPPORTED_OPML_EXTENSIONS = (".opml", ".xml")  # Allowed file extensions
FALLBACK_ENCODINGS = ["latin-1", "cp1252", "iso-8859-1"]  # Encodings to try if UTF-8 fails

# Environment Configuration
SHOW_DOCS_ENVIRONMENTS = ("development", "staging", "local")  # Environments to show API docs

# Feed Refresh Intervals (in minutes)
MIN_REFRESH_INTERVAL_MINUTES = 1
DEFAULT_REFRESH_INTERVAL_MINUTES = 35
MAX_REFRESH_INTERVAL_MINUTES = 24 * 60  # 1 day
ERROR_BACKOFF_BASE_MINUTES = 35
MAX_ERROR_BACKOFF_MINUTES = 12 * 60

# Database Pagination
DEFAULT_PAGE_SIZE = 50  # Default page size for general queries
MAX_PAGE_SIZE = 100  # Maximum items to return in a single page for list endpoints
MAX_FEEDS_PER_USER_QUERY = 1000  # Maximum feeds to return in a single user query
MAX_FEEDS_BATCH_SIZE = 1000  # Maximum feeds to process in a single batch
BATCH_INSERT_THRESHOLD = 100  # Threshold for using temp table in batch inserts

# String Length Limits
MAX_URL_LENGTH = 2048
MAX_TITLE_LENGTH = 500
MAX_TITLE_DB_LENGTH = 1000  # Database column length for titles
MAX_DESCRIPTION_LENGTH = 2000
MAX_TAG_NAME_LENGTH = 100
MAX_FOLDER_NAME_LENGTH = 255
MAX_FEED_DESCRIPTION_LENGTH = 1000  # Maximum length for feed descriptions
MAX_SUMMARY_LENGTH = 1000  # Maximum length for AI-generated summaries
MAX_EXTRACTED_CONTENT_LENGTH = 10000  # Maximum length for extracted article content

# File Upload Limits
MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024  # 50MB
ALLOWED_BOOK_FORMATS = ["EPUB", "PDF"]
ALLOWED_IMAGE_FORMATS = ["jpg", "jpeg", "png", "gif", "webp"]

# Cache Keys
FEED_CONTENT_CACHE_PREFIX = "feed_content:"
USER_CACHE_PREFIX = "user:"
ARTICLE_CACHE_PREFIX = "article:"

# Cache TTL (Time To Live) in seconds
ARTICLE_LIST_CACHE_TTL = 300  # 5 minutes for article lists
AI_CACHE_TTL = 86400  # 24 hours for AI results
OPML_TASK_CACHE_TTL = 86400  # 24 hours for OPML import tasks
SIMILARITY_SEARCH_CACHE_TTL = 3600  # 1 hour for similarity search results
POPULARITY_SCORE_CACHE_TTL = 3600  # 1 hour for popularity score calculations
DOMAIN_LOOKUP_CACHE_TTL = 3600  # 1 hour for PageRank domain lookups
HYBRID_SEARCH_CACHE_TTL = 1800  # 30 minutes for hybrid search results

# User Agent
DEFAULT_USER_AGENT = "Mozilla/5.0 (compatible; Readspace/1.0; +https://readspace.app/bot)"
BROWSER_USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"

# HTTP Client Configuration
HTTP_CLIENT_POOL_LIMITS = 100  # Maximum number of connections to pool
HTTP_CLIENT_MAX_KEEPALIVE = 20  # Maximum number of keep-alive connections
HTTP_CLIENT_KEEPALIVE_EXPIRY = 30.0  # Seconds before an idle connection is closed

# Highlight Colors
HIGHLIGHT_COLORS = ["yellow", "green", "blue"]

# Article Priorities
ARTICLE_PRIORITIES = ["low", "medium", "high"]

# Time Deltas
RECENT_READ_CUTOFF = timedelta(days=30)
OLD_ARTICLE_CUTOFF = timedelta(days=90)

# Content Extraction
MIN_CONTENT_LENGTH = 500  # Minimum character length to consider content complete
AUTO_EXTRACT_ENABLED = True  # Enable automatic content extraction
AUTO_EXTRACT_ON_FETCH = True  # Extract content automatically when fetching articles
CONTENT_EXTRACTION_TIMEOUT = 10  # seconds - timeout for fetching and extracting content
FAVICON_FETCH_TIMEOUT = 10  # seconds - timeout for fetching canonical URL and favicon

# AI Service
DEFAULT_AI_MAX_TOKENS = 1000  # Default maximum tokens for AI responses
MAX_COMPOSITE_TEXT_LENGTH = 1000  # Maximum length for composite text in AI processing
MAX_AI_SUMMARIZATION_CONTENT_BYTES = 100 * 1024  # Maximum content size for summarization (100KB)
MAX_AI_TRANSLATION_CONTENT_BYTES = 50 * 1024  # Maximum content size for translation (50KB)

# Article Scoring
ARTICLE_SCORE_CONTENT_DIVISOR = 1000  # Divisor for content length in article scoring

# Common Error Messages
ERROR_FEED_NOT_FOUND = "Feed not found"
ERROR_ARTICLE_NOT_FOUND = "Article not found"
ERROR_HIGHLIGHT_NOT_FOUND = "Highlight not found"
ERROR_FOLDER_NOT_FOUND = "Folder not found"
ERROR_USER_NOT_FOUND = "User profile not found"
ERROR_BOOK_NOT_FOUND = "Book metadata not found"
ERROR_INVALID_FOLDER_DATA = "Invalid folder data"

# HTTP Caching Configuration
CACHE_CONTROL_STATIC_FEEDS = "public, max-age=3600"  # 1 hour for feed metadata
CACHE_CONTROL_ARTICLE_LISTS = "private, max-age=300"  # 5 minutes for article lists
CACHE_CONTROL_NO_CACHE = "no-cache, no-store, must-revalidate"  # For dynamic content
CACHE_CONTROL_IMMUTABLE = "public, max-age=31536000, immutable"  # For immutable resources

# Response Compression Configuration
COMPRESSION_MIN_SIZE = 500  # Minimum response size in bytes to compress
COMPRESSION_LEVEL = 5  # Brotli compression level (0-11, higher = better compression but slower)
COMPRESSION_CONTENT_TYPES = {
    "application/json",
    "application/javascript",
    "text/html",
    "text/css",
    "text/plain",
    "text/xml",
    "application/xml",
}

# Cursor Pagination Configuration
DEFAULT_CURSOR_LIMIT = 50  # Default number of items per cursor page
MAX_CURSOR_LIMIT = 200  # Maximum items allowed per cursor page
