"""Common utilities for Taskiq workers."""

import uuid
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from typing import cast
from uuid import UUID

import structlog
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.pool import NullPool

from app.core.config import get_settings
import app.models  # noqa: F401

logger = structlog.get_logger(__name__)
settings = get_settings()


def ensure_uuid(value: UUID | str) -> UUID:
    """Convert string to UUID if needed for Taskiq serialization compatibility."""
    return UUID(value) if isinstance(value, str) else value


# Singleton instances for worker process
_worker_engine: AsyncEngine | None = None
_worker_session_maker: async_sessionmaker[AsyncSession] | None = None


def _get_worker_engine() -> tuple[AsyncEngine, async_sessionmaker[AsyncSession]]:
    """Initialize the worker database engine with NullPool.

    NullPool is critical for Supavisor in Transaction Mode (port 6543) because
    it forces the application to release the physical connection immediately
    after the transaction closes, allowing the pooler to multiplex efficiently.
    """
    global _worker_engine, _worker_session_maker

    if _worker_engine is None or _worker_session_maker is None:
        db_url = settings.DATABASE_URL_WORKER
        if not db_url.startswith("postgresql+asyncpg://"):
            db_url = db_url.replace("postgresql://", "postgresql+asyncpg://")

        # Disable prepared statements for Supavisor compatibility
        connect_args = {
            "statement_cache_size": 0,
            "prepared_statement_cache_size": 0,
            "prepared_statement_name_func": lambda: f"__asyncpg_{uuid.uuid4()}__",
        }

        _worker_engine = create_async_engine(
            db_url,
            poolclass=NullPool,
            echo=False,
            connect_args=connect_args,
        )

        _worker_session_maker = async_sessionmaker(
            _worker_engine,
            class_=AsyncSession,
            autoflush=False,
            expire_on_commit=False,
        )

        logger.info(
            "Initialized worker database engine",
            poolclass="NullPool",
            mode="transaction",
        )

    return _worker_engine, cast(async_sessionmaker[AsyncSession], _worker_session_maker)


@asynccontextmanager
async def worker_db() -> AsyncGenerator[AsyncSession, None]:
    """Surgical database session context manager.

    Pattern: Connect -> Begin -> Yield -> Commit -> Close
    """
    _, session_maker = _get_worker_engine()

    session = session_maker()
    try:
        async with session.begin():
            yield session
    except Exception:
        await session.rollback()
        raise
    finally:
        await session.close()


# Alias for compatibility with service signatures
worker_db_factory = worker_db
