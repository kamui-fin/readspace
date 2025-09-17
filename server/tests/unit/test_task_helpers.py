from unittest.mock import MagicMock, patch

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.workers.tasks import create_task_db_session


@pytest.mark.asyncio
async def test_create_task_db_session():
    """Test that create_task_db_session creates proper database session."""

    with (
        patch("app.workers.tasks.create_async_engine") as mock_create_engine,
        patch("app.workers.tasks.sessionmaker") as mock_sessionmaker,
        patch("app.workers.tasks.settings") as mock_settings,
    ):
        # Setup mocks
        mock_engine = MagicMock()
        mock_create_engine.return_value = mock_engine

        mock_session_class = MagicMock()
        mock_sessionmaker.return_value = mock_session_class

        mock_settings.SUPABASE_DB_CONNECTION = "postgresql+asyncpg://user:pass@host/db"

        # Execute
        engine, session_local = await create_task_db_session()

        # Verify
        mock_create_engine.assert_called_once()
        create_engine_call = mock_create_engine.call_args
        assert create_engine_call[0][0] == "postgresql+asyncpg://user:pass@host/db"

        mock_sessionmaker.assert_called_once()
        sessionmaker_call = mock_sessionmaker.call_args
        assert sessionmaker_call[1]["bind"] == mock_engine
        assert sessionmaker_call[1]["class_"] == AsyncSession
        assert sessionmaker_call[1]["autocommit"] is False
        assert sessionmaker_call[1]["autoflush"] is False
        assert sessionmaker_call[1]["expire_on_commit"] is False

        assert engine == mock_engine
        assert session_local == mock_session_class
