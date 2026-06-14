import pytest
from aiohttp import web
from app.services.feeds.favicon import extract_favicon_and_canonical_url
from app.services.feeds.favicon import _get_async_supabase
import structlog
import httpx # for verifying download

logger = structlog.get_logger(__name__)

# Minimal 1x1 PNG image
MINIMAL_PNG = b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82'

import pytest_asyncio

@pytest_asyncio.fixture
async def favicon_server():
    """Start a local web server serving a favicon."""
    
    async def handle_index(request):
        # Serve an HTML page that points to /favicon.ico
        html = """
        <!DOCTYPE html>
        <html>
        <head>
            <link rel="icon" href="/favicon.ico" type="image/png" />
        </head>
        <body>
            <h1>Test Page</h1>
        </body>
        </html>
        """
        return web.Response(text=html, content_type='text/html')

    async def handle_favicon(request):
        return web.Response(body=MINIMAL_PNG, content_type='image/png')

    app = web.Application()
    app.router.add_get('/', handle_index)
    app.router.add_get('/favicon.ico', handle_favicon)

    runner = web.AppRunner(app)
    await runner.setup()
    site = web.TCPSite(runner, '127.0.0.1', 0)
    await site.start()
    
    # Get the assigned port
    # accessing _server is internal but standard way to get port from TCPSite if needed,
    # or just use sock logic
    # Actually site.name is set? No.
    # We can get port from sockets.
    
    # TCPSite doesn't expose port easily if 0 is used unless checking sockets.
    # Let's bind to a random free port by binding socket first or check runner.
    # Actually, simpler: just iterate sockets.
    
    port = site._server.sockets[0].getsockname()[1]
    base_url = f"http://127.0.0.1:{port}"
    
    yield base_url
    
    await runner.cleanup()

@pytest.mark.asyncio
async def test_extract_and_upload_favicon_real(favicon_server):
    """
    Real integration test:
    1. Spin up local server with favicon.
    2. Extract favicon using real library.
    3. Upload to real Supabase Storage (local/test instance).
    4. Verify public URL and content.
    """
    # 1. Setup: Ensure bucket exists (using real client)
    supabase = await _get_async_supabase()
    bucket_name = "favicons"
    try:
        # Try to retrieve bucket to see if it exists
        await supabase.storage.get_bucket(bucket_name)
    except Exception:
        # If accessing bucket fails, try creating it
        # Note: Supabase-py throws exceptions on API errors.
        # This catch-all is a bit broad but safe for test setup.
        try:
            await supabase.storage.create_bucket(bucket_name, options={"public": True})
        except Exception as e:
            logger.warning(f"Bucket creation encountered error (ignoring): {e}")

    # 2. Extract
    target_url = favicon_server
    logger.info(f"Targeting local server: {target_url}")
    
    # This calls the real implementation, which calls extract_favicon (network) -> upload (storage)
    result = await extract_favicon_and_canonical_url(target_url, timeout=5)
    
    # 3. Verify
    assert result.image_url is not None, "Failed to extract/upload favicon"
    
    logger.info(f"Uploaded Favicon URL: {result.image_url}")
    
    # Ensure it's pointing to our storage (localhost:18000 or similar based on env)
    # The URL comes from Supabase Storage API.
    # assert "favicons" in result.image_url # verify bucket in path
    
    # 4. Verify Download
    from app.core.config import get_settings
    settings = get_settings()
    full_url = f"{settings.SUPABASE_URL}/storage/v1/object/public/favicons/{result.image_url}"
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(full_url)
            assert response.status_code == 200, f"Failed to download from {full_url}"
            # Check for PNG signature since re-encoding might change bytes
            assert response.content.startswith(b'\x89PNG'), "Downloaded content is not a PNG"
        except Exception as e:
            pytest.fail(f"Download check failed: {e}")

    # 5. Cleanup
    try:
        filename = result.image_url.split("/")[-1]
        await supabase.storage.from_(bucket_name).remove([filename])
    except Exception as e:
        logger.warning(f"Cleanup failed: {e}")


@pytest.mark.asyncio
async def test_background_favicon_fetch_success(favicon_server, db_session, test_user):
    """
    Test background favicon extraction and database persistence.
    1. Create a feed using the local favicon_server URL.
    2. Execute fetch_feed_favicon on it.
    3. Assert the feed's image_url is populated with the Supabase storage path.
    """
    from app.models.feed import Feed
    from app.workers.feed.favicon import fetch_feed_favicon
    from app.services.feeds.favicon import _get_async_supabase

    # 1. Setup: Ensure bucket exists (using real client)
    supabase = await _get_async_supabase()
    bucket_name = "favicons"
    try:
        await supabase.storage.get_bucket(bucket_name)
    except Exception:
        try:
            await supabase.storage.create_bucket(bucket_name, options={"public": True})
        except Exception as e:
            logger.warning(f"Bucket creation encountered error (ignoring): {e}")

    # 2. Create feed in database
    feed = Feed(
        url=favicon_server,
        title="Favicon Test Feed",
        description="Testing background favicon fetch",
        link=favicon_server,
        language="en",
        tags=[],
        tags_native=[],
    )
    db_session.add(feed)
    await db_session.flush()

    # 3. Call the background task worker directly
    await fetch_feed_favicon(feed_id=feed.id)

    # 4. Verify DB was updated
    await db_session.refresh(feed)
    assert feed.image_url is not None, "Favicon image_url was not updated by background worker"
    
    # Verify the favicon was uploaded and is a relative path (e.g. UUID.png)
    assert not feed.image_url.startswith("http"), "Image URL should be stored as relative storage path"
    assert feed.image_url.endswith(".png") or feed.image_url.endswith(".ico")

    # 5. Cleanup
    try:
        await supabase.storage.from_(bucket_name).remove([feed.image_url])
    except Exception as e:
        logger.warning(f"Cleanup failed: {e}")


@pytest.mark.asyncio
async def test_background_favicon_fetch_newsletter(db_session, test_user, monkeypatch):
    """
    Test that background favicon extraction for newsletter:// feeds correctly extracts
    the domain from the sender email and calls extract_favicon_and_canonical_url.
    """
    from app.models.feed import Feed
    from app.workers.feed.favicon import fetch_feed_favicon
    from app.typing.feeds import FaviconResult
    import app.workers.feed.favicon

    # Mock extract_favicon_and_canonical_url to assert it receives the domain URL
    called_with_url = None

    async def mock_extract(url, timeout=10):
        nonlocal called_with_url
        called_with_url = url
        res = FaviconResult()
        res.image_url = "mock_uploaded_favicon.png"
        return res

    monkeypatch.setattr(app.workers.feed.favicon, "extract_favicon_and_canonical_url", mock_extract)

    # 1. Create a virtual newsletter feed
    feed = Feed(
        url=f"newsletter://{test_user.id}/newsletter@pythonweekly.com",
        title="Python Weekly",
        description="Newsletter subscription from Python Weekly",
        content_type="newsletter",
        language="en",
        tags_native=[],
    )
    db_session.add(feed)
    await db_session.flush()

    # 2. Call background task
    await fetch_feed_favicon(feed_id=feed.id)

    # 3. Assert the mock was called with the domain URL
    assert called_with_url == "https://pythonweekly.com"

    # 4. Verify DB was updated
    await db_session.refresh(feed)
    assert feed.image_url == "mock_uploaded_favicon.png"

