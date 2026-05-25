"""Public configuration and information router."""

import structlog
from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.core.config import Settings, get_settings

logger = structlog.get_logger(__name__)
router = APIRouter(tags=["Configuration"])


class ConfigResponse(BaseModel):
    supabase_url: str
    supabase_anon_key: str
    meilisearch_url: str
    meilisearch_search_key: str


async def get_meilisearch_search_key(settings: Settings) -> str:
    """Fetch the default search API key from Meilisearch."""
    client = None
    try:
        from meilisearch_python_sdk import AsyncClient

        client = AsyncClient(
            url=settings.MEILISEARCH_URL,
            api_key=settings.MEILISEARCH_MASTER_KEY.get_secret_value(),
        )
        keys = await client.get_keys()
        
        # 1. Look for the exact default search API key name
        for key_obj in keys.results:
            if key_obj.name == "Default Search API Key":
                return key_obj.key

        # 2. Fallback to any key with search actions or 'search' in name
        for key_obj in keys.results:
            if "search" in key_obj.actions or "search" in key_obj.name.lower():
                return key_obj.key
                
        # 3. Fallback to the first available key if any exist
        if keys.results:
            return keys.results[0].key
            
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
