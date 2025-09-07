"""Feed enrichment service for background processing."""

import json
import re
import urllib.parse
from typing import Any

import requests
import structlog
from bs4 import BeautifulSoup
from extract_favicon import check_availability, from_google, from_html
from lingua import Language, LanguageDetectorBuilder
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud.crud_feed import update_feed_enrichment
from app.models.rss_models import Feed, FeedCategory
from app.services.ai_service import get_ai_service
from app.services.page_rank_service import get_page_rank_service

logger = structlog.get_logger(__name__)


class FeedEnrichmentService:
    """Service for enriching feeds with AI-powered metadata and additional information."""

    def __init__(self, db: AsyncSession):
        self.db = db
        self.ai_service = get_ai_service()
        self.page_rank_service = get_page_rank_service()

        # Initialize language detector
        self.language_detector = LanguageDetectorBuilder.from_languages(
            Language.ENGLISH, Language.CHINESE, Language.FRENCH, Language.GERMAN,
            Language.SPANISH, Language.RUSSIAN, Language.JAPANESE, Language.PORTUGUESE,
            Language.ITALIAN, Language.KOREAN, Language.ARABIC, Language.HINDI,
            Language.DUTCH, Language.SWEDISH, Language.DANISH, Language.BOKMAL,
            Language.FINNISH, Language.POLISH, Language.TURKISH
        ).with_preloaded_language_models().build()

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

            result = await self.db.execute(
                select(Feed).where(Feed.id == UUID(feed_id))
            )
            feed = result.scalar_one_or_none()

            if not feed:
                logger.error("Feed not found for enrichment", feed_id=feed_id)
                return {"success": False, "error": "Feed not found"}

            enrichment_data = {}

            # Step 1: Language detection
            language = self._detect_language(feed)
            enrichment_data['language'] = language

            # Step 2: LLM-powered enrichment
            llm_enrichment = await self._enrich_with_llm(feed, language)
            enrichment_data.update(llm_enrichment)

            # Step 3: Popularity scoring
            popularity_score = self._calculate_popularity_score(feed, enrichment_data)
            enrichment_data['popularity_score'] = popularity_score

            # Step 4: Generate embeddings
            embedding = await self._generate_embedding(feed, enrichment_data)
            if embedding:
                enrichment_data['embedding'] = embedding

            # Step 5: Extract favicon/image
            image_data = await self._extract_image_url(feed)
            if image_data:
                enrichment_data.update(image_data)

            # Update feed in database
            await update_feed_enrichment(self.db, feed, enrichment_data)

            logger.info(
                "Feed enrichment completed",
                feed_id=feed_id,
                language=language,
                popularity_score=popularity_score,
                has_embedding=bool(embedding)
            )

            return {
                "success": True,
                "feed_id": feed_id,
                "enrichment_data": enrichment_data
            }

        except Exception as e:
            logger.error(
                "Feed enrichment failed",
                feed_id=feed_id,
                error=str(e),
                exc_info=True
            )
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
                return 'en'

            detected_language = self.language_detector.detect_language_of(full_text[:2000])
            if detected_language:
                return detected_language.iso_code_639_1.name.lower()

        except Exception as e:
            logger.warning("Language detection failed", error=str(e))

        return 'en'

    def _clean_html_text(self, text: str) -> str:
        """Clean HTML tags and get pure text."""
        if not text:
            return ""
        try:
            soup = BeautifulSoup(text, 'html.parser')
            clean_text = soup.get_text(separator=' ', strip=True)
            return ' '.join(clean_text.split())
        except Exception:
            clean_text = re.sub(r'<[^>]+>', ' ', text)
            return ' '.join(clean_text.split())

    async def _enrich_with_llm(self, feed: Feed, language: str) -> dict[str, Any]:
        """Use LLM to refine feed metadata."""
        try:
            domain = self._extract_domain_from_url(feed.url)

            # Language-specific instructions
            lang_instruction = ""
            if language == 'zh':
                lang_instruction = "The content is in Chinese. Keep all outputs in Chinese. "
            elif language != 'en':
                lang_instruction = f"The content is in {language}. Keep all outputs in {language}. "

            prompt = f"""Analyze this RSS feed and provide refined content.
{lang_instruction}Return ONLY a valid JSON object with no markdown formatting.

Feed Information:
Title: {feed.title or 'Unknown'}
Description: {feed.description or ''}
Domain: {domain}
URL: {feed.url}

IMPORTANT: 
- Focus on what the FEED offers in general, not individual articles
- REMOVE words "RSS", "Atom", and "Feed" from the title
- AVOID generic words like "Insights", "Updates", "News", "Blog" in titles
- Tags should be SPECIFIC keywords (e.g. "javascript", "machine learning")
- Category should be ONE of the 12 predefined options exactly

Return a JSON object with exactly these keys:
{{"refined_title": "Clean title without RSS/Feed words, max 80 chars", "refined_description": "What the feed offers generally, max 200 chars", "tags": ["specific", "keywords", "5-10", "tags"], "category": "Choose ONE: Technology & Programming, Artificial Intelligence, Design & Creativity, Business & Finance, News & Politics, Gaming & Entertainment, Science & Research, Lifestyle & Personal, Culture & Arts, Security & Privacy, Education & Learning, Miscellaneous"}}"""

            response = await self.ai_service.generate_text(
                prompt=prompt,
                temperature=0.2,
                max_tokens=400
            )

            # Parse JSON response
            llm_data = self._extract_json_from_response(response)

            # Validate and clean the response
            return self._validate_llm_response(llm_data, feed)

        except Exception as e:
            logger.error("LLM enrichment failed", error=str(e))
            return self._fallback_enrichment_data(feed)

    def _extract_json_from_response(self, response: str) -> dict[str, Any]:
        """Extract JSON from potentially malformed LLM response."""
        try:
            # Remove markdown formatting
            text = response.strip()
            if '```' in text:
                lines = text.split('\n')
                json_lines = []
                in_json = False
                for line in lines:
                    if line.strip().startswith('```'):
                        if in_json:
                            break
                        in_json = True
                        continue
                    if in_json:
                        json_lines.append(line)
                text = '\n'.join(json_lines).strip()

            # Find JSON boundaries
            if not text.startswith('{'):
                start = text.find('{')
                if start != -1:
                    text = text[start:]

            if not text.endswith('}'):
                brace_count = 0
                end_pos = -1
                for i, char in enumerate(text):
                    if char == '{':
                        brace_count += 1
                    elif char == '}':
                        brace_count -= 1
                        if brace_count == 0:
                            end_pos = i
                            break

                if end_pos != -1:
                    text = text[:end_pos+1]

            return json.loads(text)

        except json.JSONDecodeError:
            logger.warning("Failed to parse JSON response", response=response[:200])
            return {}

    def _validate_llm_response(self, llm_data: dict[str, Any], feed: Feed) -> dict[str, Any]:
        """Validate and clean LLM response data."""
        result = {}

        # Validate title
        refined_title = llm_data.get('refined_title', feed.title or '')
        if refined_title and 3 <= len(refined_title) <= 120:
            result['title'] = refined_title.strip('"\'.')

        # Validate description
        refined_description = llm_data.get('refined_description', feed.description or '')
        if refined_description and len(refined_description) <= 300:
            result['description'] = refined_description.strip('"\'.')

        # Validate tags
        tags = llm_data.get('tags', [])
        if isinstance(tags, list):
            validated_tags = [
                str(tag).strip().lower()
                for tag in tags
                if tag and 1 < len(str(tag)) < 30
            ]
            result['tags'] = validated_tags[:10]

        # Validate category
        category = llm_data.get('category', 'Miscellaneous')
        valid_categories = [cat.value for cat in FeedCategory]
        if category in valid_categories:
            result['top_level_category'] = category
        else:
            result['top_level_category'] = 'Miscellaneous'

        return result

    def _fallback_enrichment_data(self, feed: Feed) -> dict[str, Any]:
        """Provide fallback enrichment data if LLM fails."""
        return {
            'title': feed.title,
            'description': feed.description,
            'tags': ['general'],
            'top_level_category': 'Miscellaneous'
        }

    def _calculate_popularity_score(self, feed: Feed, enrichment_data: dict[str, Any]) -> float:
        """Calculate popularity score based on domain authority."""
        try:
            domain = self._extract_domain_from_url(feed.url)
            domain_score = self.page_rank_service.get_domain_score(domain)

            # Simple scoring for now - just use domain authority
            # Can be extended with feed activity, subscriber count, etc.
            # Convert from 0-100 scale to 0-1 scale
            return round(domain_score / 100.0, 3)

        except Exception as e:
            logger.warning("Popularity scoring failed", error=str(e))
            return 0.0

    async def _generate_embedding(self, feed: Feed, enrichment_data: dict[str, Any]) -> list[float] | None:
        """Generate embedding for feed content."""
        try:
            # Build composite text for embedding
            components = []

            title = enrichment_data.get('title') or feed.title
            if title:
                components.append(title)

            description = enrichment_data.get('description') or feed.description
            if description:
                components.append(description)

            tags = enrichment_data.get('tags', [])
            if tags:
                components.append(", ".join(tags))

            domain = self._extract_domain_from_url(feed.url)
            if domain:
                domain_clean = domain.replace('www.', '').replace('.com', '').replace('.org', '')
                components.append(domain_clean)

            composite_text = " | ".join(components)

            # Limit length
            if len(composite_text) > 1000:
                composite_text = composite_text[:1000] + "..."

            # Generate embedding using AI service
            embedding = await self.ai_service.generate_embedding(composite_text)
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
                        is_svg = fav.format in ['svg', 'svg+xml'] or 'svg' in fav.url.lower()
                        is_data_uri = fav.url.startswith('data:')
                        is_large = (fav.width and fav.width > 64) or (fav.height and fav.height > 64)

                        if is_svg or is_data_uri or is_large:
                            good_favicons.append(fav)

                    if good_favicons:
                        # Check availability for first few candidates
                        checked_favicons = check_availability(good_favicons[:3])
                        for fav in checked_favicons:
                            if fav.url and (fav.reachable is True or fav.url.startswith('data:')):
                                image_url = fav.url
                                break

            # Fallback to Google favicon service
            if not image_url:
                try:
                    google_favicon = from_google(canonical_url, size=256)
                    if google_favicon and google_favicon.url:
                        image_url = google_favicon.url
                except Exception:
                    pass

            result = {}
            if image_url:
                result['image_url'] = image_url
            if canonical_url != feed.link:
                result['link'] = canonical_url

            return result if result else None

        except Exception as e:
            logger.warning("Image extraction failed", feed_url=feed.url, error=str(e))
            return None

    async def _get_canonical_url_and_html(self, url: str) -> tuple[str | None, str | None]:
        """Get canonical URL and HTML content."""
        try:
            session = requests.Session()
            session.headers.update({
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            })

            response = session.get(url, timeout=10, allow_redirects=True, verify=False)
            response.raise_for_status()

            return response.url, response.text

        except Exception as e:
            logger.warning("Failed to fetch canonical URL", url=url, error=str(e))
            return None, None

    def _extract_domain_from_url(self, url: str) -> str:
        """Extract clean domain from URL."""
        try:
            parsed = urllib.parse.urlparse(url)
            domain = parsed.netloc.lower().replace('www.', '')
            return domain
        except Exception:
            return ""
