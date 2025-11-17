"""
Shared fixtures and test configuration
"""

import os
from unittest.mock import AsyncMock, Mock, patch

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import Profile

# Set test environment variables immediately at module import
# This ensures they're available during test collection phase
os.environ.update(
    {
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
        "RABBITMQ_URL": "amqp://guest:guest@localhost:5672/",
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
def mock_taskiq():
    """Mock Taskiq for background task tests."""
    mock = Mock()
    mock.kiq = AsyncMock(return_value=Mock(task_id="test-task-id"))
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


@pytest.fixture
def mock_feed_fetch():
    """Mock feed fetching for discovery tests."""
    with patch("app.services.feeds.feed_creation.FeedCreationService._fetch_feed_content") as mock_fetch:
        # Mock successful feed fetch
        mock_fetch.return_value = {
            "status": 200,
            "content": """<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
    <channel>
        <title>Test Feed</title>
        <description>Test feed description</description>
        <link>https://example.com</link>
        <item>
            <title>Test Article 1</title>
            <description>Test article description</description>
            <link>https://example.com/article1</link>
            <pubDate>Mon, 01 Jan 2024 12:00:00 GMT</pubDate>
        </item>
        <item>
            <title>Test Article 2</title>
            <description>Another test article</description>
            <link>https://example.com/article2</link>
            <pubDate>Mon, 01 Jan 2024 13:00:00 GMT</pubDate>
        </item>
    </channel>
</rss>""",
        }
        yield mock_fetch


async def create_test_user(session: AsyncSession, user_id: str = None, email: str = None) -> Profile:
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
