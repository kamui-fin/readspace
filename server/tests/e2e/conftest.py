"""Shared fixtures for e2e tests - True end-to-end with real services."""

import os
from collections.abc import AsyncGenerator
from pathlib import Path
from uuid import uuid4

import pytest
import pytest_asyncio
from fastapi.testclient import TestClient
from httpx import AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import NullPool

# Load .env file before importing app modules
try:
    from dotenv import load_dotenv

    # Load the .env file from server directory
    env_path = Path(__file__).parent.parent.parent / ".env"
    if env_path.exists():
        load_dotenv(env_path)
        print(f"✅ Loaded environment from {env_path}")
    else:
        print(f"⚠️  No .env file found at {env_path}")
except ImportError:
    print("⚠️  python-dotenv not installed, using system environment variables only")
    print("   Install with: pip install python-dotenv")

from app.core.config import get_settings
from app.db.session import get_db
from app.main import app
from app.models import Feed, Folder, Profile
from app.services.auth import get_current_user

# Get settings after loading .env
settings = get_settings()

# Use your .env database URL or fall back to test default
TEST_DATABASE_URL = os.getenv(
    "TEST_DATABASE_URL", settings.SUPABASE_DB_CONNECTION.replace("postgresql://", "postgresql+asyncpg://")
)

# Set test environment but preserve other settings from .env
os.environ["ENVIRONMENT"] = "test"

print(f"🔧 Using database: {TEST_DATABASE_URL}")
print(f"🔧 Using Redis: {settings.REDIS_URL}")
print(f"🔧 Environment: {settings.ENVIRONMENT}")


@pytest.fixture(scope="session")
def event_loop():
    """Create an instance of the default event loop for the test session."""
    import asyncio

    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture(scope="function")
async def db_engine():
    """Create a test database engine connected to real test database."""
    engine = create_async_engine(TEST_DATABASE_URL, poolclass=NullPool, echo=False)
    yield engine
    await engine.dispose()


@pytest_asyncio.fixture(scope="function")
async def db_session(db_engine) -> AsyncGenerator[AsyncSession, None]:
    """
    Create a test database session with transaction rollback.

    Uses real database with transaction isolation - changes are rolled back after each test.
    """
    async with db_engine.begin() as connection:
        async_session = sessionmaker(connection, class_=AsyncSession, expire_on_commit=False)
        async with async_session() as session:
            # Start a nested transaction
            await session.begin()
            yield session
            # Rollback the transaction to clean up
            await session.rollback()


@pytest_asyncio.fixture
async def test_user(db_session: AsyncSession) -> Profile:
    """
    Create a test user with auth entry in real database.

    Creates both auth.users entry and profile for full e2e testing.
    """
    user_id = str(uuid4())
    email = f"test-{uuid4().hex[:8]}@example.com"

    # Create auth user in real auth schema
    await db_session.execute(
        text(
            """
            INSERT INTO auth.users (
                id, aud, role, email, encrypted_password, 
                email_confirmed_at, confirmation_sent_at, 
                recovery_sent_at, created_at, updated_at,
                raw_app_meta_data, raw_user_meta_data,
                is_super_admin, is_sso_user, is_anonymous
            ) VALUES (
                :user_id, 'authenticated', 'authenticated', :email, '', 
                NOW(), NOW(), NOW(), NOW(), NOW(),
                '{}', '{}', FALSE, FALSE, FALSE
            ) ON CONFLICT (id) DO NOTHING
            """
        ),
        {"user_id": user_id, "email": email},
    )

    # Create profile
    user = Profile(id=user_id, email=email, role="user")
    db_session.add(user)
    await db_session.flush()
    await db_session.refresh(user)
    return user


@pytest_asyncio.fixture
async def admin_user(db_session: AsyncSession) -> Profile:
    """Create an admin test user in real database."""
    user_id = str(uuid4())
    email = f"admin-{uuid4().hex[:8]}@example.com"

    # Create auth user
    await db_session.execute(
        text(
            """
            INSERT INTO auth.users (
                id, aud, role, email, encrypted_password, 
                email_confirmed_at, confirmation_sent_at, 
                recovery_sent_at, created_at, updated_at,
                raw_app_meta_data, raw_user_meta_data,
                is_super_admin, is_sso_user, is_anonymous
            ) VALUES (
                :user_id, 'authenticated', 'authenticated', :email, '', 
                NOW(), NOW(), NOW(), NOW(), NOW(),
                '{}', '{}', FALSE, FALSE, FALSE
            ) ON CONFLICT (id) DO NOTHING
            """
        ),
        {"user_id": user_id, "email": email},
    )

    # Create admin profile
    user = Profile(id=user_id, email=email, role="admin")
    db_session.add(user)
    await db_session.flush()
    await db_session.refresh(user)
    return user


@pytest.fixture
def mock_current_user(test_user: Profile):
    """
    Override auth dependency for testing.

    Note: This is the ONLY mock in e2e tests - we mock auth to avoid JWT complexity,
    but all other services (Redis, Celery, Database, etc.) are real.
    """
    from app.schemas.auth import TokenData

    async def override_get_current_user():
        return TokenData(sub=str(test_user.id), email=test_user.email)

    return override_get_current_user


@pytest.fixture
def mock_admin_user(admin_user: Profile):
    """Override auth dependency with admin user."""
    from app.schemas.auth import TokenData

    async def override_get_current_user():
        return TokenData(sub=str(admin_user.id), email=admin_user.email)

    return override_get_current_user


@pytest.fixture
def client(db_session: AsyncSession, mock_current_user):
    """
    Create a test client for e2e testing.

    Uses real database session and only mocks authentication.
    All other services (Redis, Celery, external APIs) use real implementations.
    """

    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = mock_current_user

    with TestClient(app) as test_client:
        yield test_client

    app.dependency_overrides.clear()


@pytest.fixture
def admin_client(db_session: AsyncSession, mock_admin_user):
    """Create a test client with admin user."""

    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = mock_admin_user

    with TestClient(app) as test_client:
        yield test_client

    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def test_folder(db_session: AsyncSession, test_user: Profile) -> Folder:
    """Create a test folder in real database."""
    folder = Folder(id=uuid4(), user_id=test_user.id, name="Test Folder", description="Test description")
    db_session.add(folder)
    await db_session.flush()
    await db_session.refresh(folder)
    return folder


@pytest_asyncio.fixture
async def test_feed(db_session: AsyncSession) -> Feed:
    """Create a test feed in real database."""
    feed = Feed(
        id=uuid4(),
        url="https://example.com/feed.xml",
        title="Test Feed",
        description="Test feed description",
        link="https://example.com",
        language="en",
    )
    db_session.add(feed)
    await db_session.flush()
    await db_session.refresh(feed)
    return feed


@pytest_asyncio.fixture
async def http_client():
    """
    Provide a real HTTP client for testing external API calls.

    Use this for tests that need to make real HTTP requests.
    """
    async with AsyncClient() as client:
        yield client


# Helper functions for e2e tests


async def wait_for_celery_task(task_id: str, timeout: int = 30, poll_interval: float = 0.5):
    """
    Wait for a Celery task to complete (for real Celery testing).

    Args:
        task_id: Celery task ID
        timeout: Maximum time to wait in seconds
        poll_interval: Time between status checks in seconds

    Returns:
        Task result when complete

    Raises:
        TimeoutError: If task doesn't complete within timeout
    """
    import asyncio

    from celery.result import AsyncResult

    start_time = asyncio.get_event_loop().time()

    while True:
        task = AsyncResult(task_id)

        if task.ready():
            return task.result

        elapsed = asyncio.get_event_loop().time() - start_time
        if elapsed > timeout:
            raise TimeoutError(f"Task {task_id} did not complete within {timeout} seconds")

        await asyncio.sleep(poll_interval)


async def cleanup_redis_keys(pattern: str):
    """
    Clean up Redis keys matching pattern (for test cleanup).

    Args:
        pattern: Redis key pattern (e.g., "test:*")
    """
    from app.core.redis_cache import RedisCache

    cache = RedisCache()
    # Implementation depends on your Redis cache interface
    # This is a helper for tests that need to clean up Redis state
    pass
