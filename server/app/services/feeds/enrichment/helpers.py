"""Feed enrichment service for background processing."""

import re
import urllib.parse
from typing import Any

import requests
import structlog
from bs4 import BeautifulSoup
from extract_favicon import check_availability, from_google, from_html  # type: ignore
from lingua import Language, LanguageDetectorBuilder

from app.core.constants import BROWSER_USER_AGENT, FAVICON_FETCH_TIMEOUT
from app.models import Feed
from app.services.feeds.enrichment.page_rank import get_page_rank_service
from app.services.feeds.enrichment.popularity_scorer import PopularityScorer

logger = structlog.get_logger(__name__)


class FeedEnrichmentService:
    """Helper service for feed enrichment operations (used by batch enrichment task)."""

    def __init__(self):
        self.page_rank_service = get_page_rank_service()
        self.popularity_scorer = PopularityScorer(self.page_rank_service)

        # Initialize language detector with enhanced language support
        self.language_detector = (
            LanguageDetectorBuilder.from_languages(
                Language.ENGLISH,
                Language.CHINESE,
                Language.FRENCH,
                Language.GERMAN,
                Language.SPANISH,
                Language.RUSSIAN,
                Language.JAPANESE,
                Language.PORTUGUESE,
                Language.ITALIAN,
                Language.KOREAN,
                Language.ARABIC,
                Language.HINDI,
                Language.DUTCH,
                Language.SWEDISH,
                Language.DANISH,
                Language.BOKMAL,
                Language.FINNISH,
                Language.POLISH,
                Language.TURKISH,
                Language.VIETNAMESE,
                Language.THAI,
                Language.HEBREW,
                Language.INDONESIAN,
            )
            .with_preloaded_language_models()
            .build()
        )

    def _detect_language(self, feed: Feed) -> str:
        """Detect language from feed content."""
        try:
            text_parts = []

            if feed.title:
                text_parts.append(self._clean_html_text(feed.title))
            if feed.description:
                text_parts.append(self._clean_html_text(feed.description))

            # Get sample articles if available
            # Note: Could enhance accuracy by fetching recent articles for language detection

            full_text = " ".join(filter(None, text_parts)).strip()

            if not full_text:
                return "en"

            detected_language = self.language_detector.detect_language_of(full_text[:2000])
            if detected_language:
                return detected_language.iso_code_639_1.name.lower()

        except Exception as e:
            logger.warning("Language detection failed", error=str(e))

        return "en"

    def _clean_html_text(self, text: str) -> str:
        """Clean HTML tags and get pure text."""
        if not text:
            return ""
        try:
            soup = BeautifulSoup(text, "html.parser")
            clean_text = soup.get_text(separator=" ", strip=True)
            return " ".join(clean_text.split())
        except Exception:
            clean_text = re.sub(r"<[^>]+>", " ", text)
            return " ".join(clean_text.split())

    def _calculate_hybrid_popularity_score(self, feed: Feed, enrichment_data: dict[str, Any]) -> dict[str, Any]:
        """Calculate popularity score using hybrid approach from pipeline."""
        try:
            # Extract domain
            domain = self._extract_domain_from_url(feed.link or feed.url)

            # Prepare feed data for popularity scorer
            feed_data = {
                "title": feed.title or "Unknown",
                "description": feed.description or "",
                "domain": domain,
                "xmlUrl": feed.url,
                "quality_score": getattr(feed, "quality_score", 0.5),  # Default quality score
                "popularity_estimate": enrichment_data.get("popularity_estimate", 50),
            }

            # Use the hybrid popularity scorer
            popularity_data = self.popularity_scorer.calculate_popularity_score(feed_data)

            # Convert to 0-1 scale for database storage
            popularity_score = round(popularity_data["popularity_score"] / 100.0, 3)

            return {
                "popularity_score": popularity_score,
                "llm_popularity_score": popularity_data.get("llm_popularity_score", 50),
                "domain_authority_score": popularity_data.get("domain_authority_score", 0),
                "quality_score": popularity_data.get("quality_score", 50),
            }

        except Exception as e:
            logger.warning("Hybrid popularity scoring failed", error=str(e))
            return {"popularity_score": 0.5}  # Default middle value

    async def _extract_image_url(self, feed: Feed) -> dict[str, str] | None:
        """Extract favicon/image URL and get canonical link."""
        try:
            if not feed.link:
                return None

            # Get canonical URL and HTML content
            canonical_url, html_content = await self._get_canonical_url_and_html(feed.link)

            if not canonical_url:
                return None

            image_url = None

            # Try HTML parsing first
            if html_content:
                favicons = from_html(html_content, root_url=canonical_url)
                if favicons:
                    # Filter for high-quality icons
                    good_favicons = []
                    for fav in favicons:
                        is_svg = fav.format in ["svg", "svg+xml"] or "svg" in fav.url.lower()
                        is_data_uri = fav.url.startswith("data:")
                        is_large = (fav.width and fav.width > 64) or (fav.height and fav.height > 64)

                        if is_svg or is_data_uri or is_large:
                            good_favicons.append(fav)

                    if good_favicons:
                        # Check availability for first few candidates
                        checked_favicons = check_availability(good_favicons[:3])
                        for fav in checked_favicons:
                            if fav.url and (fav.reachable is True or fav.url.startswith("data:")):
                                image_url = fav.url
                                break

            # Fallback to Google favicon service
            if not image_url:
                try:
                    google_favicon = from_google(canonical_url, size=256)
                    if google_favicon and google_favicon.url:
                        image_url = google_favicon.url
                except Exception:  # noqa: S110
                    pass  # Favicon fetching is non-critical, fail silently

            result = {}
            if image_url:
                result["image_url"] = image_url
            if canonical_url != feed.link:
                result["link"] = canonical_url

            return result if result else None

        except Exception as e:
            logger.warning("Image extraction failed", feed_url=feed.link, error=str(e))
            return None

    async def _get_canonical_url_and_html(self, url: str) -> tuple[str | None, str | None]:
        """Get canonical URL and HTML content."""
        try:
            session = requests.Session()
            session.headers.update({"User-Agent": BROWSER_USER_AGENT})

            response = session.get(url, timeout=FAVICON_FETCH_TIMEOUT, allow_redirects=True, verify=False)
            response.raise_for_status()

            return response.url, response.text

        except Exception as e:
            logger.warning("Failed to fetch canonical URL", url=url, error=str(e))
            return None, None

    def _extract_domain_from_url(self, url: str) -> str:
        """Extract clean domain from URL."""
        try:
            if not url:
                return ""
            parsed = urllib.parse.urlparse(url)
            domain = parsed.netloc.lower().replace("www.", "")
            return domain
        except Exception:
            return ""
