import asyncio
import io
import uuid

import structlog
from extract_favicon.main_async import get_best_favicon
from PIL import Image
from supabase import AsyncClient
from supabase import acreate_client as create_async_client

from app.core.config import get_settings
from app.core.constants import FAVICON_CACHE_CONTROL_SECONDS, FAVICON_CONTENT_TYPE, FAVICONS_BUCKET_NAME
from app.services.feeds.favicon_image import is_generated_placeholder, normalize_favicon_to_png
from app.typing.feeds import FaviconResult

logger = structlog.get_logger(__name__)

# "generate" is deliberately excluded: it fabricates a grey letter-box SVG that carries no
# information, and clients render a better themed fallback when image_url is NULL.
FAVICON_STRATEGIES = ["content", "duckduckgo", "google"]


async def _get_async_supabase() -> AsyncClient:
    """Get an Async Supabase client instance."""
    settings = get_settings()
    return await create_async_client(str(settings.SUPABASE_URL), settings.SUPABASE_SERVICE_ROLE_KEY.get_secret_value())


async def extract_favicon_and_canonical_url(
    feed_link: str,
    timeout: int = 10,
) -> FaviconResult:
    """
    Extract favicon URL and canonical URL from feed link.
    Uses the improved logic from rss-r-us project (via extract_favicon lib).
    """
    if not feed_link:
        return FaviconResult()

    try:
        favicon = await get_best_favicon(url=feed_link, strategy=FAVICON_STRATEGIES)

        result = FaviconResult()

        if favicon:
            if favicon.url:
                result.image_url = favicon.url

            # Helper to get the canonical URL if redirected
            if hasattr(favicon, "http") and favicon.http and favicon.http.final_url:
                if favicon.http.final_url != feed_link:
                    result.canonical_link = favicon.http.final_url

            # Upload content to Supabase
            image_content = getattr(favicon, "image", None)

            if image_content:
                # If we have content, we should upload it to Supabase Storage
                # to avoid hotlinking and ensure persistence.
                storage_path = await upload_favicon_to_storage(feed_link, image_content, favicon.format)
                if storage_path:
                    # Store only the relative path (UUID.ext)
                    # The API and Meilisearch will resolve this to the full URL via Pydantic validators.
                    result.image_url = storage_path

        return result

    except ImportError:
        logger.error("extract_favicon library missing. Please install it.")
        return FaviconResult()
    except Exception as e:
        logger.warning("Favicon extraction failed", feed_link=feed_link, error=str(e))
        return FaviconResult()


async def put_favicon_png(supabase: AsyncClient, png: bytes) -> str:
    """
    Upload already-normalized PNG bytes under a fresh immutable key.

    Args:
        supabase: Async Supabase client authenticated with the service role key
        png: PNG bytes produced by normalize_favicon_to_png

    Returns:
        The relative storage path (``<uuid>.png``)
    """
    path = f"{uuid.uuid4()}.png"
    await supabase.storage.from_(FAVICONS_BUCKET_NAME).upload(
        path=path,
        file=png,
        file_options={
            "content-type": FAVICON_CONTENT_TYPE,
            "cache-control": str(FAVICON_CACHE_CONTROL_SECONDS),
        },
    )
    return path


async def upload_favicon_to_storage(feed_url: str, image_content: bytes | Image.Image, image_format: str) -> str | None:
    """
    Normalize a favicon to a bounded PNG and upload it to Supabase Storage.

    Every stored favicon is a PNG regardless of source format (SVG, ICO, JPEG, ...), so clients
    only ever need one decoder. Uses AsyncClient to avoid blocking the event loop.

    Args:
        feed_url: Feed link, used for logging
        image_content: Raw bytes, or a PIL image as produced by extract_favicon for raster formats
        image_format: Format reported by extract_favicon (informational; real format is sniffed)

    Returns:
        The relative storage path (``<uuid>.png``), or None if the favicon was unusable or the upload failed
    """
    try:
        if not isinstance(image_content, bytes):
            buf = io.BytesIO()
            image_content.save(buf, format="PNG")
            image_content = buf.getvalue()

        if is_generated_placeholder(image_content):
            logger.info("favicon_placeholder_skipped", feed_url=feed_url)
            return None

        png = await asyncio.to_thread(normalize_favicon_to_png, image_content)
        if png is None:
            logger.warning("favicon_unusable", feed_url=feed_url, source_format=image_format)
            return None

        supabase = await _get_async_supabase()
        path = await put_favicon_png(supabase, png)
        return path

    except Exception as e:
        logger.error(f"Failed to upload favicon to Supabase: {e}", feed_url=feed_url)
        return None
