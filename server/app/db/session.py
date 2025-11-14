from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import get_settings

settings = get_settings()


def _create_engine():
    """Create database engine for transaction mode with PgBouncer.

    Always uses transaction mode (port 6543) with:
    - Prepared statements disabled (required for PgBouncer transaction mode)
    - Moderate pool size (10+20) for API to handle concurrent user requests
    - Pool recycling to prevent stale connections
    - Pre-ping to verify connection health
    """
    db_url = settings.SUPABASE_DB_CONNECTION
    if not db_url.startswith("postgresql+asyncpg://"):
        db_url = db_url.replace("postgresql://", "postgresql+asyncpg://")

    # Unified pool configuration for transaction mode
    # API handles bursty user traffic, needs larger pool than workers
    pool_config = {
        "pool_size": 10,
        "max_overflow": 20,  # Total 30 connections
        "pool_recycle": 1800,  # 30 minutes - prevent stale connections
        "pool_timeout": 30,  # Reasonable timeout for user-facing requests
    }

    # Connection arguments for PgBouncer transaction mode
    connect_args = {
        "server_settings": {
            "application_name": f"readspace_api_{settings.ENVIRONMENT}",
            "statement_timeout": "60000",  # 60 second timeout for API queries
        },
        # CRITICAL: Disable prepared statements for PgBouncer transaction mode
        # Transaction mode doesn't support prepared statements
        "statement_cache_size": 0,
        "prepared_statement_cache_size": 0,
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
