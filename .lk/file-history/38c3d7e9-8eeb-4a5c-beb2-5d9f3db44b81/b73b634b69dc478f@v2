"""Common utilities for Celery workers."""

import asyncio

import structlog
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import get_settings

logger = structlog.get_logger(__name__)
settings = get_settings()

# Module-level persistent event loop and database engine for Celery workers
_event_loop: asyncio.AbstractEventLoop | None = None
_db_engine: AsyncEngine | None = None
_session_maker: async_sessionmaker[AsyncSession] | None = None


def get_task_event_loop() -> asyncio.AbstractEventLoop:
    """Get or create persistent event loop for Celery tasks.

    This reuses the same event loop across tasks to avoid overhead
    of creating/destroying event loops (1-5ms per task).
    """
    global _event_loop
    if _event_loop is None or _event_loop.is_closed():
        _event_loop = asyncio.new_event_loop()
        asyncio.set_event_loop(_event_loop)
        logger.info("Created persistent event loop for Celery worker")
    return _event_loop


async def get_persistent_db_engine() -> tuple[AsyncEngine, async_sessionmaker[AsyncSession]]:
    """Get or create persistent database engine and session maker for Celery tasks.

    This maintains a connection pool that is reused across tasks, providing:
    - 10x faster connections (no setup/teardown overhead)
    - Better resource utilization
    - Automatic connection health checking with pool_pre_ping

    Returns:
        Tuple of (engine, session_maker)
    """
    global _db_engine, _session_maker

    if _db_engine is None or _session_maker is None:
        _db_engine = create_async_engine(
            settings.SUPABASE_DB_CONNECTION,
            pool_size=5,
            max_overflow=10,
            pool_pre_ping=True,
            pool_recycle=3600,
            echo=False,
        )
        _session_maker = async_sessionmaker(
            _db_engine,
            class_=AsyncSession,
            autoflush=False,
            expire_on_commit=False,
        )
        logger.info("Initialized persistent DB engine for Celery worker", pool_size=5, max_overflow=10)

    return _db_engine, _session_maker
