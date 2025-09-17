"""Tests for user article state CRUD operations."""

from datetime import datetime, timezone
from unittest.mock import AsyncMock, Mock, patch
from uuid import uuid4

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud.crud_user_article_state import (
    create_user_article_state,
    get_user_article_state,
    get_user_unread_count,
    mark_article_read,
    toggle_article_favorite,
    toggle_article_read_later,
    update_user_article_state,
)
from app.models.rss_models import UserArticleState
from app.schemas.subscription_schemas import (
    UserArticleStateCreate,
    UserArticleStateUpdate,
)


@pytest.fixture
def mock_db():
    """Mock database session."""
    return Mock(spec=AsyncSession)


@pytest.fixture
def sample_user_article_state():
    """Sample user article state."""
    return Mock(
        id=uuid4(),
        user_id=uuid4(),
        article_id=uuid4(),
        is_read=False,
        read_at=None,
        is_read_later=False,
        is_favorite=False,
        user_note=None,
        user_tags=None,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )


class TestUserArticleStateCRUD:
    """Test cases for user article state CRUD operations."""

    @pytest.mark.asyncio
    async def test_get_user_article_state_found(
        self, mock_db, sample_user_article_state
    ):
        """Should return state when found."""
        user_id = sample_user_article_state.user_id
        article_id = sample_user_article_state.article_id

        # Mock database result
        mock_result = Mock()
        mock_result.scalars().first.return_value = sample_user_article_state
        mock_db.execute = AsyncMock(return_value=mock_result)

        result = await get_user_article_state(
            db=mock_db, user_id=user_id, article_id=article_id
        )

        assert result == sample_user_article_state
        mock_db.execute.assert_called_once()

    @pytest.mark.asyncio
    async def test_get_user_article_state_not_found(self, mock_db):
        """Should return None when state not found."""
        user_id = uuid4()
        article_id = uuid4()

        # Mock database result with no state
        mock_result = Mock()
        mock_result.scalars().first.return_value = None
        mock_db.execute = AsyncMock(return_value=mock_result)

        result = await get_user_article_state(
            db=mock_db, user_id=user_id, article_id=article_id
        )

        assert result is None

    @pytest.mark.asyncio
    async def test_create_user_article_state_without_read_flag(self, mock_db):
        """Should create state without setting read_at when not marked as read."""
        user_id = uuid4()
        article_id = uuid4()

        state_in = UserArticleStateCreate(
            user_id=user_id, article_id=article_id, is_read=False
        )

        mock_db.add = Mock()
        mock_db.commit = AsyncMock()
        mock_db.refresh = AsyncMock()

        await create_user_article_state(db=mock_db, state_in=state_in)

        mock_db.add.assert_called_once()
        mock_db.commit.assert_called_once()
        mock_db.refresh.assert_called_once()

    @pytest.mark.asyncio
    async def test_create_user_article_state_with_read_flag(self, mock_db):
        """Should create state and set read_at when marked as read."""
        user_id = uuid4()
        article_id = uuid4()

        state_in = UserArticleStateCreate(
            user_id=user_id, article_id=article_id, is_read=True
        )

        mock_db.add = Mock()
        mock_db.commit = AsyncMock()
        mock_db.refresh = AsyncMock()

        with patch("app.crud.crud_user_article_state.datetime") as mock_datetime:
            mock_datetime.now.return_value = datetime.now(timezone.utc)

            await create_user_article_state(db=mock_db, state_in=state_in)

            mock_db.add.assert_called_once()
            # Should have added read_at timestamp
            added_state = mock_db.add.call_args[0][0]
            assert hasattr(added_state, "read_at")

    @pytest.mark.asyncio
    async def test_update_user_article_state_mark_read(
        self, mock_db, sample_user_article_state
    ):
        """Should set read_at when marking article as read."""
        sample_user_article_state.is_read = False
        sample_user_article_state.read_at = None

        state_update = UserArticleStateUpdate(is_read=True)

        mock_db.add = Mock()
        mock_db.commit = AsyncMock()
        mock_db.refresh = AsyncMock()

        with patch("app.crud.crud_user_article_state.datetime") as mock_datetime:
            mock_now = datetime.now(timezone.utc)
            mock_datetime.now.return_value = mock_now
            mock_datetime.timezone = timezone

            result = await update_user_article_state(
                db=mock_db, state_db=sample_user_article_state, state_in=state_update
            )

            assert result == sample_user_article_state
            assert sample_user_article_state.is_read is True
            assert sample_user_article_state.read_at == mock_now

    @pytest.mark.asyncio
    async def test_update_user_article_state_mark_unread(
        self, mock_db, sample_user_article_state
    ):
        """Should clear read_at when marking article as unread."""
        sample_user_article_state.is_read = True
        sample_user_article_state.read_at = datetime.now(timezone.utc)

        state_update = UserArticleStateUpdate(is_read=False)

        mock_db.add = Mock()
        mock_db.commit = AsyncMock()
        mock_db.refresh = AsyncMock()

        result = await update_user_article_state(
            db=mock_db, state_db=sample_user_article_state, state_in=state_update
        )

        assert result == sample_user_article_state
        assert sample_user_article_state.is_read is False
        assert sample_user_article_state.read_at is None

    @pytest.mark.asyncio
    async def test_mark_article_read_existing_state(self, mock_db):
        """Should mark existing unread state as read."""
        user_id = uuid4()
        article_id = uuid4()

        existing_state = Mock()
        existing_state.is_read = False
        existing_state.read_at = None

        mock_result = Mock()
        mock_result.scalars().first.return_value = existing_state
        mock_db.execute = AsyncMock(return_value=mock_result)
        mock_db.add = Mock()
        mock_db.commit = AsyncMock()
        mock_db.refresh = AsyncMock()

        with patch("app.crud.crud_user_article_state.datetime") as mock_datetime:
            mock_now = datetime.now(timezone.utc)
            mock_datetime.now.return_value = mock_now
            mock_datetime.timezone = timezone

            result = await mark_article_read(
                db=mock_db, user_id=user_id, article_id=article_id
            )

            assert existing_state.is_read is True
            assert existing_state.read_at == mock_now
            mock_db.add.assert_called_once_with(existing_state)

    @pytest.mark.asyncio
    async def test_mark_article_read_no_existing_state(self, mock_db):
        """Should create new state when marking non-existing state as read."""
        user_id = uuid4()
        article_id = uuid4()

        # No existing state
        mock_result = Mock()
        mock_result.scalars().first.return_value = None
        mock_db.execute = AsyncMock(return_value=mock_result)
        mock_db.add = Mock()
        mock_db.commit = AsyncMock()
        mock_db.refresh = AsyncMock()

        result = await mark_article_read(
            db=mock_db, user_id=user_id, article_id=article_id
        )

        # Should create new state
        mock_db.add.assert_called_once()
        added_state = mock_db.add.call_args[0][0]
        assert isinstance(added_state, UserArticleState)

    @pytest.mark.asyncio
    async def test_toggle_article_favorite(self, mock_db):
        """Should toggle favorite status."""
        user_id = uuid4()
        article_id = uuid4()

        existing_state = Mock()
        existing_state.is_favorite = False

        with patch(
            "app.crud.crud_user_article_state.get_or_create_user_article_state"
        ) as mock_get_create:
            mock_get_create.return_value = existing_state
            mock_db.add = Mock()
            mock_db.commit = AsyncMock()
            mock_db.refresh = AsyncMock()

            result = await toggle_article_favorite(
                db=mock_db, user_id=user_id, article_id=article_id
            )

            assert existing_state.is_favorite is True
            mock_db.add.assert_called_once_with(existing_state)

    @pytest.mark.asyncio
    async def test_toggle_article_read_later(self, mock_db):
        """Should toggle read later status."""
        user_id = uuid4()
        article_id = uuid4()

        existing_state = Mock()
        existing_state.is_read_later = False

        with patch(
            "app.crud.crud_user_article_state.get_or_create_user_article_state"
        ) as mock_get_create:
            mock_get_create.return_value = existing_state
            mock_db.add = Mock()
            mock_db.commit = AsyncMock()
            mock_db.refresh = AsyncMock()

            result = await toggle_article_read_later(
                db=mock_db, user_id=user_id, article_id=article_id
            )

            assert existing_state.is_read_later is True
            mock_db.add.assert_called_once_with(existing_state)

    @pytest.mark.asyncio
    async def test_get_user_unread_count(self, mock_db):
        """Should return count of unread articles."""
        user_id = uuid4()

        # Mock query result with article IDs
        mock_result = Mock()
        mock_result.scalars().all.return_value = [
            uuid4(),
            uuid4(),
            uuid4(),
        ]  # 3 articles
        mock_db.execute = AsyncMock(return_value=mock_result)

        result = await get_user_unread_count(db=mock_db, user_id=user_id)

        assert result == 3
        mock_db.execute.assert_called_once()

    @pytest.mark.asyncio
    async def test_get_user_unread_count_with_subscription_filter(self, mock_db):
        """Should return filtered count when subscription IDs provided."""
        user_id = uuid4()
        subscription_ids = [uuid4(), uuid4()]

        mock_result = Mock()
        mock_result.scalars().all.return_value = [uuid4()]  # 1 article
        mock_db.execute = AsyncMock(return_value=mock_result)

        result = await get_user_unread_count(
            db=mock_db, user_id=user_id, subscription_ids=subscription_ids
        )

        assert result == 1
        mock_db.execute.assert_called_once()
