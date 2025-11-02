"""Tests for CRUD feed article operations."""

from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest
from sqlalchemy import select

from app.crud.crud_feed_article import CRUDFeedArticle, crud_feed_article
from app.models import FeedArticle


@pytest.mark.unit
class TestCRUDFeedArticle:
    def setup_method(self):
        self.crud = CRUDFeedArticle(FeedArticle)
        self.feed_id = uuid4()
        self.article_id = uuid4()
        self.guid = "test-guid-123"

    @pytest.mark.asyncio
    async def test_get_by_feed_and_guid_found(self):
        """Test getting feed article by feed ID and GUID when article exists."""
        mock_db = AsyncMock()
        mock_result = MagicMock()
        mock_article = MagicMock(spec=FeedArticle)
        mock_result.scalar_one_or_none.return_value = mock_article
        mock_db.execute.return_value = mock_result

        result = await self.crud.get_by_feed_and_guid(db=mock_db, feed_id=self.feed_id, guid=self.guid)

        assert result == mock_article
        mock_db.execute.assert_called_once()

        # Verify the query was constructed correctly
        call_args = mock_db.execute.call_args[0][0]
        assert isinstance(call_args, type(select(FeedArticle)))

    @pytest.mark.asyncio
    async def test_get_by_feed_and_guid_not_found(self):
        """Test getting feed article by feed ID and GUID when article doesn't exist."""
        mock_db = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        mock_db.execute.return_value = mock_result

        result = await self.crud.get_by_feed_and_guid(db=mock_db, feed_id=self.feed_id, guid=self.guid)

        assert result is None
        mock_db.execute.assert_called_once()

    @pytest.mark.asyncio
    async def test_get_with_content_found(self):
        """Test getting feed article with content and feed when article exists."""
        mock_db = AsyncMock()
        mock_result = MagicMock()
        mock_article = MagicMock(spec=FeedArticle)
        mock_result.scalar_one_or_none.return_value = mock_article
        mock_db.execute.return_value = mock_result

        result = await self.crud.get_with_content(db=mock_db, article_id=self.article_id)

        assert result == mock_article
        mock_db.execute.assert_called_once()

        # Verify the query was constructed correctly
        call_args = mock_db.execute.call_args[0][0]
        assert isinstance(call_args, type(select(FeedArticle)))

    @pytest.mark.asyncio
    async def test_get_with_content_not_found(self):
        """Test getting feed article with content when article doesn't exist."""
        mock_db = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        mock_db.execute.return_value = mock_result

        result = await self.crud.get_with_content(db=mock_db, article_id=self.article_id)

        assert result is None
        mock_db.execute.assert_called_once()

    def test_crud_feed_article_instance_creation(self):
        """Test that CRUDFeedArticle instance is created correctly."""
        crud_instance = CRUDFeedArticle(FeedArticle)
        assert crud_instance.model == FeedArticle

    def test_global_crud_feed_article_instance(self):
        """Test that the global crud_feed_article instance exists."""
        assert crud_feed_article is not None
        assert isinstance(crud_feed_article, CRUDFeedArticle)
        assert crud_feed_article.model == FeedArticle

    def test_crud_feed_article_inherits_from_crud_base(self):
        """Test that CRUDFeedArticle inherits from CRUDBase."""
        from app.crud.base import CRUDBase

        assert issubclass(CRUDFeedArticle, CRUDBase)

        # Verify generic type parameters
        crud_instance = CRUDFeedArticle(FeedArticle)
        assert hasattr(crud_instance, "model")
        assert crud_instance.model == FeedArticle

    @pytest.mark.asyncio
    async def test_query_construction_get_by_feed_and_guid(self):
        """Test that the query for get_by_feed_and_guid is constructed properly."""
        mock_db = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        mock_db.execute.return_value = mock_result

        await self.crud.get_by_feed_and_guid(db=mock_db, feed_id=self.feed_id, guid=self.guid)

        # Verify execute was called once
        mock_db.execute.assert_called_once()

        # Get the query that was executed
        query = mock_db.execute.call_args[0][0]
        query_str = str(query)

        # Check that the query contains expected elements
        assert "feed_articles" in query_str.lower() or "feedarticle" in query_str.lower()

    @pytest.mark.asyncio
    async def test_query_construction_get_with_content(self):
        """Test that the query for get_with_content is constructed properly."""
        mock_db = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        mock_db.execute.return_value = mock_result

        await self.crud.get_with_content(db=mock_db, article_id=self.article_id)

        # Verify execute was called once
        mock_db.execute.assert_called_once()

        # Get the query that was executed
        query = mock_db.execute.call_args[0][0]
        query_str = str(query)

        # Check that the query contains expected elements
        assert "feed_articles" in query_str.lower() or "feedarticle" in query_str.lower()
