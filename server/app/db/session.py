from typing import AsyncGenerator

from app.core.config import get_settings
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

settings = get_settings()

# Create async engine with Supabase PostgreSQL URL
engine = create_async_engine(
    settings.SUPABASE_DB_CONNECTION.replace("postgresql://", "postgresql+asyncpg://"),
    echo=settings.ENVIRONMENT == "development",
    future=True,
    pool_pre_ping=True,
    pool_size=20,            # Increased from 5 to handle more concurrent connections
    max_overflow=30,         # Increased from 10 to allow more burst connections
    pool_recycle=1800,       # Reduced from 3600 to 30 minutes to prevent stale connections
    pool_timeout=30,         # Timeout for acquiring a connection from the pool
)

# Create async session factory
AsyncSessionLocal = sessionmaker(
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
