"""Public configuration and information router."""

from collections.abc import Sequence

import structlog
from fastapi import APIRouter, Depends
from meilisearch_python_sdk.models.client import Key
from pydantic import BaseModel

from app.core.config import Settings, get_settings
from app.core.constants import MEILISEARCH_DEFAULT_SEARCH_KEY_NAME, MEILISEARCH_SEARCH_ACTION

logger = structlog.get_logger(__name__)
router = APIRouter(tags=["Configuration"])


class ConfigResponse(BaseModel):
    supabase_url: str
    supabase_anon_key: str
    meilisearch_url: str
    meilisearch_search_key: str


def select_public_search_key(keys: Sequence[Key]) -> str:
    """
    Pick a Meilisearch key that is safe to hand to anyone.

    Only keys whose sole permission is ``search`` qualify - never the admin key, and never a
    key that can also read documents, even if its name mentions search. The default search key
    wins when several qualify.

    Args:
        keys: All keys returned by Meilisearch.

    Returns:
        The key string, or an empty string when no search-only key exists.
    """
    search_only = [key_obj for key_obj in keys if key_obj.actions == [MEILISEARCH_SEARCH_ACTION]]

    for key_obj in search_only:
        if key_obj.name == MEILISEARCH_DEFAULT_SEARCH_KEY_NAME:
            return key_obj.key

    if search_only:
        return search_only[0].key

    return ""


async def get_meilisearch_search_key(settings: Settings) -> str:
    """Fetch a search-only API key from Meilisearch, or an empty string if none exists."""
    client = None
    try:
        from meilisearch_python_sdk import AsyncClient

        client = AsyncClient(
            url=settings.MEILISEARCH_URL,
            api_key=settings.MEILISEARCH_MASTER_KEY.get_secret_value(),
        )
        keys = await client.get_keys()

        search_key = select_public_search_key(keys.results)
        if not search_key:
            logger.warning("No search-only Meilisearch key found; /config will return an empty search key")
        return search_key

    except Exception as e:
        logger.warning("Failed to fetch search key from Meilisearch", error=str(e))
    finally:
        if client:
            await client.aclose()
    return ""


@router.get("/config", response_model=ConfigResponse, summary="Get client configuration for self-hosted instance")
async def get_client_config(
    settings: Settings = Depends(get_settings),
) -> ConfigResponse:
    """
    Exposes Supabase and Meilisearch connection settings required by client applications.
    This endpoint is public, allowing the mobile client to auto-configure prior to authentication.
    """
    search_key = await get_meilisearch_search_key(settings)

    return ConfigResponse(
        supabase_url=str(settings.SUPABASE_URL),
        supabase_anon_key=settings.SUPABASE_ANON_KEY,
        meilisearch_url=settings.MEILISEARCH_URL,
        meilisearch_search_key=search_key,
    )
