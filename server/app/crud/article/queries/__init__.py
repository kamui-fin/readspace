"""Specialized read queries for articles."""

from .aggregations import get_all_unread_counts
from .pagination import (
    get_articles_cursor_paginated,
    get_combined_articles_cursor_paginated,
)
from .specialized import (
    count_articles_by_folder,
    get_articles_by_feed,
    get_articles_by_folder,
    get_articles_for_today,
    get_read_later_count,
    get_unread_articles_count,
)
from .unified import CRUDUnifiedArticles, unified_articles

__all__ = [
    # specialized queries
    "get_articles_for_today",
    "get_read_later_count",
    "get_articles_by_folder",
    "get_articles_by_feed",
    "count_articles_by_folder",
    "get_unread_articles_count",
    # aggregations
    "get_all_unread_counts",
    # pagination
    "get_articles_cursor_paginated",
    "get_combined_articles_cursor_paginated",
    # unified
    "CRUDUnifiedArticles",
    "unified_articles",
]
