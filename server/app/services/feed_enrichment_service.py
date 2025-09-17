"""Feed enrichment service for background processing."""

import re
import urllib.parse
from typing import Any

import requests
import structlog
from bs4 import BeautifulSoup
from extract_favicon import check_availability, from_google, from_html  # type: ignore
from lingua import Language, LanguageDetectorBuilder
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.crud.crud_feed import update_feed_enrichment
from app.models.rss_models import Feed
from app.services.ai_service import get_ai_service
from app.services.page_rank_service import get_page_rank_service
from app.services.popularity_scorer import PopularityScorer

logger = structlog.get_logger(__name__)


class FeedEnrichmentService:
    """Service for enriching feeds with AI-powered metadata and additional information."""

    def __init__(self, db: AsyncSession):
        self.db = db
        self.settings = get_settings()
        self.ai_service = get_ai_service() if self.settings.ENABLE_AI else None
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

    async def enrich_feed(self, feed_id: str) -> dict[str, Any]:
        """
        Enrich a feed with enhanced metadata, popularity scoring, and embeddings.

        Args:
            feed_id: UUID of the feed to enrich

        Returns:
            Dictionary with enrichment results
        """
        logger.info("Starting feed enrichment", feed_id=feed_id)

        try:
            # Get the feed from database
            from uuid import UUID

            from sqlalchemy import select

            result = await self.db.execute(select(Feed).where(Feed.id == UUID(feed_id)))
            feed = result.scalar_one_or_none()

            if not feed:
                logger.error("Feed not found for enrichment", feed_id=feed_id)
                return {"success": False, "error": "Feed not found"}

            enrichment_data = {}

            # Step 1: Language detection (only if not already set)
            if not feed.language:
                language = self._detect_language(feed)
                enrichment_data["language"] = language
                logger.info("Language detected", feed_id=feed_id, language=language)
            else:
                language = feed.language
                logger.info("Using existing language", feed_id=feed_id, language=language)

            # Step 2: LLM-powered enrichment using Gemini (only if AI is enabled)
            if self.settings.ENABLE_AI and self.ai_service:
                llm_enrichment = await self._enrich_with_gemini(feed, language)
                if llm_enrichment:
                    enrichment_data.update(llm_enrichment)
            else:
                # Use basic fallback enrichment when AI is disabled
                fallback_enrichment = self._fallback_enrichment_data(feed)
                enrichment_data.update(fallback_enrichment)
                logger.info("AI disabled, using fallback enrichment", feed_id=feed_id)

            # Step 3: Hybrid popularity scoring
            popularity_data = self._calculate_hybrid_popularity_score(feed, enrichment_data)
            enrichment_data.update(popularity_data)

            # Step 4: Generate embeddings (only if AI is enabled)
            embedding = None
            if self.settings.ENABLE_AI and self.ai_service:
                embedding = await self._generate_embedding(feed, enrichment_data)
                if embedding:
                    # Cast embedding to str since we're storing as string in database
                    enrichment_data["embedding"] = str(embedding)
            else:
                logger.info("AI disabled, skipping embedding generation", feed_id=feed_id)

            # Step 5: Extract favicon/image
            image_data = await self._extract_image_url(feed)
            if image_data:
                enrichment_data.update(image_data)

            # Update feed in database
            await update_feed_enrichment(self.db, feed, enrichment_data)

            logger.info(
                "Feed enrichment completed",
                feed_id=feed_id,
                language=enrichment_data.get("language", language),
                popularity_score=enrichment_data.get("popularity_score", 0.0),
                has_embedding=bool(embedding),
            )

            return {
                "success": True,
                "feed_id": feed_id,
                "enrichment_data": enrichment_data,
            }

        except Exception as e:
            logger.error("Feed enrichment failed", feed_id=feed_id, error=str(e), exc_info=True)
            return {"success": False, "error": str(e)}

    def _detect_language(self, feed: Feed) -> str:
        """Detect language from feed content."""
        try:
            text_parts = []

            if feed.title:
                text_parts.append(self._clean_html_text(feed.title))
            if feed.description:
                text_parts.append(self._clean_html_text(feed.description))

            # Get sample articles if available
            # TODO: Fetch recent articles from feed for language detection

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

    async def _enrich_with_gemini(self, feed: Feed, language: str) -> dict[str, Any]:
        """Use Gemini AI to refine feed metadata with structured output."""
        if not self.settings.ENABLE_AI or not self.ai_service:
            logger.warning("AI disabled but _enrich_with_gemini called")
            return self._fallback_enrichment_data(feed)

        try:
            # Extract domain from feed URL
            domain = self._extract_domain_from_url(feed.link or feed.url)

            # Get sample articles if available (for now, use empty list)
            sample_articles: list[str] = []  # TODO: Fetch recent articles from feed for context

            # Use AI service's Gemini enrichment method
            result = await self.ai_service.enrich_feed_with_gemini(
                title=feed.title or "Unknown Feed",
                description=feed.description or "",
                domain=domain,
                existing_tag="general",  # Default tag
                sample_articles=sample_articles,
                language=language,
            )

            if result:
                return {
                    "title": result.refined_title,
                    "description": result.refined_description,
                    "tags": result.tags,
                    "top_level_category": result.category,
                    "popularity_estimate": result.popularity_estimate,
                }
            else:
                logger.warning("Gemini enrichment returned None, using fallback")
                return self._fallback_enrichment_data(feed)

        except Exception as e:
            logger.error("Gemini enrichment failed", error=str(e))
            return self._fallback_enrichment_data(feed)

    def _fallback_enrichment_data(self, feed: Feed) -> dict[str, Any]:
        """Provide fallback enrichment data if LLM fails."""
        return {
            "title": feed.title,
            "description": feed.description,
            "tags": ["general"],
            "top_level_category": "Miscellaneous",
        }

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

    async def _generate_embedding(self, feed: Feed, enrichment_data: dict[str, Any]) -> list[float] | None:
        """Generate embedding for feed content using Gemini or fallback."""
        if not self.settings.ENABLE_AI or not self.ai_service:
            logger.warning("AI disabled but _generate_embedding called")
            return None

        try:
            # Build composite text for embedding
            components = []

            title = enrichment_data.get("title") or feed.title
            if title:
                components.append(title)

            description = enrichment_data.get("description") or feed.description
            if description:
                components.append(description)

            tags = enrichment_data.get("tags", [])
            if tags:
                components.append(", ".join(tags))

            domain = self._extract_domain_from_url(feed.link or feed.url)
            if domain:
                domain_clean = domain.replace("www.", "").replace(".com", "").replace(".org", "")
                components.append(domain_clean)

            composite_text = " | ".join(components)

            # Limit length
            if len(composite_text) > 1000:
                composite_text = composite_text[:1000] + "..."

            # Use Gemini for embeddings
            embedding = await self.ai_service.generate_embedding_with_gemini(composite_text)

            return embedding

        except Exception as e:
            logger.error("Embedding generation failed", error=str(e))
            return None

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
            session.headers.update({"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"})

            response = session.get(url, timeout=10, allow_redirects=True, verify=False)
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
