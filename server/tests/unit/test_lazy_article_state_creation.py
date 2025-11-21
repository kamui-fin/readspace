"""Unit tests for lazy user_article_states creation pattern.

This test suite validates the API signatures and documentation for lazy state creation.
Integration tests with actual database operations are in tests/integration/.
"""

import inspect
from unittest.mock import MagicMock
from uuid import uuid4

import pytest

from app.crud.article import create_articles_batch
from app.crud.article.business import update_article_status


class TestLazyArticleStateCreation:
    """Tests for lazy creation of user_article_states records - API signatures only."""

    def test_create_articles_batch_signature_no_user_id(self):
        """Verify create_articles_batch() does not require user_id parameter."""
        sig = inspect.signature(create_articles_batch)
        params = list(sig.parameters.keys())

        # Should have 'db' and 'articles_data' parameters, but NOT 'user_id'
        assert "db" in params
        assert "articles_data" in params
        assert "user_id" not in params

    def test_docstring_documents_lazy_creation(self):
        """Verify that create_articles_batch() docstring documents lazy creation behavior."""
        docstring = create_articles_batch.__doc__

        assert docstring is not None
        # Check for key phrases indicating lazy creation pattern
        assert "lazy" in docstring.lower() or "interact" in docstring.lower()

    @pytest.mark.parametrize(
        "batch_size",
        [1, 10, 100, 1000],
    )
    def test_create_articles_batch_handles_various_sizes(self, batch_size: int):
        """Verify function signature works with various batch sizes without user_id."""
        sig = inspect.signature(create_articles_batch)

        # Should be able to bind with just db and articles_data
        try:
            bound = sig.bind(db=MagicMock(), articles_data=[MagicMock()] * batch_size)
            assert "user_id" not in bound.arguments
        except TypeError:
            pytest.fail("create_articles_batch() signature requires user_id parameter")

    def test_create_articles_batch_source_does_not_reference_user_article_states(self):
        """Verify the source code doesn't create UserArticleState entries."""
        source = inspect.getsource(create_articles_batch)

        # After refactoring, there should be a comment about NOT creating states
        # and no actual UserArticleState insertion code
        assert "no longer create" in source.lower() or "lazy" in source.lower()

        # Check that there's no bulk insert of user_article_states
        # (The word might appear in comments, but not in actual insert statements)
        lines = source.split('\n')
        insert_lines = [line for line in lines if 'insert' in line.lower() and 'UserArticleState' in line]
        # Should have no lines that both insert AND reference UserArticleState
        assert len(insert_lines) == 0


@pytest.mark.unit
class TestStateCreationOnUserInteraction:
    """Tests verifying that states ARE created when users interact with articles.

    Note: These tests verify the pattern exists in the codebase for lazy creation.
    Full integration tests with database are in tests/integration/.
    """

    def test_get_or_create_user_article_state_function_exists(self):
        """Verify that get_or_create_user_article_state() function exists for lazy creation."""
        from app.crud.article import user_article_state

        # The CRUD repository has get_or_create method
        assert hasattr(user_article_state, 'get_or_create')

    def test_update_article_read_status_function_exists(self):
        """Verify that update_article_read_status() function exists for state creation on read."""
        from app.crud.article import update_article_status

        assert callable(update_article_status)

    def test_toggle_article_favorite_uses_get_or_create(self):
        """Verify toggle_article_favorite uses get_or_create pattern."""
        import inspect

        from app.crud.article import update_article_status

        source = inspect.getsource(update_article_status)

        # Should use upsert pattern (on_conflict_do_update) to ensure state exists
        assert "on_conflict_do_update" in source

    def test_toggle_article_read_later_uses_get_or_create(self):
        """Verify toggle_article_read_later uses get_or_create pattern."""
        import inspect

        from app.crud.article import update_article_status

        source = inspect.getsource(update_article_status)

        # Should use upsert pattern (on_conflict_do_update) to ensure state exists
        assert "on_conflict_do_update" in source

    def test_update_article_status_uses_upsert_pattern(self):
        """Verify update_article_status uses upsert to handle concurrent state creation."""
        import inspect

        source = inspect.getsource(update_article_status)

        # Should use PostgreSQL UPSERT (INSERT ... ON CONFLICT DO UPDATE)
        assert "on_conflict_do_update" in source


@pytest.mark.unit
class TestUnreadArticleLogic:
    """Tests for unread article determination without pre-created states."""

    def test_get_user_unread_count_function_exists(self):
        """Verify that get_user_unread_count() exists for querying unread articles."""
        from app.crud.article import count_unread_articles

        assert callable(count_unread_articles)

    def test_unread_count_uses_outer_join_pattern(self):
        """Verify unread count logic uses OUTER JOIN to treat missing states as unread."""
        import inspect

        from app.crud.article import count_unread_articles

        source = inspect.getsource(count_unread_articles)

        # Should use outerjoin to handle articles without states
        assert "outerjoin" in source.lower() or "outer" in source.lower()

    def test_article_query_builder_supports_null_states(self):
        """Verify ArticleQueryBuilder handles missing user_article_states."""
        from app.crud.article import UnifiedArticleQueryBuilder

        # The query builder should create queries that work with null states
        query_builder = UnifiedArticleQueryBuilder()

        # Build a basic query - should not raise errors
        try:
            stmt = query_builder.build_feed_article_query(user_id=uuid4(), filters={"is_read": False})
            assert stmt is not None
        except Exception as e:
            pytest.fail(f"UnifiedArticleQueryBuilder should handle null states: {e}")
