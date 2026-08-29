import asyncio
import os
from logging.config import fileConfig

from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config

from alembic import context
from app.core.config import get_settings
from app.db.base_class import Base

# Import all models here to ensure they are registered with Base.metadata
# from app.models import ...

# this is the Alembic Config object, which provides
# access to the values within the .ini file in use.
config = context.config

# Interpret the config file for Python logging.
# This line sets up loggers basically.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# add your model's MetaData object here
# for 'autogenerate' support
target_metadata = [Base.metadata]


def get_url():
    """
    Retrieve the database URL from settings or environment variables.
    """
    settings = get_settings()

    # Use ALEMBIC_DB_URL if it exists, otherwise fall back to SUPABASE_DB_CONNECTION
    db_url = os.getenv("ALEMBIC_DB_URL")
    if not db_url:
        db_url = settings.DATABASE_URL_API

    return db_url


def include_object(obj, name, type_, reflected, compare_to):
    """
    Filter out Supabase-managed schemas to prevent Alembic from managing them.
    """
    # Ignore tables in specific schemas (Supabase internal schemas)
    if type_ == "table" and obj.schema in [
        "auth",
        "storage",
        "realtime",
        "extensions",
        "graphql",
        "vault",
    ]:
        return False

    return True


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode.

    This configures the context with just a URL
    and not an Engine, though an Engine is acceptable
    here as well.  By skipping the Engine creation
    we don't even need a DBAPI to be available.

    Calls to context.execute() here emit the given string to the
    script output.

    """
    # 1. Check if URL is injected via Config (e.g., from Pytest)
    url = config.get_main_option("sqlalchemy.url")

    # 2. Fallback to Environment/Settings
    if not url:
        url = get_url()

    context.configure(
        url=url,
        target_metadata=target_metadata,
        compare_type=True,
        compare_server_default=True,
        literal_binds=True,
        include_object=include_object,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        include_object=include_object,
        compare_type=True,
        compare_server_default=True,
    )
    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    """In this scenario we need to create an Engine
    and associate a connection with the context.

    """
    configuration = config.get_section(config.config_ini_section)

    # 1. CRITICAL: Check if URL is injected via Config (from Pytest fixture)
    # The fixture uses `alembic_cfg.set_main_option("sqlalchemy.url", ...)`
    url = config.get_main_option("sqlalchemy.url")

    # 2. Fallback to Environment/Settings if not injected
    if not url:
        url = get_url()

    # 3. Ensure we use the async driver (asyncpg)
    if not url.startswith("postgresql+asyncpg://") and url.startswith("postgresql://"):
        url = url.replace("postgresql://", "postgresql+asyncpg://")

    configuration["sqlalchemy.url"] = url

    connectable = async_engine_from_config(
        configuration,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)

    await connectable.dispose()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode."""
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
