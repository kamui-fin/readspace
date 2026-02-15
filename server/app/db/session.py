from collections.abc import AsyncGenerator, AsyncIterator
from contextlib import asynccontextmanager

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import get_settings

settings = get_settings()


def _create_engine():
    """Create database engine for API using Session Mode with AsyncAdaptedQueuePool.

    CRITICAL: Uses AsyncAdaptedQueuePool for long-lived API connections with Supavisor Session Mode.

    Why AsyncAdaptedQueuePool + Session Mode?
    - API is a long-lived, stationary server that benefits from persistent connections
    - Session Mode dedicates connections from Supavisor's pool to this client
    - AsyncAdaptedQueuePool maintains a small pool (10 connections) that are reused across requests
    - Each API request borrows a connection for ~50ms, then returns it to the pool

    Supavisor Configuration:
    - Max client connections: 200 (total connections Supavisor accepts)
    - Pool size: 15 (actual Postgres connections Supavisor maintains)
    - API reserves: 10 connections (leaving 5 for workers + other services)

    With AsyncAdaptedQueuePool + Session Mode:
    - API maintains 10 persistent connections to Supavisor
    - These 10 connections hold 10 of the 15 real DB connections
    - Can handle 1000s of concurrent requests by multiplexing over these 10 connections
    - Connections are reused (not created/destroyed per request)
    """
    db_url = settings.DATABASE_URL_API  # Session Mode (port 5432)
    if not db_url.startswith("postgresql+asyncpg://"):
        db_url = db_url.replace("postgresql://", "postgresql+asyncpg://")

    return create_async_engine(
        db_url,
        # AsyncAdaptedQueuePool is used automatically for async engines
        pool_size=10,  # Reserve 10 of 15 real DB connections for API
        max_overflow=5,  # Allow 5 extra connections during spikes
        pool_recycle=300,  # Recycle connections every 5 minutes
        pool_pre_ping=True,  # Verify connections before use
        echo=settings.is_development,  # SQL logging in development
        future=True,
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
            await session.close()


@asynccontextmanager
async def db_session_factory() -> AsyncIterator[AsyncSession]:
    """Session factory for use with services.

    This factory creates sessions on-demand and manages their lifecycle.
    Services can call this multiple times to get fresh sessions for different phases.
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def get_db_factory():
    """FastAPI dependency that provides a session factory.

    Use this for long-running operations where you want to control
    when database connections are acquired and released.

    Example:
        @router.post("/feeds/{feed_id}/refresh")
        async def refresh_feed(
            feed_id: UUID,
            db_factory = Depends(get_db_factory),
        ):
            service = FeedService()
            return await service.refresh_feed(db_factory, feed_id)
    """
    return db_session_factory
