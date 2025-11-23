"""
Article CRUD operations and queries.

This module provides a clean, organized interface for all article-related database operations.

Structure:
- operations/: Basic CRUD operations using repository pattern
- queries/: Specialized read queries (today, read later, aggregations, etc.)
- builders/: Query construction for complex filtering
- business/: Complex business logic (bulk operations, state management)
- transformers/: Data transformation between models and responses
"""

# ============================================================================
# BASIC CRUD OPERATIONS (Repository Pattern)
# ============================================================================
# ============================================================================
# QUERY BUILDERS
# ============================================================================
from .builders import FeedArticleQueryBuilder, UnifiedArticleQueryBuilder

# ============================================================================
# BUSINESS LOGIC
# ============================================================================
from .business import create_articles_batch, update_article_status
from .operations import (
    CRUDArticleContent,
    CRUDClippedArticle,
    CRUDFeedArticle,
    CRUDUserArticleState,
    article_content,
    clipped_articles,
    feed_articles,
    user_article_state,
)

# ============================================================================
# AGGREGATION QUERIES (Optimized Raw SQL)
# ============================================================================
from .queries.aggregations import get_all_unread_counts

# ============================================================================
# PAGINATION
# ============================================================================
from .queries.pagination import (
    CursorPaginationParams,
    CursorPaginationResult,
    get_articles_cursor_paginated,
    get_combined_articles_cursor_paginated,
)

# ============================================================================
# RETRIEVAL QUERIES
# ============================================================================
from .queries.retrieval import (
    count_articles_filtered,
    get_article_by_id,
    get_articles_filtered,
)

# ============================================================================
# SPECIALIZED QUERIES
# ============================================================================
from .queries.specialized import (
    count_read_later_articles,
    count_today_articles,
    count_unread_articles,
    get_read_later_articles,
    get_recently_read_articles,
)

# ============================================================================
# UNIFIED QUERIES (Feed + Clipped Articles)
# ============================================================================
from .queries.unified import CRUDUnifiedArticles, unified_articles

# ============================================================================
# TRANSFORMERS
# ============================================================================
from .transformer import ArticleTransformer

__all__ = [
    # === CRUD Operations (Repository Pattern) ===
    "CRUDArticleContent",
    "article_content",
    "CRUDFeedArticle",
    "feed_articles",
    "CRUDClippedArticle",
    "clipped_articles",
    "CRUDUserArticleState",
    "user_article_state",
    # === Retrieval Queries ===
    "get_article_by_id",
    "get_articles_filtered",
    "count_articles_filtered",
    # === Specialized Queries ===
    "get_recently_read_articles",
    "count_read_later_articles",
    "count_today_articles",
    "get_read_later_articles",
    "count_unread_articles",
    # === Aggregation Queries ===
    "get_all_unread_counts",
    # === Pagination ===
    "CursorPaginationParams",
    "CursorPaginationResult",
    "get_articles_cursor_paginated",
    "get_combined_articles_cursor_paginated",
    # === Unified Queries ===
    "CRUDUnifiedArticles",
    "unified_articles",
    # === Query Builders ===
    "FeedArticleQueryBuilder",
    "UnifiedArticleQueryBuilder",
    # === Business Logic ===
    "create_articles_batch",
    "update_article_status",
    # === Transformers ===
    "ArticleTransformer",
]
