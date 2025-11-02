"""
Tests for query safety and SQL injection prevention.

This module tests that our database queries are safe from SQL injection attacks
and use proper parameterization.
"""

from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Feed, FeedCategory
from app.services.feeds.search.feed_similarity import FeedSimilarityService
from app.services.feeds.search.search_engine import RssSearchService


@pytest.mark.asyncio
class TestQuerySafety:
    """Test suite for query safety and SQL injection prevention."""

    @pytest.fixture
    def mock_db(self):
        """Create a mock database session."""
        mock_session = AsyncMock(spec=AsyncSession)
        mock_result = MagicMock()
        mock_result.fetchall.return_value = []
        mock_result.mappings.return_value.all.return_value = []
        mock_result.scalars.return_value.all.return_value = []
        mock_session.execute = AsyncMock(return_value=mock_result)
        return mock_session

    @pytest.fixture
    def search_service(self, mock_db):
        """Create a search service instance with mocked DB."""
        return RssSearchService(mock_db)

    @pytest.fixture
    def similarity_service(self, mock_db):
        """Create a similarity service instance with mocked DB."""
        return FeedSimilarityService(mock_db, user_id=uuid4())

    async def test_hybrid_search_category_injection_attempt(self, search_service, mock_db):
        """Test that category parameter injection attempts are safely handled."""
        # Attempt SQL injection through category parameter
        malicious_category = "'; DROP TABLE feeds; --"

        # This should either fail validation or be safely parameterized
        with patch.object(search_service, "ai_service") as mock_ai:
            mock_ai.generate_embedding_with_gemini = AsyncMock(return_value=[0.1] * 768)

            # Should not raise exception and should not inject SQL
            await search_service._hybrid_search(query="test", language="en", limit=10, category=malicious_category)

            # Verify execute was called (query ran)
            assert mock_db.execute.called

            # Get the actual SQL that was executed
            call_args = mock_db.execute.call_args
            sql_text = str(call_args[0][0])

            # Verify that DROP TABLE is not in the executed SQL
            # (it should have been rejected by enum validation)
            assert "DROP TABLE" not in sql_text

    async def test_simple_search_category_injection_attempt(self, search_service, mock_db):
        """Test that simple search safely handles injection attempts in category."""
        malicious_category = "'; DROP TABLE feeds; --"

        # Should safely handle invalid category
        await search_service._simple_search(query="test", language="en", limit=10, category=malicious_category)

        # Verify execute was called
        assert mock_db.execute.called

        # Get the actual SQL that was executed
        call_args = mock_db.execute.call_args
        sql_text = str(call_args[0][0])

        # Verify that DROP TABLE is not in the executed SQL
        assert "DROP TABLE" not in sql_text

    async def test_hybrid_search_query_injection_attempt(self, search_service, mock_db):
        """Test that query parameter injection attempts are safely parameterized."""
        malicious_query = "'; DROP TABLE feeds; SELECT '"

        with patch.object(search_service, "ai_service") as mock_ai:
            mock_ai.generate_embedding_with_gemini = AsyncMock(return_value=[0.1] * 768)

            await search_service._hybrid_search(query=malicious_query, language="en", limit=10, category=None)

            # Verify the query was executed
            assert mock_db.execute.called

            # Get call arguments to verify parameterization
            call_args = mock_db.execute.call_args

            # Should have params dict as second argument
            assert len(call_args[0]) >= 2 or "params" in call_args[1]

            # Verify params contain the query (proving it's parameterized, not interpolated)
            if len(call_args[0]) >= 2:
                params = call_args[0][1]
                assert "query" in params
                assert params["query"] == malicious_query

    async def test_similarity_search_uses_parameterization(self, similarity_service, mock_db):
        """Test that similarity search uses proper parameterization."""
        # Create mock feed with embedding
        mock_feed = MagicMock(spec=Feed)
        mock_feed.id = uuid4()
        mock_feed.embedding = [0.1] * 768

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_feed
        mock_result.fetchall.return_value = []

        mock_db.execute = AsyncMock(return_value=mock_result)

        # Run similarity search
        await similarity_service.get_similar_feeds(feed_id=mock_feed.id, limit=10, min_similarity=0.1)

        # Verify execute was called at least twice (once for source feed, once for similar feeds)
        assert mock_db.execute.call_count >= 2

        # Check the similarity query (second call)
        similarity_call = mock_db.execute.call_args_list[-1]

        # Should have params dict
        assert len(similarity_call[0]) >= 2 or "params" in similarity_call[1]

        # Verify params contain required fields
        if len(similarity_call[0]) >= 2:
            params = similarity_call[0][1]
            assert "source_feed_id" in params
            assert "user_id" in params
            assert "limit" in params
            assert "min_similarity" in params

    async def test_valid_category_is_properly_filtered(self, search_service, mock_db):
        """Test that valid categories work correctly and are parameterized."""
        valid_category = FeedCategory.TECHNOLOGY_PROGRAMMING.value

        with patch.object(search_service, "ai_service") as mock_ai:
            mock_ai.generate_embedding_with_gemini = AsyncMock(return_value=[0.1] * 768)

            await search_service._hybrid_search(query="python", language="en", limit=10, category=valid_category)

            # Verify execute was called
            assert mock_db.execute.called

            # Get call arguments
            call_args = mock_db.execute.call_args

            # Verify params contain category
            if len(call_args[0]) >= 2:
                params = call_args[0][1]
                assert "category" in params
                assert params["category"] == valid_category

    async def test_embedding_parameterization(self, search_service, mock_db):
        """Test that embedding vectors are properly parameterized."""
        test_embedding = [0.1] * 768

        with patch.object(search_service, "ai_service") as mock_ai:
            mock_ai.generate_embedding_with_gemini = AsyncMock(return_value=test_embedding)

            await search_service._hybrid_search(query="test", language="en", limit=10, category=None)

            # Verify execute was called
            assert mock_db.execute.called

            # Get call arguments
            call_args = mock_db.execute.call_args

            # Verify params contain embedding
            if len(call_args[0]) >= 2:
                params = call_args[0][1]
                assert "embedding" in params
                # Embedding should be formatted as string representation
                assert params["embedding"].startswith("[")
                assert params["embedding"].endswith("]")

    async def test_language_parameterization(self, search_service, mock_db):
        """Test that language parameter is properly parameterized."""
        malicious_language = "'; DROP TABLE feeds; --"

        with patch.object(search_service, "ai_service") as mock_ai:
            mock_ai.generate_embedding_with_gemini = AsyncMock(return_value=[0.1] * 768)

            await search_service._hybrid_search(query="test", language=malicious_language, limit=10, category=None)

            # Verify execute was called
            assert mock_db.execute.called

            # Get call arguments
            call_args = mock_db.execute.call_args

            # Verify params contain language (proving it's parameterized)
            if len(call_args[0]) >= 2:
                params = call_args[0][1]
                assert "language" in params
                assert params["language"] == malicious_language
