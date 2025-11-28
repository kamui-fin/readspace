"""
Application constants
"""

from datetime import timedelta

# RSS Feed Constants
DEFAULT_RSS_TIMEOUT = 30  # seconds - reduced from 180s to prevent connection exhaustion

# OPML Import Constants
MAX_OPML_FILE_SIZE_MB = 5  # Maximum OPML file size (50MB)
OPML_IMPORT_TASK_TTL_SECONDS = 24 * 60 * 60  # Redis TTL for import tasks (24 hours)
SUPPORTED_OPML_EXTENSIONS = (".opml", ".xml")  # Allowed file extensions

# Environment Configuration
SHOW_DOCS_ENVIRONMENTS = (
    "development",
    "staging",
    "local",
)  # Environments to show API docs

# Feed Refresh Intervals (in minutes)
MIN_REFRESH_INTERVAL_MINUTES = 1
DEFAULT_REFRESH_INTERVAL_MINUTES = 35
MAX_REFRESH_INTERVAL_MINUTES = 24 * 60  # 1 day
MAX_ERROR_BACKOFF_MINUTES = 12 * 60

# Database Pagination
MAX_PAGE_SIZE = 100  # Maximum items to return in a single page for list endpoints
MAX_FEEDS_BATCH_SIZE = 1000  # Maximum feeds to process in a single batch

# String Length Limits
MAX_URL_LENGTH = 2048
MAX_TITLE_LENGTH = 500
MAX_DESCRIPTION_LENGTH = 2000
MAX_FOLDER_NAME_LENGTH = 255
MAX_TAG_NAME_LENGTH = 50

# Cache Keys
FEED_CONTENT_CACHE_PREFIX = "feed_content:"
USER_CACHE_PREFIX = "user:"
ARTICLE_CACHE_PREFIX = "article:"

# Cache TTL (Time To Live) in seconds
ARTICLE_LIST_CACHE_TTL = 300  # 5 minutes for article lists
AI_CACHE_TTL = 86400  # 24 hours for AI results
OPML_TASK_CACHE_TTL = 86400  # 24 hours for OPML import tasks

# User Agent
BROWSER_USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"

# HTTP Client Configuration
HTTP_CLIENT_POOL_LIMITS = 200  # Maximum number of connections to pool
HTTP_CLIENT_MAX_KEEPALIVE = 20  # Maximum number of keep-alive connections
HTTP_CLIENT_KEEPALIVE_EXPIRY = 30.0  # Seconds before an idle connection is closed

# Article Priorities
ARTICLE_PRIORITIES = ["low", "medium", "high"]

# Time Deltas
RECENT_READ_CUTOFF = timedelta(days=30)
OLD_ARTICLE_CUTOFF = timedelta(days=90)

# Date Validation
MIN_VALID_PUBLISHED_YEAR = 1990  # Minimum year for valid article publication dates

# Unread Article Management
UNREAD_RETENTION_DAYS = 30  # Auto-mark articles older than this as read
INITIAL_UNREAD_COUNT = (
    10  # Number of recent articles to show as unread on new subscriptions
)

# Article Compaction (Cleanup)
ARTICLE_RETENTION_DAYS = (
    7  # Delete articles older than 30 days (beyond minimum retention)
)
MIN_ARTICLES_PER_FEED = 50  # Keep at least 50 newest articles per feed

# Content Extraction
MIN_CONTENT_LENGTH = 500  # Minimum character length to consider content complete
AUTO_EXTRACT_ON_FETCH = True  # Extract content automatically when fetching articles. TODO: This should be user-specific
CONTENT_EXTRACTION_TIMEOUT = 10  # seconds - timeout for fetching and extracting content
FAVICON_FETCH_TIMEOUT = 10  # seconds - timeout for fetching canonical URL and favicon

# AI Service
DEFAULT_AI_MAX_TOKENS = 1000  # Default maximum tokens for AI responses
MAX_COMPOSITE_TEXT_LENGTH = 1000  # Maximum length for composite text in AI processing
MAX_AI_SUMMARIZATION_CONTENT_BYTES = (
    100 * 1024
)  # Maximum content size for summarization (100KB)
MAX_AI_TRANSLATION_CONTENT_BYTES = (
    50 * 1024
)  # Maximum content size for translation (50KB)
MAX_AI_INPUT_CHARS = 15000  # Maximum characters for AI input


# Common Error Messages
ERROR_FEED_NOT_FOUND = "Feed not found"
ERROR_ARTICLE_NOT_FOUND = "Article not found"
ERROR_HIGHLIGHT_NOT_FOUND = "Highlight not found"
ERROR_FOLDER_NOT_FOUND = "Folder not found"
ERROR_USER_NOT_FOUND = "User profile not found"
ERROR_INVALID_FOLDER_DATA = "Invalid folder data"

# Response Compression Configuration
COMPRESSION_MIN_SIZE = 500  # Minimum response size in bytes to compress
COMPRESSION_LEVEL = (
    5  # Brotli compression level (0-11, higher = better compression but slower)
)
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


# HTML Sanitization
ALLOWED_TAGS = {
    "a",
    "abbr",
    "acronym",
    "b",
    "blockquote",
    "br",
    "code",
    "div",
    "em",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "hr",
    "i",
    "img",
    "li",
    "ol",
    "p",
    "pre",
    "span",
    "strong",
    "table",
    "tbody",
    "td",
    "th",
    "thead",
    "tr",
    "ul",
    "video",
    "source",
    "figure",
    "figcaption",
}

ALLOWED_ATTRIBUTES = {
    "a": {"href", "title", "target"},
    "img": {"src", "alt", "title", "width", "height"},
    "video": {"src", "controls", "poster"},
    "source": {"src", "type"},
    "code": {"class"},
    "span": {"class"},
    "div": {"class"},
}
