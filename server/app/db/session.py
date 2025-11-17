import uuid
from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import get_settings

settings = get_settings()


def _create_engine():
    """Create database engine for transaction mode with PgBouncer.

    Always uses transaction mode (port 6543) with:
    - Prepared statements disabled (required for PgBouncer transaction mode)
    - Reserved pool size for API to ensure user-facing requests aren't starved
    - Pool recycling to prevent stale connections
    - Pre-ping to verify connection health

    Resource budget on Supabase Cloud (200 total connections, 15 pooled):
    - API: 30 connections (user-facing, low latency priority)
    - Worker: 100 connections (background, can tolerate queueing)
    - Reserve: 70 connections (headroom for spikes + other services)
    """
    db_url = settings.SUPABASE_DB_CONNECTION
    if not db_url.startswith("postgresql+asyncpg://"):
        db_url = db_url.replace("postgresql://", "postgresql+asyncpg://")

    # API pool configuration - reserved for user-facing requests
    # Sized to handle bursty traffic without interfering with background workers
    # With typical API response times <500ms, 30 connections can serve 60 req/s
    pool_config = {
        "pool_size": 15,  # Up from 10 (base capacity for API requests)
        "max_overflow": 15,  # Total: 30 connections reserved for API
        "pool_recycle": 1800,  # 30 minutes - prevent stale connections
        "pool_timeout": 30,  # Reasonable timeout for user-facing requests
    }

    # Connection arguments for PgBouncer transaction mode
    connect_args = {
        # CRITICAL: Disable prepared statements for PgBouncer transaction mode
        # Transaction mode doesn't support prepared statements
        # See: https://github.com/supabase/supavisor/issues/287
        "statement_cache_size": 0,
        "prepared_statement_cache_size": 0,
        "prepared_statement_name_func": lambda: f"__asyncpg_{uuid.uuid4()}__",
    }

    return create_async_engine(
        db_url,
        echo=settings.is_development,  # SQL logging in development
        future=True,
        pool_pre_ping=True,  # Verify connections before using
        **pool_config,
        connect_args=connect_args,
    )


# Create async engine with adaptive configuration
engine = _create_engine()

# Create async session factory
AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Get database session."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            # Explicit session cleanup to ensure connections are properly returned
            await session.close()
