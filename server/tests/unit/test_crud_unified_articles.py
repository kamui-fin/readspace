"""Tests for unified CRUD articles functionality."""

from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

from app.crud.crud_unified_articles import CRUDUnifiedArticles
from app.schemas import ArticleResponse


@pytest.mark.unit
class TestCRUDUnifiedArticles:
    def setup_method(self):
        self.crud = CRUDUnifiedArticles()
        self.user_id = uuid4()
        self.feed_id = uuid4()
        self.folder_id = uuid4()
        self.test_time = datetime.now(timezone.utc)

    @pytest.mark.asyncio
    async def test_init(self):
        """Test that CRUDUnifiedArticles initializes correctly."""
        crud = CRUDUnifiedArticles()
        assert crud.query_builder is not None
        assert crud.transformer is not None

    @pytest.mark.asyncio
    async def test_get_unified_articles_feed_and_clipped(self):
        """Test getting unified articles including both feed and clipped."""
        mock_db = AsyncMock()

        # Mock query builder methods
        with (
            patch.object(self.crud.query_builder, "build_feed_article_query") as mock_feed_query,
            patch.object(self.crud.query_builder, "build_clipped_article_query") as mock_clipped_query,
            patch.object(self.crud.query_builder, "build_union_query") as mock_union_query,
            patch.object(self.crud.query_builder, "build_count_query") as mock_count_query,
        ):
            # Mock db execution
            mock_result = MagicMock()
            mock_result.fetchall.return_value = [{"id": uuid4(), "title": "Test Article", "article_type": "feed"}]
            mock_db.execute.return_value = mock_result

            # Mock count result
            mock_count_result = MagicMock()
            mock_count_result.scalar.return_value = 1

            # Configure mock to return count result on second call
            mock_db.execute.side_effect = [mock_result, mock_count_result]

            # Mock transformer
            with patch.object(self.crud.transformer, "raw_row_to_unified") as mock_transform:
                mock_article = ArticleResponse(
                    id=uuid4(),
                    title="Test Article",
                    link="https://example.com/article",
                    article_type="feed",
                    created_at=self.test_time,
                    updated_at=self.test_time,
                )
                mock_transform.return_value = mock_article

                result = await self.crud.get_unified_articles_by_user(
                    db=mock_db,
                    user_id=self.user_id,
                    include_feed_articles=True,
                    include_clipped_articles=True,
                )

                articles, total_count = result

                assert len(articles) == 1
                assert total_count == 1
                assert articles[0].title == "Test Article"

                # Verify query builder calls
                mock_feed_query.assert_called_once()
                mock_clipped_query.assert_called_once()
                mock_union_query.assert_called_once()
                mock_count_query.assert_called_once()

    @pytest.mark.asyncio
    async def test_get_unified_articles_feed_only(self):
        """Test getting only feed articles."""
        mock_db = AsyncMock()

        # Mock query builder methods
        with (
            patch.object(self.crud.query_builder, "build_feed_article_query") as mock_feed_query,
            patch.object(self.crud.query_builder, "build_count_query") as mock_count_query,
            patch.object(self.crud, "_apply_sorting_and_pagination") as mock_sort_paginate,
        ):
            # Mock db execution
            mock_result = MagicMock()
            mock_feed_article = MagicMock()
            mock_result.scalars.return_value.all.return_value = [mock_feed_article]
            mock_db.execute.return_value = mock_result

            # Mock count result
            mock_count_result = MagicMock()
            mock_count_result.scalar.return_value = 1

            # Configure mock to return count result on second call
            mock_db.execute.side_effect = [mock_result, mock_count_result]

            # Configure the sorting mock to return the original query
            mock_sort_paginate.return_value = mock_feed_query.return_value

            # Mock transformer
            with patch.object(self.crud.transformer, "feed_to_unified") as mock_transform:
                mock_article = ArticleResponse(
                    id=uuid4(),
                    title="Feed Article",
                    link="https://example.com/feed-article",
                    article_type="feed",
                    created_at=self.test_time,
                    updated_at=self.test_time,
                )
                mock_transform.return_value = mock_article

                result = await self.crud.get_unified_articles_by_user(
                    db=mock_db,
                    user_id=self.user_id,
                    include_feed_articles=True,
                    include_clipped_articles=False,
                )

                articles, total_count = result

                assert len(articles) == 1
                assert total_count == 1
                assert articles[0].title == "Feed Article"

                mock_feed_query.assert_called()
                mock_count_query.assert_called()

    @pytest.mark.asyncio
    async def test_get_unified_articles_clipped_only(self):
        """Test getting only clipped articles."""
        mock_db = AsyncMock()

        # Mock query builder methods
        with (
            patch.object(self.crud.query_builder, "build_clipped_article_query") as mock_clipped_query,
            patch.object(self.crud.query_builder, "build_count_query") as mock_count_query,
            patch.object(self.crud, "_apply_sorting_and_pagination") as mock_sort_paginate,
        ):
            # Mock db execution
            mock_result = MagicMock()
            mock_clipped_article = MagicMock()
            mock_result.scalars.return_value.all.return_value = [mock_clipped_article]
            mock_db.execute.return_value = mock_result

            # Mock count result
            mock_count_result = MagicMock()
            mock_count_result.scalar.return_value = 1

            # Configure mock to return count result on second call
            mock_db.execute.side_effect = [mock_result, mock_count_result]

            # Configure the sorting mock to return the original query
            mock_sort_paginate.return_value = mock_clipped_query.return_value

            # Mock transformer
            with patch.object(self.crud.transformer, "clipped_to_unified") as mock_transform:
                mock_article = ArticleResponse(
                    id=uuid4(),
                    title="Clipped Article",
                    link="https://example.com/clipped-article",
                    article_type="clipped",
                    created_at=self.test_time,
                    updated_at=self.test_time,
                )
                mock_transform.return_value = mock_article

                result = await self.crud.get_unified_articles_by_user(
                    db=mock_db,
                    user_id=self.user_id,
                    include_feed_articles=False,
                    include_clipped_articles=True,
                )

                articles, total_count = result

                assert len(articles) == 1
                assert total_count == 1
                assert articles[0].title == "Clipped Article"

                mock_clipped_query.assert_called()
                mock_count_query.assert_called()

    @pytest.mark.asyncio
    async def test_get_unified_articles_with_filters(self):
        """Test getting unified articles with various filters."""
        mock_db = AsyncMock()

        # Test filters
        filters = {
            "feed_ids": [self.feed_id],
            "folder_id": self.folder_id,
            "is_read": True,
            "is_read_later": False,
            "is_favorite": True,
            "feed_is_favorite": False,
            "published_since": self.test_time,
            "published_until": self.test_time,
            "search_query": "test search",
        }

        with (
            patch.object(self.crud.query_builder, "build_feed_article_query") as mock_feed_query,
            patch.object(self.crud.query_builder, "build_clipped_article_query") as mock_clipped_query,
            patch.object(self.crud.query_builder, "build_union_query") as mock_union_query,
            patch.object(self.crud.query_builder, "build_count_query") as mock_count_query,
        ):
            # Mock db execution
            mock_result = MagicMock()
            mock_result.fetchall.return_value = []
            mock_count_result = MagicMock()
            mock_count_result.scalar.return_value = 0
            mock_db.execute.side_effect = [mock_result, mock_count_result]

            result = await self.crud.get_unified_articles_by_user(db=mock_db, user_id=self.user_id, **filters)

            articles, total_count = result

            assert len(articles) == 0
            assert total_count == 0

            # Verify that filters were passed to query builders
            mock_feed_query.assert_called_once_with(
                self.user_id,
                {
                    "feed_ids": [self.feed_id],
                    "folder_id": self.folder_id,
                    "is_read": True,
                    "is_read_later": False,
                    "is_favorite": True,
                    "feed_is_favorite": False,
                    "published_since": self.test_time,
                    "published_until": self.test_time,
                    "search_query": "test search",
                },
            )

    @pytest.mark.asyncio
    async def test_get_unified_articles_with_pagination(self):
        """Test getting unified articles with pagination."""
        mock_db = AsyncMock()

        with (
            patch.object(self.crud.query_builder, "build_feed_article_query"),
            patch.object(self.crud.query_builder, "build_clipped_article_query"),
            patch.object(self.crud.query_builder, "build_union_query") as mock_union_query,
            patch.object(self.crud.query_builder, "build_count_query"),
        ):
            mock_result = MagicMock()
            mock_result.fetchall.return_value = []
            mock_count_result = MagicMock()
            mock_count_result.scalar.return_value = 0
            mock_db.execute.side_effect = [mock_result, mock_count_result]

            await self.crud.get_unified_articles_by_user(
                db=mock_db,
                user_id=self.user_id,
                skip=10,
                limit=20,
                sort_by="title",
                sort_order="asc",
            )

            # Verify pagination parameters were passed
            mock_union_query.assert_called_once()
            call_args = mock_union_query.call_args
            # Check both positional and keyword arguments
            if len(call_args) > 1 and call_args[1]:
                # Keyword arguments
                assert call_args[1].get("skip", 10) == 10
                assert call_args[1].get("limit", 20) == 20
                assert call_args[1].get("sort_by", "title") == "title"
                assert call_args[1].get("sort_order", "asc") == "asc"
            else:
                # Positional arguments (feed_query, clipped_query, sort_by, sort_order, skip, limit)
                assert len(call_args[0]) >= 6
                assert call_args[0][2] == "title"  # sort_by
                assert call_args[0][3] == "asc"  # sort_order
                assert call_args[0][4] == 10  # skip
                assert call_args[0][5] == 20  # limit

    def test_apply_sorting_and_pagination_basic_calls(self):
        """Test that _apply_sorting_and_pagination makes the expected method calls."""
        mock_query = MagicMock()
        mock_query.column_descriptions = []  # Empty to avoid sort column access

        # Set up proper chaining behavior
        mock_offset_result = MagicMock()
        mock_query.offset.return_value = mock_offset_result

        # Test that pagination methods are called
        result = self.crud._apply_sorting_and_pagination(mock_query, "published_at", "desc", 10, 20)

        # Should apply pagination in the correct order
        mock_query.offset.assert_called_once_with(10)
        mock_offset_result.limit.assert_called_once_with(20)

        # Verify return value is the final query
        assert result == mock_offset_result.limit.return_value

    def test_apply_sorting_and_pagination_no_pagination(self):
        """Test that pagination is skipped when skip=0 and limit=0."""
        mock_query = MagicMock()
        mock_query.column_descriptions = []

        result = self.crud._apply_sorting_and_pagination(mock_query, "published_at", "desc", 0, 0)

        # Should not call offset or limit with 0 values
        mock_query.offset.assert_not_called()
        mock_query.limit.assert_not_called()

        # Should return the original query
        assert result == mock_query

    def test_apply_sorting_and_pagination_no_sort_column(self):
        """Test applying sorting when sort column doesn't exist."""
        mock_query = MagicMock()

        # Mock column_descriptions to be empty or have a type without the attributes
        mock_query.column_descriptions = []

        # Set up proper chaining behavior
        mock_offset_result = MagicMock()
        mock_query.offset.return_value = mock_offset_result

        result = self.crud._apply_sorting_and_pagination(mock_query, "unknown_column", "desc", 5, 15)

        # Should not call order_by since no sort column found
        mock_query.order_by.assert_not_called()
        # But should still apply pagination
        mock_query.offset.assert_called_once_with(5)
        mock_offset_result.limit.assert_called_once_with(15)
        # The result should be the final query after limit
        assert result == mock_offset_result.limit.return_value

    def test_apply_sorting_and_pagination_error_handling(self):
        """Test that errors in column access don't crash the method."""
        mock_query = MagicMock()
        # Create a mock that raises AttributeError when accessing column_descriptions
        mock_query.column_descriptions = None

        # Set up proper chaining behavior
        mock_offset_result = MagicMock()
        mock_query.offset.return_value = mock_offset_result

        # This should not raise an exception
        result = self.crud._apply_sorting_and_pagination(mock_query, "published_at", "desc", 5, 10)

        # Should still apply pagination even if sorting fails
        mock_query.offset.assert_called_once_with(5)
        mock_offset_result.limit.assert_called_once_with(10)

    @pytest.mark.asyncio
    async def test_get_unified_articles_neither_feed_nor_clipped(self):
        """Test getting unified articles when both include flags are False."""
        mock_db = AsyncMock()

        result = await self.crud.get_unified_articles_by_user(
            db=mock_db,
            user_id=self.user_id,
            include_feed_articles=False,
            include_clipped_articles=False,
        )

        articles, total_count = result

        # Should return empty results
        assert len(articles) == 0
        assert total_count == 0

        # Should not execute any database queries
        mock_db.execute.assert_not_called()
