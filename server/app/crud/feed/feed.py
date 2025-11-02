"""CRUD operations for the new global feeds (feeds_new) table.

This module provides a facade for feed CRUD operations by re-exporting
functionality from specialized modules:
- crud_feed_queries.py: Basic CRUD operations
- crud_feed_scheduling.py: Feed refresh scheduling
- crud_feed_enrichment.py: Metadata and enrichment updates

Import from this module for backward compatibility.
"""

# Import all functions from specialized modules for backward compatibility
from app.crud.feed.feed_enrichment import (
    update_feed_enrichment,
    update_feed_metadata,
)
from app.crud.feed.feed_queries import (
    create_feed,
    get_feed_by_id,
    get_feed_by_url,
    get_feeds_by_user,
    get_or_migrate_feed,
    normalize_feed_url,
)
from app.crud.feed.feed_scheduling import (
    get_feeds_needing_refresh,
    update_feed_error,
)

# Re-export all for backward compatibility
__all__ = [
    # Query functions
    "normalize_feed_url",
    "get_feed_by_id",
    "get_feed_by_url",
    "get_or_migrate_feed",
    "create_feed",
    "get_feeds_by_user",
    # Scheduling functions
    "get_feeds_needing_refresh",
    "update_feed_error",
    # Enrichment functions
    "update_feed_metadata",
    "update_feed_enrichment",
]
