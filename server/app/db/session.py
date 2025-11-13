from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import get_settings

settings = get_settings()


def _create_engine():
    """Create database engine with environment-aware configuration.

    Configuration adapts based on environment:
    - Local/Development: Session mode (5432), 10+10 pool, prepared statements enabled
    - Production: Transaction mode (6543), 10+20 pool, prepared statements disabled

    API uses larger pool than workers to handle bursty user traffic.
    """
    db_url = settings.SUPABASE_DB_CONNECTION
    if not db_url.startswith("postgresql+asyncpg://"):
        db_url = db_url.replace("postgresql://", "postgresql+asyncpg://")

    # Production always uses transaction mode, development uses session mode
    is_production = settings.is_production
    is_local = not settings.is_supabase_cloud

    # Environment-specific pool sizing
    if is_local:
        # Local development: Direct PostgreSQL connection
        # Moderate pool size for dev workloads
        pool_config = {
            "pool_size": 10,
            "max_overflow": 10,  # Total 20 connections
            "pool_recycle": 3600,  # 1 hour
            "pool_timeout": 30,  # More generous timeout for dev
        }
    else:
        # Supabase Cloud: Transaction mode with PgBouncer
        # Larger pool for API to handle concurrent user requests
        pool_config = {
            "pool_size": 10,
            "max_overflow": 20,  # Total 30 connections
            "pool_recycle": 1800,  # 30 minutes
            "pool_timeout": 30,  # Reasonable timeout for user-facing requests
        }

    # Base connection arguments
    connect_args = {
        "server_settings": {
            "application_name": f"readspace_api_{settings.ENVIRONMENT}",
            "statement_timeout": "60000",  # 60 second timeout for API queries
        }
    }

    # Disable prepared statements for production (required by PgBouncer transaction mode)
    if is_production:
        connect_args.update(
            {
                "statement_cache_size": 0,
                "prepared_statement_cache_size": 0,
            }
        )

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
