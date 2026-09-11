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
FEED_CACHE_TTL = 300  # 5 minutes for fetched feed content, to avoid hammering feeds

# User Agent — realistic modern Chrome UA to avoid 403 blocks from bot detection
BROWSER_USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36"
)

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
INITIAL_UNREAD_COUNT = 10  # Number of recent articles to show as unread on new subscriptions

# Article Compaction (Cleanup)
ARTICLE_RETENTION_DAYS = 7  # Delete articles older than 30 days (beyond minimum retention)
MIN_ARTICLES_PER_FEED = 50  # Keep at least 50 newest articles per feed

# Content Extraction
MIN_CONTENT_LENGTH = 500  # Minimum character length to consider content complete
AUTO_EXTRACT_ON_FETCH = True  # Extract content automatically when fetching articles. TODO: This should be user-specific
CONTENT_EXTRACTION_TIMEOUT = 5  # seconds - timeout for fetching and extracting content
FAVICON_FETCH_TIMEOUT = 10  # seconds - timeout for fetching canonical URL and favicon

# Daily Usage Counters (Redis)
USAGE_COUNTER_TTL_SECONDS = 36 * 3600  # 36h - safe across timezone day boundaries
SCRAPE_USAGE_KEY_PREFIX = "scrape_usage"  # scrape_usage:{user_id}:{YYYY-MM-DD}

# AI Service
DEFAULT_AI_MAX_TOKENS = 1000  # Default maximum tokens for AI responses
MAX_COMPOSITE_TEXT_LENGTH = 1000  # Maximum length for composite text in AI processing
MAX_AI_SUMMARIZATION_CONTENT_BYTES = 100 * 1024  # Maximum content size for summarization (100KB)
MAX_AI_TRANSLATION_CONTENT_BYTES = 50 * 1024  # Maximum content size for translation (50KB)
MAX_AI_INPUT_CHARS = 15000  # Maximum characters for AI input

# Article Summarization ("The Gist")
SUMMARY_TEMPERATURE = 0.2  # Lower than the generic default; extraction wants determinism
SUMMARY_MAX_OUTPUT_TOKENS = 4000  # Headroom for long features / CJK; not the bottleneck


# Codex Digest
CODEX_INGEST_WINDOW_HOURS = 24  # Fixed lookback window for v1
# Phase 1 catalog cap — cost / context safety valve. Temporarily capped at 100 (down from the
# design doc's 1000) while validating the pipeline end-to-end; raise once cost is modeled.
CODEX_MAX_ARTICLES = 100
CODEX_MAX_PER_FEED = 30  # Stops one hyperactive feed dominating the catalog
CODEX_MAX_DEVELOPMENTS = 5  # Clusters synthesised and shown; the model may find more
# Bodies fetched per cluster for Phase 2. Raised above the display cap's floor so the model
# judges "best write-up" from full text for as many candidates as will actually be cited.
CODEX_MAX_ARTICLES_PER_DEVELOPMENT_FULLTEXT = 5
CODEX_MAX_ARTICLES_PER_DEVELOPMENT_DISPLAY = 8  # Article refs shown under a Development card
CODEX_MAX_WORTH_READING = 4  # Standalone strip size
CODEX_MAX_WORTH_READING_FALLBACK = 6  # Raised cap when Phase 1 finds no valid clusters
CODEX_FULLTEXT_CHAR_CAP = 12000  # Per-article body truncation for Phase 2
CODEX_FULLTEXT_FETCH_CONCURRENCY = 6  # asyncio.Semaphore bound on Phase 1.5
CODEX_SNIPPET_CHAR_CAP = 280  # Phase 1 snippet length
CODEX_GATHER_PAGE_SIZE = 100  # Page size for the Phase 0 get_articles pagination loop
# "Reading time reclaimed" stat — the source articles Codex folds into Developments would have
# taken this long to read; the digest takes ~2 minutes. Only Development write-ups count
# (Worth Reading is still meant to be read). Full text gives a real word count; the rest fall
# back to CODEX_ASSUMED_WORDS_PER_ARTICLE.
CODEX_READING_WPM = 220  # Adult non-fiction silent reading speed (200-250 band)
CODEX_ASSUMED_WORDS_PER_ARTICLE = 650  # Fallback when a cited article had no full text fetched
CODEX_MAX_MINUTES_CONDENSED = 90  # Clamp — above this the stat reads as "~90+ min"
CODEX_MAX_DAY_THEMES = 4  # Phase 1 "today's keywords" tag count

# A generation task times out at 300s server-side (Taskiq `timeout=300`, `max_retries=1` on
# generate_codex_digest_task). A PENDING/IN_PROGRESS row still around well past that is
# orphaned - the worker crashed, was killed mid-task (e.g. a dev restart), or hit an uncaught
# cancellation that skipped the pipeline's own FAILED-marking. Self-heal it to FAILED rather
# than polling it (and blocking the quota) forever.
CODEX_STALE_IN_FLIGHT_MINUTES = 12

# Development card imagery. The pipeline probes each cited article's image and picks a hero +
# a small strip, so the client renders exactly what it's told (no client-side measuring).
CODEX_HERO_MIN_WIDTH = 1000  # A hero band spans the card's main column — below this it upscales
CODEX_HERO_MIN_RATIO = 1.2  # width/height floor — reject near-square / portrait crops for a hero
CODEX_STRIP_MIN_WIDTH = 400  # Below this an image can't even fill a strip/mosaic tile cleanly
CODEX_MAX_STRIP_IMAGES = 4  # Strip tops out at a 2x2 mosaic
# Only the first N candidate images can end up rendered (1 hero + the strip cap), so probing
# past that is wasted work — cap the fan-out there.
CODEX_MAX_IMAGE_PROBES = CODEX_MAX_STRIP_IMAGES + 1
CODEX_IMAGE_PROBE_BYTES = 65536  # Ranged GET size — enough for the header of any common format
CODEX_IMAGE_PROBE_TIMEOUT = 4.0  # Per-image probe timeout (seconds)
CODEX_IMAGE_PROBE_CONCURRENCY = 8  # asyncio.Semaphore bound on the probe fan-out

# Common Error Messages
ERROR_FEED_NOT_FOUND = "Feed not found"
ERROR_ARTICLE_NOT_FOUND = "Article not found"
ERROR_HIGHLIGHT_NOT_FOUND = "Highlight not found"
ERROR_FOLDER_NOT_FOUND = "Folder not found"
ERROR_USER_NOT_FOUND = "User profile not found"
ERROR_INVALID_FOLDER_DATA = "Invalid folder data"

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
