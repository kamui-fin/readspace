"""Service for extracting full text content from article URLs."""

import asyncio
import re
import time
from copy import deepcopy

import structlog
import trafilatura  # type: ignore[import-untyped]
from bs4 import BeautifulSoup
from trafilatura.settings import DEFAULT_CONFIG

from app.core.business_metrics import articles_extracted_total
from app.core.constants import CONTENT_EXTRACTION_TIMEOUT
from app.core.metrics import (
    content_extraction_duration_seconds,
    content_extraction_total,
    extracted_content_size_bytes,
)
from app.utils.reading_time import calculate_reading_time

logger = structlog.get_logger(__name__)


class ContentExtractionService:
    """Service for extracting full article content from URLs using trafilatura."""

    def __init__(self):
        """Initialize the content extraction service with custom timeout config."""
        # Create custom config with shorter timeout and no retries
        self.config = deepcopy(DEFAULT_CONFIG)
        self.config["DEFAULT"]["DOWNLOAD_TIMEOUT"] = str(CONTENT_EXTRACTION_TIMEOUT)
        self.config["DEFAULT"]["MAX_REDIRECTS"] = "2"

    def _remove_duplicate_title_heading(self, html_content: str, article_title: str | None) -> str:
        """
        Remove the first heading if it exactly matches the article title.

        Args:
            html_content: The extracted HTML content
            article_title: The article title to compare against

        Returns:
            Modified HTML content with duplicate title heading removed if found
        """
        if not article_title or not html_content:
            return html_content

        try:
            soup = BeautifulSoup(html_content, "html.parser")

            # Find the first heading element (h1-h6)
            first_heading = soup.find(["h1", "h2", "h3", "h4", "h5", "h6"])

            if first_heading:
                # Normalize both texts for comparison: strip whitespace, collapse multiple spaces
                heading_text = re.sub(r"\s+", " ", first_heading.get_text().strip())
                title_text = re.sub(r"\s+", " ", article_title.strip())

                # If they match exactly (case-sensitive), remove the heading
                if heading_text == title_text:
                    logger.debug(
                        "Removing duplicate title heading",
                        heading_text=heading_text,
                        title=title_text,
                    )
                    first_heading.decompose()
                    return str(soup)

            return html_content

        except Exception as e:
            logger.warning(
                "Failed to remove duplicate title heading",
                error=str(e),
                exc_info=True,
            )
            # Return original content if parsing fails
            return html_content

    async def extract_full_content(
        self, url: str, article_title: str | None = None
    ) -> tuple[str | None, int | None, str | None]:
        """
        Extract full text content from the article's original URL using trafilatura.

        This method fetches the complete article content from the source URL,
        which is useful when the RSS feed only provides a summary or excerpt.
        It also removes duplicate title headings if the first heading matches the article title.

        The extraction is subject to a timeout (default 15 seconds) to prevent hanging
        on slow or unresponsive websites. If the timeout is exceeded, the extraction
        fails gracefully and returns the original feed content.

        Args:
            url: The URL to extract content from
            article_title: Optional article title to check for duplicate headings

        Returns:
            A tuple of (content, read_time, error_message):
            - content: Extracted HTML content or None if extraction failed
            - read_time: Estimated reading time in minutes (capped at 60) or None
            - error_message: Error description if extraction failed, None otherwise

        Examples:
            >>> service = ContentExtractionService()
            >>> content, read_time, error = await service.extract_full_content(
            ...     "https://example.com",
            ...     "My Article Title"
            ... )
            >>> if content:
            ...     print(f"Extracted {len(content)} chars, {read_time} min read")
        """
        start_time = time.perf_counter()

        try:
            logger.debug(
                "Fetching content from URL",
                url=url,
                has_title=bool(article_title),
                timeout=CONTENT_EXTRACTION_TIMEOUT,
            )

            # Run the blocking trafilatura operations with a timeout
            # This prevents hanging indefinitely on slow or unresponsive sites
            try:
                extracted = await asyncio.wait_for(
                    asyncio.to_thread(self._fetch_and_extract, url),
                    timeout=CONTENT_EXTRACTION_TIMEOUT,
                )
            except asyncio.TimeoutError:
                duration = time.perf_counter() - start_time

                # Record timeout metrics
                content_extraction_total.labels(status="timeout").inc()
                content_extraction_duration_seconds.observe(duration)
                articles_extracted_total.labels(status="failure", method="trafilatura").inc()

                logger.warning(
                    "Content extraction timed out",
                    url=url,
                    timeout=CONTENT_EXTRACTION_TIMEOUT,
                    duration_seconds=round(duration, 3),
                )
                return None, None, f"Content extraction timed out after {CONTENT_EXTRACTION_TIMEOUT} seconds"

            if not extracted:
                duration = time.perf_counter() - start_time

                # Record failure metrics
                content_extraction_total.labels(status="failure").inc()
                content_extraction_duration_seconds.observe(duration)
                articles_extracted_total.labels(status="failure", method="trafilatura").inc()

                logger.warning(
                    "Could not extract content from URL",
                    url=url,
                    duration_seconds=round(duration, 3),
                )
                return None, None, "Could not extract readable content from the page"

            # Remove duplicate title heading if article title is provided
            if article_title:
                extracted = self._remove_duplicate_title_heading(extracted, article_title)

            # Calculate read time for the extracted content
            read_time = self._calculate_read_time(extracted)
            duration = time.perf_counter() - start_time
            content_size = len(extracted)

            # Record success metrics
            content_extraction_total.labels(status="success").inc()
            content_extraction_duration_seconds.observe(duration)
            extracted_content_size_bytes.observe(content_size)
            articles_extracted_total.labels(status="success", method="trafilatura").inc()

            logger.info(
                "Successfully extracted full text",
                url=url,
                content_length=content_size,
                read_time=read_time,
                duration_seconds=round(duration, 3),
            )

            return extracted, read_time, None

        except Exception as e:
            duration = time.perf_counter() - start_time

            # Record error metrics
            content_extraction_total.labels(status="error").inc()
            content_extraction_duration_seconds.observe(duration)
            articles_extracted_total.labels(status="failure", method="trafilatura").inc()

            logger.error(
                "Error extracting full text",
                error=str(e),
                error_type=type(e).__name__,
                url=url,
                duration_seconds=round(duration, 3),
                exc_info=True,
            )
            return None, None, "An unexpected error occurred while extracting content"

    def _fetch_and_extract(self, url: str) -> str | None:
        """
        Fetch and extract content using trafilatura (blocking operation).

        This method is designed to run in a separate thread to avoid blocking
        the async event loop. It performs the actual HTTP fetch and content
        extraction using trafilatura's synchronous API with a strict timeout
        to prevent hanging on slow or unresponsive websites.

        Args:
            url: The URL to fetch and extract content from

        Returns:
            Extracted HTML content or None if extraction failed
        """
        # Fetch the URL content with custom config (shorter timeout, limited redirects)
        downloaded = trafilatura.fetch_url(url, config=self.config)
        if not downloaded:
            return None

        # Extract the main content as HTML
        extracted = trafilatura.extract(downloaded, output_format="html", config=self.config)
        return extracted

    def _calculate_read_time(self, content: str) -> int:
        """
        Calculate estimated reading time in minutes with CJK support.

        Args:
            content: The article content to analyze

        Returns:
            Estimated reading time in minutes (capped at 60 minutes)
        """
        if not content:
            return 1

        read_time = calculate_reading_time(content, default_wpm=200)
        return min(read_time, 60)  # Cap at 60 minutes
