"""Common utilities for Taskiq workers."""

import uuid
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from uuid import UUID

import structlog
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

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


# Module-level engine and session maker for workers
# These are created once and reused across all worker tasks
_worker_engine: AsyncEngine | None = None
_worker_session_maker: async_sessionmaker[AsyncSession] | None = None


def _get_worker_engine() -> tuple[AsyncEngine, async_sessionmaker[AsyncSession]]:
    """Get or create the worker database engine and session maker.
    
    This is called once per worker process and reused for all tasks.
    With NullPool, the engine doesn't hold connections - it just manages
    the connection configuration.
    """
    global _worker_engine, _worker_session_maker
    
    if _worker_engine is None or _worker_session_maker is None:
        # Use Transaction Mode connection string (port 6543)
        db_url = settings.DATABASE_URL_WORKER
        if not db_url.startswith("postgresql+asyncpg://"):
            db_url = db_url.replace("postgresql://", "postgresql+asyncpg://")

        # CRITICAL: Disable prepared statements for Supavisor
        # Transaction mode doesn't support prepared statements
        # See: https://github.com/supabase/supavisor/issues/287
        connect_args = {
            "statement_cache_size": 0,
            "prepared_statement_cache_size": 0,
            "prepared_statement_name_func": lambda: f"__asyncpg_{uuid.uuid4()}__",
        }

        # Create engine with NullPool
        # NullPool ensures no connection caching at SQLAlchemy level
        _worker_engine = create_async_engine(
            db_url,
            poolclass=NullPool,
            echo=False,
            connect_args=connect_args,
        )

        # Create session factory
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
            port="6543",
        )
    
    return _worker_engine, _worker_session_maker


@asynccontextmanager
async def worker_db() -> AsyncGenerator[AsyncSession, None]:
    """
    Surgical database session for Taskiq workers.
    
    CRITICAL: This implements the "open late, close early" pattern for workers.
    
    Pattern: Connect → Begin Transaction → Query → Commit → Close
    
    Why this works with Supavisor Transaction Mode + NullPool:
    1. Gets session from factory (NullPool creates fresh connection)
    2. Connects to Supavisor (uses 1 of 200 client slots)
    3. Begins transaction (Supavisor assigns 1 of 15 real DB connections)
    4. Yields session for queries (~50-500ms of actual DB work)
    5. Commits transaction (Supavisor returns real DB connection to pool)
    6. Closes session (NullPool closes connection, releases client slot)
    
    This means:
    - 10,000 concurrent tasks can share 5 real DB connections
    - Each task only holds a connection during actual DB operations
    - Network I/O (0-30s) happens WITHOUT holding any DB connection
    - No "max client connections" errors
    
    Usage in tasks:
        # Phase 1: Quick DB read
        async with worker_db() as db:
            feed_meta = await get_feed(db, feed_id)
        
        # Phase 2: Network I/O (no connection held)
        content = await fetch_feed(feed_meta.url)
        
        # Phase 3: Quick DB write
        async with worker_db() as db:
            await update_feed(db, feed_id, content)
    
    Supavisor Configuration:
    - Max client connections: 200 (API uses 10, workers share 190)
    - Pool size: 15 (API uses 10, workers share 5)
    - Mode: Transaction (port 6543)
    """
    # Get the shared engine and session maker
    _, session_maker = _get_worker_engine()

    # Create session (NullPool will create a fresh connection)
    session = session_maker()
    try:
        async with session.begin():
            # Transaction started - Supavisor assigns real DB connection
            yield session
            # Transaction commits automatically here - connection returned to Supavisor
    except Exception:
        await session.rollback()
        raise
    finally:
        # Close session - NullPool closes the connection immediately
        await session.close()

# Session factory for workers - same as worker_db but matches the factory pattern
worker_db_factory = worker_db