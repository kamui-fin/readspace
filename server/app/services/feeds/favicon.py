import asyncio
import base64
import binascii
import io
import uuid
from urllib.parse import quote, unquote_to_bytes, urljoin, urlparse

import structlog
from extract_favicon.main import from_html
from PIL import Image
from supabase import AsyncClient
from supabase import acreate_client as create_async_client

from app.core.config import get_settings
from app.core.constants import (
    FAVICON_CACHE_CONTROL_SECONDS,
    FAVICON_CONTENT_TYPE,
    FAVICON_MAX_INPUT_BYTES,
    FAVICONS_BUCKET_NAME,
)
from app.core.custom_exceptions import ValidationError
from app.services.feeds.favicon_image import is_generated_placeholder, normalize_favicon_to_png
from app.services.feeds.fetching import DownloadedResource, decode_resource, fetch_public_resource
from app.typing.feeds import FaviconResult
from app.utils.security import validate_url_security

logger = structlog.get_logger(__name__)

MAX_FAVICON_BYTES = FAVICON_MAX_INPUT_BYTES
MAX_FAVICON_PAGE_BYTES = 2 * 1024 * 1024
MAX_FAVICON_CANDIDATES = 8


async def _get_async_supabase() -> AsyncClient:
    """Get an Async Supabase client instance."""
    settings = get_settings()
    return await create_async_client(str(settings.SUPABASE_URL), settings.SUPABASE_SERVICE_ROLE_KEY.get_secret_value())


async def extract_favicon_and_canonical_url(
    feed_link: str,
    timeout: int = 10,
) -> FaviconResult:
    """Parse icon candidates locally; all page and image requests use the guarded downloader."""
    if not feed_link:
        return FaviconResult()

    try:
        await asyncio.wait_for(validate_url_security(feed_link, allow_rsshub=False), timeout=timeout)
        deadline = asyncio.get_running_loop().time() + timeout
        page = await fetch_public_resource(feed_link, timeout=timeout, max_bytes=MAX_FAVICON_PAGE_BYTES)
        result = FaviconResult()
        page_url = page["final_url"] if page else feed_link
        candidates: list[str] = []
        if page:
            if page_url != feed_link:
                result.canonical_link = page_url
            icons = from_html(decode_resource(page), root_url=page_url)
            candidates = [icon.url for icon in sorted(icons, key=lambda icon: (-icon.width * icon.height, icon.url))]
        candidates = candidates[:MAX_FAVICON_CANDIDATES]
        candidates.append(urljoin(page_url, "/favicon.ico"))
        host = urlparse(page_url).hostname
        if host:
            candidates.extend(
                [
                    f"https://icons.duckduckgo.com/ip3/{quote(host, safe='')}.ico",
                    f"https://www.google.com/s2/favicons?domain={quote(host, safe='')}&sz=256",
                ]
            )
        for candidate in dict.fromkeys(candidates):
            icon: DownloadedResource | None
            remaining = deadline - asyncio.get_running_loop().time()
            if remaining <= 0:
                break
            if candidate.startswith("data:image/"):
                # Inline icons never go through a network client, and are still size/format checked.
                if len(candidate) > MAX_FAVICON_BYTES * 4:
                    continue
                header, _, encoded = candidate.partition(",")
                try:
                    raw = unquote_to_bytes(encoded)
                    body = base64.b64decode(raw, validate=True) if header.endswith(";base64") else raw
                except (ValueError, binascii.Error):
                    continue
                icon = {"body": body, "final_url": candidate, "charset": None}
            else:
                icon = await fetch_public_resource(candidate, timeout=remaining, max_bytes=MAX_FAVICON_BYTES)
            if icon is None or is_generated_placeholder(icon["body"]):
                continue
            png = await asyncio.to_thread(normalize_favicon_to_png, icon["body"])
            if png is None:
                continue
            result.image_url = icon["final_url"]
            try:
                result.image_url = await put_favicon_png(await _get_async_supabase(), png)
            except Exception as e:
                logger.warning("Favicon storage failed; using validated image URL", error=str(e))
            return result
        return result
    except (ValidationError, asyncio.TimeoutError) as e:
        logger.warning("Favicon target blocked or timed out", feed_link=feed_link, error=str(e))
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
