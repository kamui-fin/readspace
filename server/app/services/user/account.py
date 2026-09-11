"""Account deletion service."""

from uuid import UUID

import structlog
from supabase import AsyncClient
from supabase import acreate_client as create_async_client

from app.core.config import get_settings
from app.core.custom_exceptions import ExternalServiceError

logger = structlog.get_logger(__name__)


async def _get_async_admin_supabase() -> AsyncClient:
    """Get an Async Supabase client authenticated with the service role key."""
    settings = get_settings()
    return await create_async_client(str(settings.SUPABASE_URL), settings.SUPABASE_SERVICE_ROLE_KEY.get_secret_value())


async def delete_account(user_id: UUID) -> None:
    """
    Permanently delete a user's Supabase auth account.

    The `profiles` row (FK `ON DELETE CASCADE` to `auth.users`) and every table
    that in turn cascades from `profiles` — feed subscriptions, folders,
    articles, codex data — are removed automatically at the database level.
    """
    supabase = await _get_async_admin_supabase()
    try:
        await supabase.auth.admin.delete_user(str(user_id))
    except Exception as e:
        logger.error("Failed to delete user account", user_id=str(user_id), error=str(e))
        raise ExternalServiceError(message="Failed to delete account", error_code="ACCOUNT_DELETE_FAILED") from e

    logger.info("Deleted user account", user_id=str(user_id))
