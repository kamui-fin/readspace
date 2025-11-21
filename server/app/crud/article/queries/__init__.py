"""Specialized read queries for articles."""

from .aggregations import get_all_unread_counts, get_unread_counts_by_folder
from .pagination import (
    CursorPaginationParams,
    CursorPaginationResult,
    get_articles_cursor_paginated,
    get_combined_articles_cursor_paginated,
)
from .retrieval import (
    count_articles_filtered,
    get_article_by_id,
    get_articles_filtered,
)
from .specialized import (
    count_read_later_articles,
    count_today_articles,
    count_unread_articles,
    count_unread_articles_by_folder,
    get_read_later_articles,
    get_recently_read_articles,
)
from .unified import CRUDUnifiedArticles, unified_articles

__all__ = [
    # retrieval
    "get_article_by_id",
    "get_articles_filtered",
    "count_articles_filtered",
    # specialized queries
    "get_recently_read_articles",
    "count_read_later_articles",
    "count_today_articles",
    "get_read_later_articles",
    "count_unread_articles",
    "count_unread_articles_by_folder",
    # aggregations
    "get_all_unread_counts",
    "get_unread_counts_by_folder",
    # pagination
    "CursorPaginationParams",
    "CursorPaginationResult",
    "get_articles_cursor_paginated",
    "get_combined_articles_cursor_paginated",
    # unified
    "CRUDUnifiedArticles",
    "unified_articles",
]
