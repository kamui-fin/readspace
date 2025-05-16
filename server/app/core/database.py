from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import declarative_base
from typing import AsyncGenerator
from app.core.config import get_settings

settings = get_settings()

# Convert postgresql:// to postgresql+asyncpg:// for async support
DATABASE_URL = settings.SUPABASE_DB_CONNECTION.replace("postgresql://", "postgresql+asyncpg://")
engine = create_async_engine(DATABASE_URL, echo=True)
async_session = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
Base = declarative_base()

async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with async_session() as session:
        yield session 