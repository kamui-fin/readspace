"""Isolated integration-test fixtures with dedicated resources."""

from __future__ import annotations

import asyncio
import os
from contextlib import asynccontextmanager
from pathlib import Path
from typing import AsyncGenerator
from urllib.parse import urlparse, urlunparse
from uuid import uuid4

import pytest
import pytest_asyncio
from fastapi.testclient import TestClient
from httpx import ASGITransport, AsyncClient
from meilisearch_python_sdk import AsyncClient as MeiliClient
from redis.asyncio import Redis
from sqlalchemy import text
from sqlalchemy.engine.url import make_url
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, create_async_engine
from sqlalchemy.pool import NullPool
from taskiq import InMemoryBroker

from app.core.config import get_settings
from app.models.enums import UserRole
from app.models.feed import Feed
from app.models.folder import Folder
from app.models.user import Profile
from app.typing.user import TokenData

SERVER_ROOT = Path(__file__).resolve().parents[2]
MOCK_AUTH_SQL = SERVER_ROOT / "tests" / "mock_auth.sql"
ASYNC_CONNECT_ARGS = {
    "statement_cache_size": 0,
    "prepared_statement_cache_size": 0,
    "prepared_statement_name_func": lambda: f"__asyncpg_{uuid4()}__",
}
KEEP_TEST_DB_ENV = "PYTEST_KEEP_TEST_DB"
TEST_DB_CONFIG: dict[str, str] = {}

# Load environment before settings are instantiated
try:
    from dotenv import load_dotenv  # type: ignore

    env_path = SERVER_ROOT / ".env"
    if env_path.exists():
        load_dotenv(env_path)
except ImportError:
    pass


def _validate_identifier(value: str) -> str:
    candidate = value.replace("_", "")
    if not candidate.isalnum():
        raise ValueError(f"Invalid identifier: {value}")
    return value


def _redis_url_with_db(url: str, db_index: str) -> str:
    db_index = db_index.lstrip("/")
    if not db_index.isdigit():
        raise ValueError("Redis DB index must be numeric")
    parsed = urlparse(url)
    return urlunparse(parsed._replace(path=f"/{db_index}"))


def _load_auth_statements() -> list[str]:
    if not MOCK_AUTH_SQL.exists():
        raise FileNotFoundError(f"Missing mock auth schema: {MOCK_AUTH_SQL}")
    content = MOCK_AUTH_SQL.read_text(encoding="utf-8")
    return [stmt.strip() for stmt in content.split(";") if stmt.strip()]


async def _prepare_test_database(base_settings) -> dict[str, str]:
    try:
        from alembic import command
        from alembic.config import Config
    except ImportError as exc:
        raise ImportError(
            "alembic is required to prepare the isolated test database. "
            "Install server dependencies (e.g. `poetry install`)."
        ) from exc
    base_url = os.getenv("PYTEST_DB_BASE_URL", base_settings.DATABASE_URL_API)
    admin_db = _validate_identifier(os.getenv("PYTEST_DB_ADMIN", "postgres"))
    db_name = _validate_identifier(os.getenv("PYTEST_DB_NAME", "readspace_test"))

    url_obj = make_url(base_url)
    # Keep as URL objects, don't convert to string (which hides password)
    admin_async = url_obj.set(database=admin_db, drivername="postgresql+asyncpg")
    test_async = url_obj.set(database=db_name, drivername="postgresql+asyncpg")
    test_sync = url_obj.set(database=db_name, drivername="postgresql")

    admin_engine = create_async_engine(
        admin_async,
        isolation_level="AUTOCOMMIT",
        poolclass=NullPool,
        connect_args=ASYNC_CONNECT_ARGS,
    )

    drop_stmt = f"DROP DATABASE IF EXISTS {db_name}"
    create_stmt = f"CREATE DATABASE {db_name}"

    async with admin_engine.connect() as conn:
        await conn.execute(
            text(
                """
                SELECT pg_terminate_backend(pid)
                FROM pg_stat_activity
                WHERE datname = :db AND pid <> pg_backend_pid();
                """
            ),
            {"db": db_name},
        )
        await conn.execute(text(drop_stmt))
        await conn.execute(text(create_stmt))
    await admin_engine.dispose()

    bootstrap_engine = create_async_engine(
        test_async,
        poolclass=NullPool,
        connect_args=ASYNC_CONNECT_ARGS,
    )

    async with bootstrap_engine.begin() as conn:
        for statement in _load_auth_statements():
            await conn.execute(text(statement))

    alembic_cfg = Config(str(SERVER_ROOT / "alembic.ini"))
    alembic_cfg.set_main_option(
        "sqlalchemy.url", test_sync.render_as_string(hide_password=False)
    )
    alembic_cfg.set_main_option("script_location", str(SERVER_ROOT / "alembic"))
    await asyncio.to_thread(command.upgrade, alembic_cfg, "head")

    await bootstrap_engine.dispose()

    return {
        "name": db_name,
        "async_url": test_async.render_as_string(hide_password=False),
        "sync_url": test_sync.render_as_string(hide_password=False),
        "admin_async_url": admin_async.render_as_string(hide_password=False),
    }


async def _drop_test_database(config: dict[str, str]) -> None:
    admin_engine = create_async_engine(
        config["admin_async_url"],
        isolation_level="AUTOCOMMIT",
        poolclass=NullPool,
        connect_args=ASYNC_CONNECT_ARGS,
    )
    async with admin_engine.connect() as conn:
        await conn.execute(
            text(
                """
                SELECT pg_terminate_backend(pid)
                FROM pg_stat_activity
                WHERE datname = :db AND pid <> pg_backend_pid();
                """
            ),
            {"db": config["name"]},
        )
        await conn.execute(text(f"DROP DATABASE IF EXISTS {config['name']}"))
    await admin_engine.dispose()


def _configure_test_env(base_settings, config: dict[str, str]) -> None:
    test_sync_url = config["sync_url"]
    os.environ["DATABASE_URL_API"] = test_sync_url
    os.environ["DATABASE_URL_WORKER"] = test_sync_url
    os.environ["TEST_DATABASE_URL"] = config["async_url"]
    os.environ["ALEMBIC_DB_URL"] = test_sync_url
    os.environ.setdefault("ENVIRONMENT", "test")

    redis_base = os.getenv("PYTEST_REDIS_URL", base_settings.REDIS_URL)
    redis_db = os.getenv("PYTEST_REDIS_DB", "9")
    os.environ["REDIS_URL"] = _redis_url_with_db(redis_base, redis_db)

    os.environ.setdefault(
        "MEILISEARCH_INDEX_NAME", os.getenv("PYTEST_MEILI_INDEX", "test_feeds_pytest")
    )


def pytest_sessionstart(session):
    base_settings = get_settings()
    config = asyncio.run(_prepare_test_database(base_settings))
    _configure_test_env(base_settings, config)
    get_settings.cache_clear()
    get_settings()  # Re-initialize with overridden env
    TEST_DB_CONFIG.update(config)
    print(f"✅ Using isolated database '{config['name']}' for integration tests")


def pytest_sessionfinish(session, exitstatus):
    if not TEST_DB_CONFIG:
        return
    if os.getenv(KEEP_TEST_DB_ENV):
        print(
            f"⚠️ Keeping test database '{TEST_DB_CONFIG['name']}' per {KEEP_TEST_DB_ENV}"
        )
        return
    asyncio.run(_drop_test_database(TEST_DB_CONFIG))


@pytest_asyncio.fixture(scope="session")
async def db_engine() -> AsyncGenerator[AsyncEngine, None]:
    if not TEST_DB_CONFIG:
        base_settings = get_settings()
        config = await _prepare_test_database(base_settings)
        _configure_test_env(base_settings, config)
        get_settings.cache_clear()
        get_settings()  # Re-initialize with overridden env
        TEST_DB_CONFIG.update(config)
        print(f"✅ Using isolated database '{config['name']}' for integration tests")

    engine = create_async_engine(
        TEST_DB_CONFIG["async_url"],
        poolclass=NullPool,
        connect_args=ASYNC_CONNECT_ARGS,
    )
    try:
        yield engine
    finally:
        await engine.dispose()


@pytest_asyncio.fixture(scope="function")
async def db_session(
    db_engine: AsyncEngine, monkeypatch
) -> AsyncGenerator[AsyncSession, None]:
    connection = await db_engine.connect()
    transaction = await connection.begin()
    session = AsyncSession(bind=connection, expire_on_commit=False)

    @asynccontextmanager
    async def _worker_db():
        async with session.begin_nested():
            yield session

    patch_map = (
        ("app.workers.common.worker_db", _worker_db),
        ("app.workers.common.worker_db_factory", _worker_db),
        ("app.workers.opml.import_opml.worker_db_factory", _worker_db),
        ("app.workers.opml.import_feed.worker_db_factory", _worker_db),
        ("app.workers.feed.refresh.worker_db_factory", _worker_db),
        ("app.workers.feed.compaction.worker_db", _worker_db),
        ("app.workers.feed.enrichment.worker_db", _worker_db),
        ("app.workers.feed.favicon.worker_db_factory", _worker_db),
    )
    for target, replacement in patch_map:
        monkeypatch.setattr(target, replacement, raising=False)

    try:
        yield session
    finally:
        await session.close()
        await transaction.rollback()
        await connection.close()


@pytest_asyncio.fixture(scope="function")
async def test_user(db_session: AsyncSession) -> Profile:
    user_id = uuid4()
    email = f"test-{uuid4().hex[:8]}@example.com"
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
        {"user_id": str(user_id), "email": email},
    )
    await db_session.flush()
    profile = await db_session.get(Profile, user_id)
    if profile is None:
        profile = Profile(id=user_id, email=email, role=UserRole.BASIC)
        db_session.add(profile)
        await db_session.flush()
    await db_session.refresh(profile)
    return profile


@pytest_asyncio.fixture(scope="function")
async def admin_user(db_session: AsyncSession) -> Profile:
    user_id = uuid4()
    email = f"admin-{uuid4().hex[:8]}@example.com"
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
        {"user_id": str(user_id), "email": email},
    )
    await db_session.flush()
    profile = await db_session.get(Profile, user_id)
    if profile is None:
        profile = Profile(id=user_id, email=email, role=UserRole.ADMIN)
        db_session.add(profile)
    else:
        profile.role = UserRole.ADMIN
    await db_session.flush()
    await db_session.refresh(profile)
    return profile


@pytest.fixture
def mock_current_user(test_user: Profile, db_session: AsyncSession):
    async def override_get_current_user() -> TokenData:
        from app.models.user import Profile
        profile = await db_session.get(Profile, test_user.id)
        role_val = profile.role.value if profile else "BASIC"
        return TokenData(sub=str(test_user.id), email=test_user.email, role=role_val)

    return override_get_current_user


@pytest.fixture
def mock_admin_user(admin_user: Profile, db_session: AsyncSession):
    async def override_get_current_user() -> TokenData:
        from app.models.user import Profile
        profile = await db_session.get(Profile, admin_user.id)
        role_val = profile.role.value if profile else "ADMIN"
        return TokenData(sub=str(admin_user.id), email=admin_user.email, role=role_val)

    return override_get_current_user


def _override_dependencies(app, db_session: AsyncSession, user_override):
    from app.db.session import get_db, get_db_factory
    from app.services.user.auth import get_current_user

    async def override_get_db():
        yield db_session

    @asynccontextmanager
    async def session_factory():
        yield db_session

    async def override_get_db_factory():
        return session_factory

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_db_factory] = override_get_db_factory
    app.dependency_overrides[get_current_user] = user_override


@pytest.fixture
def client(db_session: AsyncSession, mock_current_user):
    from app.main import app

    _override_dependencies(app, db_session, mock_current_user)
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
def admin_client(db_session: AsyncSession, mock_admin_user):
    from app.main import app

    _override_dependencies(app, db_session, mock_admin_user)
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def async_client(db_session: AsyncSession, mock_current_user):
    from app.main import app

    _override_dependencies(app, db_session, mock_current_user)
    transport = ASGITransport(app=app)
    async with AsyncClient(
        transport=transport, base_url="http://testserver"
    ) as http_client:
        yield http_client
    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def async_admin_client(db_session: AsyncSession, mock_admin_user):
    from app.main import app

    _override_dependencies(app, db_session, mock_admin_user)
    transport = ASGITransport(app=app)
    async with AsyncClient(
        transport=transport, base_url="http://testserver"
    ) as http_client:
        yield http_client
    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def test_folder(db_session: AsyncSession, test_user: Profile) -> Folder:
    folder = Folder(id=uuid4(), user_id=test_user.id, name="Test Folder")
    db_session.add(folder)
    await db_session.flush()
    await db_session.refresh(folder)
    return folder


@pytest_asyncio.fixture
async def test_feed(db_session: AsyncSession) -> Feed:
    feed = Feed(
        id=uuid4(),
        url="https://hnrss.org/newest",
        title="Hacker News - Newest",
        description="Hacker News newest stories",
        link="https://news.ycombinator.com",
        language="en",
        tags=[],
        tags_native=[],
    )
    db_session.add(feed)
    await db_session.flush()
    await db_session.refresh(feed)
    return feed


@pytest_asyncio.fixture(scope="function")
async def redis_client() -> AsyncGenerator[Redis, None]:
    settings = get_settings()
    client = Redis.from_url(settings.REDIS_URL, encoding="utf-8", decode_responses=True)
    try:
        yield client
    finally:
        await client.close()


@pytest_asyncio.fixture(scope="function", autouse=True)
async def configure_redis_pool():
    """Configure Redis pool per test to avoid event loop issues."""
    from app.core import redis_cache

    # Reset the pool before each test
    redis_cache._pool = None

    yield

    # Clean up after test
    if redis_cache._pool:
        await redis_cache.close_pool()
    redis_cache._pool = None


@pytest_asyncio.fixture(autouse=True)
async def clean_redis(redis_client: Redis):
    await redis_client.flushdb()
    yield
    await redis_client.flushdb()


@pytest_asyncio.fixture(scope="function")
async def meili_client():
    settings = get_settings()
    client = MeiliClient(
        settings.MEILISEARCH_URL,
        settings.MEILISEARCH_MASTER_KEY.get_secret_value(),
    )
    try:
        await client.health()
    except Exception as exc:
        pytest.skip(f"Meilisearch unavailable: {exc}")
    yield client
    await client.aclose()


@pytest_asyncio.fixture
async def meili_test_index(meili_client, monkeypatch):
    settings = get_settings()
    base_name = settings.MEILISEARCH_INDEX_NAME
    index_name = f"{base_name}_{uuid4().hex[:8]}"
    try:
        await meili_client.delete_index(index_name)
    except Exception:
        pass
    await meili_client.create_index(index_name, primary_key="id")
    monkeypatch.setattr(settings, "MEILISEARCH_INDEX_NAME", index_name, raising=False)
    try:
        yield index_name
    finally:
        try:
            await meili_client.delete_index(index_name)
        except Exception:
            pass


@pytest.fixture(scope="session")
def taskiq_broker():
    from app.core.taskiq_app import broker

    if not isinstance(broker, InMemoryBroker):
        pytest.skip("Taskiq broker is not running in-memory; set ENVIRONMENT=test")
    return broker


@pytest_asyncio.fixture
async def http_client():
    async with AsyncClient() as client:
        yield client


async def wait_for_taskiq_task(
    task_id: str, timeout: int = 30, poll_interval: float = 0.5
):
    del task_id, timeout, poll_interval
    await asyncio.sleep(0.1)
    return None


async def cleanup_redis_keys(pattern: str):
    import redis.asyncio as redis
    from app.core.redis_cache import get_pool

    pool = get_pool()
    async with redis.Redis(connection_pool=pool) as client:
        keys = await client.keys(pattern)
        if keys:
            await client.delete(*keys)


@pytest.fixture(scope="function", autouse=True)
def mock_fetch_favicon_task(monkeypatch):
    """Globally mock fetch_favicon_task.kiq in integration tests to prevent unwanted bg network/db execution."""
    from app.workers.feed_tasks import fetch_favicon_task

    async def fake_kiq(*args, **kwargs):
        return None

    monkeypatch.setattr(fetch_favicon_task, "kiq", fake_kiq, raising=False)

