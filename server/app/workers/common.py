"""Common utilities for Taskiq workers."""

import uuid
from collections.abc import AsyncGenerator
from uuid import UUID

import structlog
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import get_settings

logger = structlog.get_logger(__name__)
settings = get_settings()


def ensure_uuid(value: UUID | str) -> UUID:
    """Convert string to UUID if needed.

    Taskiq serialization may convert UUIDs to strings, so tasks need to convert them back.

    Args:
        value: UUID or string representation of UUID

    Returns:
        UUID object
    """
    return UUID(value) if isinstance(value, str) else value


# Module-level persistent database engine for Taskiq workers
_db_engine: AsyncEngine | None = None
_session_maker: async_sessionmaker[AsyncSession] | None = None


async def get_persistent_db_engine() -> tuple[AsyncEngine, async_sessionmaker[AsyncSession]]:
    """Get or create persistent database engine and session maker for Taskiq tasks.

    This maintains a connection pool that is reused across tasks, providing:
    - Fast connections (no setup/teardown overhead)
    - Better resource utilization
    - Automatic connection health checking with pool_pre_ping

    Configuration adapts based on environment:
    - Local/Development: Larger pool (5+5=10), session mode, prepared statements enabled
    - Production: Smaller pool (2+3=5), transaction mode, prepared statements disabled
    - Multiple workers scale horizontally (4 workers × 5 = 20 total in production)

    Returns:
        Tuple of (engine, session_maker)
    """
    global _db_engine, _session_maker

    if _db_engine is None or _session_maker is None:
        # Ensure we use asyncpg driver for async operations
        db_url = settings.SUPABASE_DB_CONNECTION
        if not db_url.startswith("postgresql+asyncpg://"):
            db_url = db_url.replace("postgresql://", "postgresql+asyncpg://")

        # Worker pool configuration for transaction mode with optimized I/O pattern
        #
        # AFTER refactoring refresh_feed() to separate network I/O from DB transactions:
        # - DB connections are only held during quick queries (~500ms vs 30s before)
        # - With 200 concurrent async tasks, effective pool utilization is much higher
        # - Each connection can serve multiple tasks per second (not held during HTTP fetches)
        #
        # Resource budget on Supabase Cloud (200 total connections, 15 pooled):
        # - API: 30 connections (user-facing, low latency priority)
        # - Worker: 100 connections (background, can tolerate brief queueing)
        # - Reserve: 70 connections (headroom for spikes + other services)
        #
        # Calculation:
        # - 200 async tasks × 500ms avg DB time = 100 queries/second
        # - 100 connections × 1000ms / 500ms = 200 queries/second capacity
        # - 2x headroom factor provides comfortable safety margin
        pool_config = {
            "pool_size": 50,  # Up from 20 (base capacity for concurrent queries)
            "max_overflow": 50,  # Up from 30 (total: 100 connections per worker)
            "pool_recycle": 1800,  # 30 minutes - prevent stale connections
            "pool_timeout": 120,  # Up from 60s (2 minute tolerance during high load)
        }

        # Connection arguments for PgBouncer transaction mode
        connect_args = {
            "statement_cache_size": 0,
            "prepared_statement_cache_size": 0,
            "prepared_statement_name_func": lambda: f"__asyncpg_{uuid.uuid4()}__",
        }

        _db_engine = create_async_engine(
            db_url,
            **pool_config,
            pool_pre_ping=True,  # Health check connections before use
            echo=False,
            connect_args=connect_args,
        )
        _session_maker = async_sessionmaker(
            _db_engine,
            class_=AsyncSession,
            autoflush=False,
            expire_on_commit=False,
        )
        logger.info(
            "Initialized persistent DB engine for Taskiq worker",
            environment=settings.ENVIRONMENT,
            is_supabase_cloud=settings.is_supabase_cloud,
            is_production=settings.is_production,
            statement_cache_disabled=True,
            prepared_statement_cache_disabled=True,
            **pool_config,
        )

    return _db_engine, _session_maker


async def get_worker_db_session() -> AsyncSession:
    """Get database session for Taskiq worker tasks with connection pooling.

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
    """Get database session for Taskiq worker tasks with automatic transaction management.

    This provides auto-commit/rollback behavior, ensuring consistent transaction handling
    across the application.

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


async def log_pool_stats() -> dict[str, int]:
    """Log connection pool statistics for monitoring and debugging.

    Returns detailed metrics about the database connection pool including:
    - Total pool size (base connections)
    - Checked in connections (available)
    - Checked out connections (in use)
    - Overflow connections (beyond base pool)
    - Connection utilization percentage

    Returns:
        Dictionary with pool statistics
    """
    engine, _ = await get_persistent_db_engine()
    pool = engine.pool

    # Get pool statistics
    pool_size = pool.size()
    checked_in = pool.checkedin()
    checked_out = pool.checkedout()
    overflow = pool.overflow()
    total_connections = pool_size + overflow

    # Calculate utilization percentage
    utilization_pct = round((checked_out / total_connections * 100), 1) if total_connections > 0 else 0

    stats = {
        "pool_size": pool_size,
        "checked_in": checked_in,
        "checked_out": checked_out,
        "overflow": overflow,
        "total_connections": total_connections,
        "utilization_percent": utilization_pct,
    }

    logger.info(
        "Database connection pool statistics",
        **stats,
        status="healthy" if utilization_pct < 80 else "warning" if utilization_pct < 95 else "critical",
    )

    return stats
