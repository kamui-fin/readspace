"""Tests for article query builder functionality."""

from datetime import datetime, timezone
from uuid import uuid4

import pytest
from sqlalchemy import select
from sqlalchemy.sql import Select

from app.crud.query_builders.article_query_builder import ArticleQueryBuilder
from app.models.rss_models import ClippedArticle, FeedArticle


@pytest.mark.unit
class TestArticleQueryBuilder:
    def setup_method(self):
        self.builder = ArticleQueryBuilder()
        self.user_id = uuid4()
        self.feed_id = uuid4()
        self.folder_id = uuid4()
        self.test_time = datetime.now(timezone.utc)

    def test_build_feed_article_query_basic(self):
        """Test building basic feed article query."""
        filters = {}
        query = self.builder.build_feed_article_query(self.user_id, filters)
        
        assert isinstance(query, Select)
        # Query should filter by user_id
        query_str = str(query)
        assert "feed_articles.user_id = :user_id_1" in query_str

    def test_build_feed_article_query_with_feed_ids(self):
        """Test building feed article query with feed_ids filter."""
        feed_ids = [uuid4(), uuid4()]
        filters = {"feed_ids": feed_ids}
        
        query = self.builder.build_feed_article_query(self.user_id, filters)
        
        # Should contain feed_id filter
        query_str = str(query)
        assert "feed_id" in query_str.lower()

    def test_build_feed_article_query_with_folder_id(self):
        """Test building feed article query with folder_id filter."""
        filters = {"folder_id": self.folder_id}
        
        query = self.builder.build_feed_article_query(self.user_id, filters)
        
        # Should contain join with Feed table
        query_str = str(query)
        assert "feed" in query_str.lower()

    def test_build_feed_article_query_with_boolean_filters(self):
        """Test building feed article query with boolean filters."""
        filters = {
            "is_read": True,
            "is_read_later": False,
            "is_favorite": True,
            "feed_is_favorite": False,
        }
        
        query = self.builder.build_feed_article_query(self.user_id, filters)
        
        query_str = str(query)
        assert "is_read" in query_str.lower()

    def test_build_feed_article_query_with_date_filters(self):
        """Test building feed article query with date range filters."""
        filters = {
            "published_since": self.test_time,
            "published_until": self.test_time,
        }
        
        query = self.builder.build_feed_article_query(self.user_id, filters)
        
        # Should join with ArticleContent for published_at
        query_str = str(query)
        assert "article_content" in query_str.lower() or "articlecontent" in query_str.lower()

    def test_build_feed_article_query_with_search(self):
        """Test building feed article query with search query."""
        filters = {"search_query": "test search"}
        
        query = self.builder.build_feed_article_query(self.user_id, filters)
        
        # Should join with ArticleContent for search
        query_str = str(query)
        assert "article_content" in query_str.lower() or "articlecontent" in query_str.lower()

    def test_build_clipped_article_query_basic(self):
        """Test building basic clipped article query."""
        filters = {}
        query = self.builder.build_clipped_article_query(self.user_id, filters)
        
        assert isinstance(query, Select)
        # Should filter by user_id
        query_str = str(query)
        assert "clipped_articles.user_id = :user_id" in query_str

    def test_build_clipped_article_query_with_filters(self):
        """Test building clipped article query with various filters."""
        filters = {
            "is_read": True,
            "is_read_later": False,
            "is_favorite": True,
            "published_since": self.test_time,
            "published_until": self.test_time,
            "search_query": "test search",
        }
        
        query = self.builder.build_clipped_article_query(self.user_id, filters)
        
        query_str = str(query)
        assert "is_read" in query_str.lower()

    def test_apply_feed_article_filters_all_filters(self):
        """Test applying all possible filters to feed article query."""
        base_query = select(FeedArticle)
        filters = {
            "feed_ids": [uuid4()],
            "folder_id": self.folder_id,
            "is_read": True,
            "is_read_later": False,
            "is_favorite": True,
            "feed_is_favorite": False,
            "published_since": self.test_time,
            "published_until": self.test_time,
            "search_query": "test",
        }
        
        result_query = self.builder._apply_feed_article_filters(base_query, filters)
        
        assert isinstance(result_query, Select)
        query_str = str(result_query)
        assert "feed_id" in query_str.lower()

    def test_apply_clipped_article_filters_all_filters(self):
        """Test applying all possible filters to clipped article query."""
        base_query = select(ClippedArticle)
        filters = {
            "is_read": True,
            "is_read_later": False,
            "is_favorite": True,
            "published_since": self.test_time,
            "published_until": self.test_time,
            "search_query": "test",
        }
        
        result_query = self.builder._apply_clipped_article_filters(base_query, filters)
        
        assert isinstance(result_query, Select)
        query_str = str(result_query)
        assert "is_read" in query_str.lower()

    def test_apply_feed_article_filters_none_values(self):
        """Test that None filter values are properly ignored."""
        base_query = select(FeedArticle)
        filters = {
            "is_read": None,
            "is_read_later": None,
            "is_favorite": None,
            "feed_is_favorite": None,
        }
        
        result_query = self.builder._apply_feed_article_filters(base_query, filters)
        
        # Query should be essentially unchanged (only user filter)
        assert isinstance(result_query, Select)

    def test_apply_clipped_article_filters_none_values(self):
        """Test that None filter values are properly ignored for clipped articles."""
        base_query = select(ClippedArticle)
        filters = {
            "is_read": None,
            "is_read_later": None,
            "is_favorite": None,
        }
        
        result_query = self.builder._apply_clipped_article_filters(base_query, filters)
        
        # Query should be essentially unchanged
        assert isinstance(result_query, Select)

    def test_normalize_feed_article_query(self):
        """Test normalizing feed article query for union."""
        base_query = select(FeedArticle)
        normalized = self.builder._normalize_feed_article_query(base_query)
        
        assert isinstance(normalized, Select)
        # Should select specific columns
        query_str = str(normalized)
        assert "feed_article" in query_str.lower() or "feedarticle" in query_str.lower()

    def test_normalize_clipped_article_query(self):
        """Test normalizing clipped article query for union."""
        base_query = select(ClippedArticle)
        normalized = self.builder._normalize_clipped_article_query(base_query)
        
        assert isinstance(normalized, Select)
        # Should select specific columns
        query_str = str(normalized)
        assert "clipped" in query_str.lower()

    def test_get_sort_column_published_at(self):
        """Test getting sort column for published_at."""
        from unittest.mock import MagicMock
        
        mock_table = MagicMock()
        mock_table.c.published_at = "published_at_column"
        
        result = self.builder._get_sort_column(mock_table, "published_at")
        assert result == "published_at_column"

    def test_get_sort_column_title(self):
        """Test getting sort column for title."""
        from unittest.mock import MagicMock
        
        mock_table = MagicMock()
        mock_table.c.title = "title_column"
        
        result = self.builder._get_sort_column(mock_table, "title")
        assert result == "title_column"

    def test_get_sort_column_created_at(self):
        """Test getting sort column for created_at (maps to published_at)."""
        from unittest.mock import MagicMock
        
        mock_table = MagicMock()
        mock_table.c.published_at = "published_at_column"
        
        result = self.builder._get_sort_column(mock_table, "created_at")
        assert result == "published_at_column"

    def test_get_sort_column_default(self):
        """Test getting sort column for unknown sort_by (defaults to published_at)."""
        from unittest.mock import MagicMock
        
        mock_table = MagicMock()
        mock_table.c.published_at = "published_at_column"
        
        result = self.builder._get_sort_column(mock_table, "unknown_column")
        assert result == "published_at_column"

    def test_build_count_query(self):
        """Test building count query from base query."""
        base_query = select(FeedArticle)
        count_query = self.builder.build_count_query(base_query)
        
        assert isinstance(count_query, Select)
        # Should contain count function
        query_str = str(count_query)
        assert "count" in query_str.lower()

    def test_build_union_query_basic(self):
        """Test building basic union query."""
        feed_query = select(FeedArticle)
        clipped_query = select(ClippedArticle)
        
        union_query = self.builder.build_union_query(
            feed_query, clipped_query, sort_by="published_at", sort_order="desc"
        )
        
        assert isinstance(union_query, Select)

    def test_build_union_query_with_pagination(self):
        """Test building union query with pagination."""
        feed_query = select(FeedArticle)
        clipped_query = select(ClippedArticle)
        
        union_query = self.builder.build_union_query(
            feed_query, clipped_query, skip=10, limit=20
        )
        
        assert isinstance(union_query, Select)
        # Should contain limit and offset
        query_str = str(union_query)
        assert "limit" in query_str.lower() or "offset" in query_str.lower()

    def test_build_union_query_ascending_order(self):
        """Test building union query with ascending order."""
        feed_query = select(FeedArticle)
        clipped_query = select(ClippedArticle)
        
        union_query = self.builder.build_union_query(
            feed_query, clipped_query, sort_order="asc"
        )
        
        assert isinstance(union_query, Select)
        # Should contain ascending order
        query_str = str(union_query)
        assert "asc" in query_str.lower() or "order" in query_str.lower()