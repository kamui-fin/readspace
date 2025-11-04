"""Common utilities for Celery workers."""

import asyncio
from collections.abc import AsyncGenerator
from uuid import UUID

import structlog
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import get_settings

logger = structlog.get_logger(__name__)
settings = get_settings()


def ensure_uuid(value: UUID | str) -> UUID:
    """
    Convert string to UUID if needed.

    Celery serialization converts UUIDs to strings, so tasks need to convert them back.

    Args:
        value: UUID or string representation of UUID

    Returns:
        UUID object
    """
    return UUID(value) if isinstance(value, str) else value


# Module-level persistent event loop and database engine for Celery workers
_event_loop: asyncio.AbstractEventLoop | None = None
_db_engine: AsyncEngine | None = None
_session_maker: async_sessionmaker[AsyncSession] | None = None


def get_task_event_loop() -> asyncio.AbstractEventLoop:
    """Get or create persistent event loop for Celery tasks.

    This reuses the same event loop across tasks to avoid overhead
    of creating/destroying event loops (1-5ms per task).

    In test environments with an already running event loop (e.g., pytest-asyncio),
    this returns the running loop to avoid event loop conflicts.
    """
    global _event_loop

    # If there's already a running event loop (e.g., in tests), use it
    try:
        running_loop = asyncio.get_running_loop()
        return running_loop
    except RuntimeError:
        # No running loop, create/reuse persistent loop
        pass

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


async def get_worker_db_session() -> AsyncSession:
    """
    Get database session for Celery worker tasks with connection pooling.

    Returns a session from the persistent connection pool. Callers are responsible
    for committing or rolling back transactions and closing the session.

    For automatic transaction management, use the context manager pattern:
        async with get_worker_db_session() as db:
            # Your code here
            await db.commit()

    Returns:
        Database session from the persistent connection pool
    """
    _, session_maker = await get_persistent_db_engine()
    return session_maker()


async def get_worker_db() -> AsyncGenerator[AsyncSession, None]:
    """
    Get database session for Celery worker tasks with automatic transaction management.

    This provides the same auto-commit/rollback behavior as the FastAPI get_db() dependency,
    ensuring consistent transaction handling across the application.

    Yields:
        Database session that automatically commits on success or rolls back on exception
    """
    session = await get_worker_db_session()
    try:
        yield session
        await session.commit()
    except Exception:
        await session.rollback()
        raise
    finally:
        await session.close()
