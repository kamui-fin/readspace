"""Session factory abstraction for unified API and worker database access.

This module provides a clean abstraction for database session management that works
consistently across API endpoints and background workers.

Usage:
    # API mode (FastAPI dependency)
    from app.db.session import get_db_factory

    @router.post("/feeds")
    async def create_feed(
        feed_in: FeedCreate,
        db_factory: SessionFactory = Depends(get_db_factory),
    ):
        service = FeedService()
        return await service.create_feed(db_factory, feed_in)

    # Worker mode
    from app.workers.common import worker_db_factory

    async def refresh_feed_task(feed_id: UUID):
        service = FeedService()
        return await service.refresh_feed(worker_db_factory, feed_id)
"""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Protocol

from sqlalchemy.ext.asyncio import AsyncSession


class SessionFactory(Protocol):
    """Protocol for database session factories.

    This allows both API and worker contexts to provide session factories
    in a consistent way without tight coupling.
    """

    @asynccontextmanager
    async def __call__(self) -> AsyncIterator[AsyncSession]:
        """Create a new database session as a context manager.

        Yields:
            AsyncSession: Database session that will be automatically committed/rolled back
        """
        ...
