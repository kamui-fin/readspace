"""CRUD operations for global feeds.

This module provides a facade for feed CRUD operations by re-exporting
functionality from specialized modules:
- core.py: Basic CRUD operations
- url_handling.py: URL normalization and migration
- enrichment.py: Metadata and enrichment updates
- scheduling.py: Feed refresh scheduling
"""

# Core CRUD operations
from app.crud.feed.core import (
    create_feed,
    get_feed_by_id,
    get_feed_by_url,
    get_feeds_by_user,
)

# Enrichment operations
from app.crud.feed.enrichment import (
    update_feed_enrichment,
    update_feed_metadata,
)

# Scheduling operations
from app.crud.feed.scheduling import (
    get_feeds_needing_refresh,
    update_feed_error,
)

# URL handling
from app.crud.feed.url_handling import (
    get_or_migrate_feed,
    normalize_feed_url,
)

# Re-export all functions
__all__ = [
    # Core CRUD
    "get_feed_by_id",
    "get_feed_by_url",
    "create_feed",
    "get_feeds_by_user",
    # URL handling
    "normalize_feed_url",
    "get_or_migrate_feed",
    # Enrichment
    "update_feed_metadata",
    "update_feed_enrichment",
    # Scheduling
    "get_feeds_needing_refresh",
    "update_feed_error",
]
