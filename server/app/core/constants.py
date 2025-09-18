"""
Application constants
"""

from datetime import timedelta

# RSS Feed Constants
DEFAULT_RSS_TIMEOUT = 180  # seconds
DEFAULT_CACHE_TTL_SECONDS = 15 * 60  # 15 minutes
OPML_IMPORT_TIMEOUT_SECONDS = 8  # seconds
MIN_ARTICLE_COUNT = 1  # Minimum articles required for valid feed

# Feed Refresh Intervals (in minutes)
MIN_REFRESH_INTERVAL_MINUTES = 1
DEFAULT_REFRESH_INTERVAL_MINUTES = 35
MAX_REFRESH_INTERVAL_MINUTES = 24 * 60  # 1 day
ERROR_BACKOFF_BASE_MINUTES = 35
MAX_ERROR_BACKOFF_MINUTES = 12 * 60

# Database Pagination
DEFAULT_PAGE_SIZE = 100
MAX_PAGE_SIZE = 1000

# String Length Limits
MAX_URL_LENGTH = 2048
MAX_TITLE_LENGTH = 500
MAX_DESCRIPTION_LENGTH = 2000
MAX_TAG_NAME_LENGTH = 100
MAX_FOLDER_NAME_LENGTH = 255

# File Upload Limits
MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024  # 50MB
ALLOWED_BOOK_FORMATS = ["EPUB", "PDF"]
ALLOWED_IMAGE_FORMATS = ["jpg", "jpeg", "png", "gif", "webp"]

# Cache Keys
FEED_CONTENT_CACHE_PREFIX = "feed_content:"
USER_CACHE_PREFIX = "user:"
ARTICLE_CACHE_PREFIX = "article:"

# User Agent
DEFAULT_USER_AGENT = "Mozilla/5.0 (compatible; Readspace/1.0; +https://readspace.app/bot)"

# Highlight Colors
HIGHLIGHT_COLORS = ["yellow", "green", "blue"]

# Article Priorities
ARTICLE_PRIORITIES = ["low", "medium", "high"]

# Time Deltas
RECENT_READ_CUTOFF = timedelta(days=30)
OLD_ARTICLE_CUTOFF = timedelta(days=90)

# Common Error Messages
ERROR_FEED_NOT_FOUND = "Feed not found"
ERROR_ARTICLE_NOT_FOUND = "Article not found"
ERROR_HIGHLIGHT_NOT_FOUND = "Highlight not found"
ERROR_FOLDER_NOT_FOUND = "Folder not found"
ERROR_USER_NOT_FOUND = "User profile not found"
ERROR_BOOK_NOT_FOUND = "Book metadata not found"
ERROR_INVALID_FOLDER_DATA = "Invalid folder data"
