import io
import uuid

import structlog
from extract_favicon.main_async import get_best_favicon
from supabase import AsyncClient
from supabase import acreate_client as create_async_client

from app.core.config import get_settings
from app.typing.feeds import FaviconResult

logger = structlog.get_logger(__name__)


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
        favicon = await get_best_favicon(url=feed_link)

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


async def upload_favicon_to_storage(feed_url: str, image_content: any, image_format: str) -> str | None:
    """
    Uploads favicon image content to Supabase Storage and returns the storage path (relative path).
    Uses AsyncClient to avoid blocking the event loop.
    """
    try:
        supabase = await _get_async_supabase()
        bucket_name = "favicons"

        # Convert PIL Image to bytes if necessary
        # Note: image_content.save() is blocking CPU work, but for small icons it's negligible.
        # If it were large images, run in executor.
        if not isinstance(image_content, bytes):
            buf = io.BytesIO()
            fmt = image_format or "PNG"
            try:
                image_content.save(buf, format=fmt)
                image_content = buf.getvalue()
            except Exception as e:
                logger.warning(f"Failed to convert PIL image to bytes: {e}")
                return None

        file_ext = (image_format or "png").lower()
        if file_ext == "svg+xml":
            file_ext = "svg"

        # Generate a unique path
        filename = f"{uuid.uuid4()}.{file_ext}"
        path = f"{filename}"

        # Upload using AsyncClient
        # Note: supabase-py async storage seems to use standard 'upload' method but on async client?
        # Actually checking docs/usage: await client.storage.from_().upload()

        await supabase.storage.from_(bucket_name).upload(
            path=path, file=image_content, file_options={"content-type": f"image/{file_ext}"}
        )

        return path

    except Exception as e:
        logger.error(f"Failed to upload favicon to Supabase: {e}", feed_url=feed_url)
        return None
