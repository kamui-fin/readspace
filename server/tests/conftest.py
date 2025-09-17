"""
Shared fixtures and test configuration
"""

import os
from unittest.mock import AsyncMock, Mock, patch

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user_models import Profile

# Set test environment variables immediately at module import
# This ensures they're available during test collection phase
os.environ.update(
    {
        "SUPABASE_URL": "http://localhost:54321",
        "SUPABASE_JWT_SECRET": "test-jwt-secret",
        "SUPABASE_SERVICE_ROLE_KEY": "test-service-role-key",
        "SUPABASE_DB_CONNECTION": "postgresql://postgres:postgres@localhost:54322/postgres",
        "REDIS_URL": "redis://localhost:6379/0",
        "CELERY_BROKER_URL": "redis://localhost:6379/0",
        "CELERY_RESULT_BACKEND": "redis://localhost:6379/1",
        "ENVIRONMENT": "test",
    }
)


@pytest.fixture(scope="session", autouse=True)
def test_settings():
    """Override settings for tests to provide default values."""
    test_env = {
        "SUPABASE_URL": "http://localhost:54321",
        "SUPABASE_JWT_SECRET": "test-jwt-secret",
        "SUPABASE_SERVICE_ROLE_KEY": "test-service-role-key",
        "SUPABASE_DB_CONNECTION": "postgresql://postgres:postgres@localhost:54322/postgres",
        "REDIS_URL": "redis://localhost:6379/0",
        "CELERY_BROKER_URL": "redis://localhost:6379/0",
        "CELERY_RESULT_BACKEND": "redis://localhost:6379/1",
        "ENVIRONMENT": "test",
    }

    with patch.dict(os.environ, test_env, clear=False):
        yield


@pytest.fixture(scope="function")
def test_user() -> Profile:
    """Create a test user profile."""
    return Profile(id="550e8400-e29b-41d4-a716-446655440000", email="test@example.com")


@pytest.fixture
def mock_redis():
    """Mock Redis for caching tests."""
    mock = Mock()
    mock.get = AsyncMock(return_value=None)
    mock.set = AsyncMock(return_value=True)
    mock.delete = AsyncMock(return_value=1)
    mock.exists = AsyncMock(return_value=False)
    return mock


@pytest.fixture
def mock_celery():
    """Mock Celery for background task tests."""
    mock = Mock()
    mock.delay = Mock(return_value=Mock(id="test-task-id"))
    mock.apply_async = Mock(return_value=Mock(id="test-task-id"))
    return mock


@pytest.fixture
def mock_supabase():
    """Mock Supabase client for auth tests."""
    mock = Mock()
    mock.auth = Mock()
    mock.storage = Mock()
    mock.table = Mock()
    return mock


@pytest.fixture
def mock_http_client():
    """Mock HTTP client for external API tests."""
    mock = AsyncMock()
    mock.get = AsyncMock()
    mock.post = AsyncMock()
    mock.put = AsyncMock()
    mock.delete = AsyncMock()
    return mock


async def create_test_user(
    session: AsyncSession, user_id: str = None, email: str = None
) -> Profile:
    """Create a test user with auth entry and profile."""
    import uuid

    from sqlalchemy import text

    if user_id is None:
        user_id = str(uuid.uuid4())
    if email is None:
        email = f"test-{uuid.uuid4().hex[:8]}@example.com"

    # Create auth user
    await session.execute(
        text(
            "INSERT INTO auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, invited_at, confirmation_token, confirmation_sent_at, recovery_token, recovery_sent_at, email_change_token_new, email_change, email_change_sent_at, last_sign_in_at, raw_app_meta_data, raw_user_meta_data, is_super_admin, created_at, updated_at, phone, phone_confirmed_at, phone_change, phone_change_token, phone_change_sent_at, email_change_token_current, email_change_confirm_status, banned_until, reauthentication_token, reauthentication_sent_at, is_sso_user, deleted_at, is_anonymous) VALUES (:user_id, 'authenticated', 'authenticated', :email, '', NOW(), NULL, '', NOW(), '', NOW(), '', '', NOW(), NOW(), '{}', '{}', FALSE, NOW(), NOW(), NULL, NULL, '', '', NOW(), '', 0, NULL, '', NOW(), FALSE, NULL, FALSE) ON CONFLICT (id) DO NOTHING"
        ),
        {"user_id": user_id, "email": email},
    )

    # Create profile using merge to avoid conflicts
    from datetime import datetime, timezone

    user = Profile(
        id=user_id,
        email=email,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    user = await session.merge(user)
    await session.flush()
    return user


async def create_test_book(session: AsyncSession, **kwargs):
    """Create a test book metadata."""
    import uuid
    from datetime import datetime, timezone

    from app.models.book_models import BookFormat, BookMetadata

    defaults = {
        "id": uuid.uuid4(),
        "title": "Test Book",
        "author": "Test Author",
        "description": "Test description",
        "cover_url": "https://example.com/cover.jpg",
        "file_url": "https://example.com/book.pdf",
        "format": BookFormat.PDF,
        "num_pages": 100,
        "file_size_bytes": 1024 * 1024,
        "created_at": datetime.now(timezone.utc),
    }
    defaults.update(kwargs)

    book = BookMetadata(**defaults)
    session.add(book)
    await session.flush()
    return book


async def create_test_user_book(session: AsyncSession, user: Profile, book, **kwargs):
    """Create a test user book library entry."""
    import uuid
    from datetime import datetime, timezone

    from app.models.book_models import UserBookLibrary

    defaults = {
        "id": uuid.uuid4(),
        "user_id": user.id,
        "book_metadata_id": book.id,
        "date_added": datetime.now(timezone.utc),
        "epub_progress": None,
        "pdf_current_page": 1,
    }
    defaults.update(kwargs)

    user_book = UserBookLibrary(**defaults)
    session.add(user_book)
    await session.flush()
    return user_book
