import httpx
import structlog

from app.typing.feeds import FaviconResult

# Assuming extract_favicon is a library
try:
    from extract_favicon import check_availability, from_google, from_html
except ImportError:
    # Mock or handle if library is missing, but for now assume it exists as per original code
    pass

logger = structlog.get_logger(__name__)


async def extract_favicon_and_canonical_url(
    feed_link: str,
    timeout: int = 10,
) -> FaviconResult:
    """Extract favicon URL and canonical URL from feed link.

    Args:
        feed_link: Feed's website link
        timeout: HTTP request timeout in seconds

    Returns:
        FaviconResult object with optional image_url and canonical_link
    """
    if not feed_link:
        return FaviconResult()

    try:
        # Fetch the page with redirects
        async with httpx.AsyncClient(
            follow_redirects=True,
            timeout=timeout,
            verify=False,  # Some RSS feeds have bad certs
        ) as client:
            response = await client.get(feed_link)
            response.raise_for_status()

            canonical_url = str(response.url)
            html_content = response.text

        image_url = None

        # Try extracting from HTML first
        if html_content:
            favicons = from_html(html_content, root_url=canonical_url)
            if favicons:
                # Filter for high-quality icons
                good_favicons = []
                for fav in favicons:
                    is_svg = (
                        fav.format in ["svg", "svg+xml"] or "svg" in fav.url.lower()
                    )
                    is_data_uri = fav.url.startswith("data:")
                    is_large = (fav.width and fav.width > 64) or (
                        fav.height and fav.height > 64
                    )

                    if is_svg or is_data_uri or is_large:
                        good_favicons.append(fav)

                if good_favicons:
                    # Check availability for first few candidates
                    checked_favicons = check_availability(good_favicons[:3])
                    for fav in checked_favicons:
                        if fav.url and (
                            fav.reachable is True or fav.url.startswith("data:")
                        ):
                            image_url = fav.url
                            break

        # Fallback to Google favicon service
        if not image_url:
            try:
                google_favicon = from_google(canonical_url, size=256)
                if google_favicon and google_favicon.url:
                    image_url = google_favicon.url
            except Exception:
                pass  # Favicon fetching is non-critical

        result = FaviconResult(image_url=image_url)

        # Include canonical URL if it differs from original
        if canonical_url != feed_link:
            result.canonical_link = canonical_url

        return result

    except Exception as e:
        logger.warning(
            "Favicon extraction failed",
            feed_link=feed_link,
            error=str(e),
        )
        return FaviconResult()
