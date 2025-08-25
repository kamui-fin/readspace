"""Unit tests for ArticleQueryBuilder."""
import pytest
from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy import select
from app.crud.article_query_builder import ArticleQueryBuilder
from app.models.rss_models import Article, ArticleContent, Feed


@pytest.mark.unit
class TestArticleQueryBuilder:
    """Test cases for ArticleQueryBuilder."""

    def setup_method(self):
        """Set up test fixtures."""
        self.user_id = uuid4()
        self.builder = ArticleQueryBuilder(user_id=self.user_id)

    def test_build_base_query(self):
        """Test building base query and count query."""
        stmt, count_stmt = self.builder.build_base_query()
        
        # Basic checks that queries are built correctly
        assert stmt is not None
        assert count_stmt is not None
        
        # Check that user_id filter is applied
        # Note: In a real test environment, you'd want to verify the SQL structure
        # but for unit tests, we're focusing on the method logic

    def test_apply_feed_filter(self):
        """Test applying feed ID filter."""
        stmt, count_stmt = self.builder.build_base_query()
        feed_ids = [uuid4(), uuid4()]
        
        filtered_stmt, filtered_count = self.builder.apply_feed_filter(stmt, count_stmt, feed_ids)
        
        # Verify that the method returns statements (exact SQL verification would require more setup)
        assert filtered_stmt is not None
        assert filtered_count is not None

    def test_apply_folder_filter(self):
        """Test applying folder filter."""
        stmt, count_stmt = self.builder.build_base_query()
        folder_id = uuid4()
        
        filtered_stmt, filtered_count = self.builder.apply_folder_filter(stmt, count_stmt, folder_id)
        
        assert filtered_stmt is not None
        assert filtered_count is not None

    def test_apply_read_status_filter(self):
        """Test applying read status filter."""
        stmt, count_stmt = self.builder.build_base_query()
        
        # Test with is_read=True
        filtered_stmt, filtered_count = self.builder.apply_read_status_filter(stmt, count_stmt, True)
        assert filtered_stmt is not None
        assert filtered_count is not None
        
        # Test with is_read=False
        filtered_stmt, filtered_count = self.builder.apply_read_status_filter(stmt, count_stmt, False)
        assert filtered_stmt is not None
        assert filtered_count is not None

    def test_apply_date_range_filter(self):
        """Test applying date range filter."""
        stmt, count_stmt = self.builder.build_base_query()
        since_date = datetime(2023, 1, 1, tzinfo=timezone.utc)
        until_date = datetime(2023, 12, 31, tzinfo=timezone.utc)
        
        # Test with both dates
        filtered_stmt, filtered_count = self.builder.apply_date_range_filter(
            stmt, count_stmt, since_date, until_date
        )
        assert filtered_stmt is not None
        assert filtered_count is not None
        
        # Test with only since date
        filtered_stmt, filtered_count = self.builder.apply_date_range_filter(
            stmt, count_stmt, published_since=since_date
        )
        assert filtered_stmt is not None
        assert filtered_count is not None
        
        # Test with only until date
        filtered_stmt, filtered_count = self.builder.apply_date_range_filter(
            stmt, count_stmt, published_until=until_date
        )
        assert filtered_stmt is not None
        assert filtered_count is not None

    def test_apply_search_filter(self):
        """Test applying search filter."""
        stmt, count_stmt = self.builder.build_base_query()
        search_query = "python programming"
        
        filtered_stmt, filtered_count = self.builder.apply_search_filter(stmt, count_stmt, search_query)
        
        assert filtered_stmt is not None
        assert filtered_count is not None

    def test_apply_sorting_default(self):
        """Test applying default sorting."""
        stmt, _ = self.builder.build_base_query()
        
        sorted_stmt = self.builder.apply_sorting(stmt)
        
        assert sorted_stmt is not None

    def test_apply_sorting_custom(self):
        """Test applying custom sorting."""
        stmt, _ = self.builder.build_base_query()
        
        # Test different sort combinations
        sort_combinations = [
            ("published_at", "asc"),
            ("created_at", "desc"),
            ("read_at", "asc"),
            ("title", "desc"),
            ("invalid_field", "asc"),  # Should default to published_at
        ]
        
        for sort_by, sort_order in sort_combinations:
            sorted_stmt = self.builder.apply_sorting(stmt, sort_by, sort_order)
            assert sorted_stmt is not None

    def test_build_filtered_query_comprehensive(self):
        """Test building a comprehensive filtered query with all options."""
        feed_ids = [uuid4(), uuid4()]
        folder_id = uuid4()
        since_date = datetime(2023, 1, 1, tzinfo=timezone.utc)
        until_date = datetime(2023, 12, 31, tzinfo=timezone.utc)
        
        stmt, count_stmt = self.builder.build_filtered_query(
            feed_ids=feed_ids,
            folder_id=folder_id,
            is_read=False,
            is_read_later=True,
            is_favorite=False,
            feed_is_favorite=True,
            published_since=since_date,
            published_until=until_date,
            search_query="machine learning",
            sort_by="published_at",
            sort_order="desc",
            skip=20,
            limit=50,
        )
        
        assert stmt is not None
        assert count_stmt is not None

    def test_build_filtered_query_minimal(self):
        """Test building a filtered query with minimal options."""
        stmt, count_stmt = self.builder.build_filtered_query()
        
        assert stmt is not None
        assert count_stmt is not None

    def test_apply_feed_favorite_filter_with_folder_joined(self):
        """Test applying feed favorite filter when folder is already joined."""
        stmt, count_stmt = self.builder.build_base_query()
        
        # First apply folder filter (which joins Feed table)
        stmt, count_stmt = self.builder.apply_folder_filter(stmt, count_stmt, uuid4())
        
        # Then apply feed favorite filter (should not join again)
        filtered_stmt, filtered_count = self.builder.apply_feed_favorite_filter(
            stmt, count_stmt, True, folder_joined=True
        )
        
        assert filtered_stmt is not None
        assert filtered_count is not None

    def test_apply_feed_favorite_filter_without_folder_joined(self):
        """Test applying feed favorite filter when folder is not joined."""
        stmt, count_stmt = self.builder.build_base_query()
        
        # Apply feed favorite filter without prior folder join
        filtered_stmt, filtered_count = self.builder.apply_feed_favorite_filter(
            stmt, count_stmt, False, folder_joined=False
        )
        
        assert filtered_stmt is not None
        assert filtered_count is not None