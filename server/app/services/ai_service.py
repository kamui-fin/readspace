"""AI Service for OpenAI-compatible API interactions."""

import hashlib
from typing import Any

import structlog
from google import genai

from app.core.config import get_settings
from app.core.constants import AI_CACHE_TTL
from app.core.redis_cache import RedisCache
from app.schemas.rss_schemas import FeedEnrichmentResponse

logger = structlog.get_logger(__name__)


class AIService:
    """Service for interacting with Gemini AI."""

    def __init__(self) -> None:
        self.settings = get_settings()
        self.gemini_client = None
        self._initialization_error = None
        self.redis_cache = RedisCache()

        # Check if AI is enabled and API key is provided
        if not self.settings.ENABLE_AI:
            self._initialization_error = "AI features are disabled in the configuration."
            logger.info("AI service initialized with AI features disabled")
            return

        if not self.settings.GEMINI_API_KEY:
            self._initialization_error = "AI features are not configured. Please contact your administrator."
            logger.warning("AI service initialized without API key")
            return

        try:
            # Initialize Gemini client
            self.gemini_client = genai.Client(api_key=self.settings.GEMINI_API_KEY)
            logger.info("Gemini client initialized successfully")
        except Exception as e:
            self._initialization_error = "AI service is temporarily unavailable. Please try again later."
            logger.error("Failed to initialize Gemini client", error=str(e), exc_info=True)

    def _generate_content_hash(self, content: str, extra_params: str = "") -> str:
        """Generate a hash for content-based caching."""
        # Create a hash of the content plus any extra parameters
        combined = f"{content}:{extra_params}"
        return hashlib.sha256(combined.encode()).hexdigest()[:16]  # Use first 16 chars

    def _get_summary_cache_key(self, title: str, content: str) -> str:
        """Generate cache key for article summary."""
        content_hash = self._generate_content_hash(f"{title}:{content}")
        return f"ai:summary:{content_hash}"

    def _get_translation_cache_key(self, content: str, target_language: str) -> str:
        """Generate cache key for article translation."""
        content_hash = self._generate_content_hash(content, target_language)
        return f"ai:translation:{target_language}:{content_hash}"

    def _check_availability(self) -> None:
        """Check if AI service is available and raise appropriate error if not."""
        if self._initialization_error:
            from app.core.custom_exceptions import ServiceUnavailableError

            raise ServiceUnavailableError(self._initialization_error)

        if not self.gemini_client:
            from app.core.custom_exceptions import ServiceUnavailableError

            raise ServiceUnavailableError("AI service is not properly initialized.")

    def is_available(self) -> bool:
        """Check if AI service is available without raising exceptions."""
        return self._initialization_error is None and self.gemini_client is not None

    def get_status_message(self) -> str:
        """Get a user-friendly status message about AI availability."""
        if self._initialization_error:
            return self._initialization_error
        if self.gemini_client:
            return "AI features are available."
        return "AI service status unknown."

    async def generate_text(
        self,
        prompt: str,
        system_prompt: str | None = None,
        max_tokens: int = 1000,
        temperature: float = 0.7,
    ) -> str:
        """
        Generate text using Gemini.

        Args:
            prompt: The user prompt
            system_prompt: Optional system prompt (combined with prompt)
            max_tokens: Maximum tokens to generate
            temperature: Generation temperature

        Returns:
            Generated text response
        """
        self._check_availability()

        try:
            # Combine system prompt with user prompt if provided
            full_prompt = prompt
            if system_prompt:
                full_prompt = f"{system_prompt}\n\n{prompt}"

            logger.debug(
                "Generating text with Gemini",
                model=self.settings.GEMINI_MODEL,
                prompt_length=len(full_prompt),
                max_tokens=max_tokens,
            )

            response = self.gemini_client.models.generate_content(
                model=self.settings.GEMINI_MODEL,
                contents=full_prompt,
                config=genai.types.GenerateContentConfig(temperature=temperature, max_output_tokens=max_tokens),
            )

            content = response.text or ""
            logger.debug(
                "Text generation completed",
                response_length=len(content),
            )
            return content

        except Exception as e:
            logger.error("Error generating text", error=str(e), exc_info=True)
            raise

    async def generate_embedding(self, text: str) -> list[float] | None:
        """
        Generate embeddings using Gemini embedding model.

        Args:
            text: Text to generate embeddings for

        Returns:
            List of floats representing the embedding, or None if failed
        """
        return await self.generate_embedding_with_gemini(text)

    async def generate_embeddings_batch(self, texts: list[str]) -> list[list[float] | None]:
        """
        Generate embeddings for multiple texts using Gemini batch API.

        Args:
            texts: List of texts to generate embeddings for

        Returns:
            List of embeddings (or None for failed ones)
        """
        try:
            logger.debug(
                "Generating batch embeddings with Gemini",
                model=self.settings.GEMINI_EMBEDDING_MODEL,
                batch_size=len(texts),
            )

            response = self.gemini_client.models.embed_content(
                model=self.settings.GEMINI_EMBEDDING_MODEL,
                contents=texts,  # type: ignore[arg-type]
            )

            embeddings: list[list[float] | None] = []
            # Handle potential None response.embeddings
            if response.embeddings:
                for i, embedding_result in enumerate(response.embeddings):
                    if (
                        embedding_result
                        and hasattr(embedding_result, "values")
                        and embedding_result.values  # Check not None/empty
                        and len(embedding_result.values) > 0
                    ):
                        embeddings.append(list(embedding_result.values))
                    else:
                        logger.warning(f"Empty embedding for text {i}")
                        embeddings.append(None)
            else:
                # If no embeddings returned, fill with None
                embeddings = [None] * len(texts)

            logger.debug(
                "Batch embedding generation completed",
                successful_embeddings=sum(1 for e in embeddings if e is not None),
            )
            return embeddings

        except Exception as e:
            logger.error("Error generating batch embeddings", error=str(e), exc_info=True)
            return [None] * len(texts)

    async def enrich_feed_with_gemini(
        self,
        title: str,
        description: str,
        domain: str,
        existing_tag: str,
        sample_articles: list[str],
        language: str = "en",
    ) -> FeedEnrichmentResponse | None:
        """
        Use Gemini AI to enrich feed metadata with structured output.

        Args:
            title: Feed title
            description: Feed description
            domain: Feed domain
            existing_tag: Existing tag for the feed
            sample_articles: Sample article titles
            language: Feed language

        Returns:
            FeedEnrichmentResponse or None if enrichment fails
        """

        try:
            # Language-specific instructions
            lang_instruction = ""
            if language == "zh":
                lang_instruction = "The content is in Chinese. Keep all outputs in Chinese. "
            elif language != "en":
                lang_instruction = f"The content is in {language}. Keep all outputs in {language}. "

            articles_text = "\n".join(sample_articles[:5]) if sample_articles else "No articles available"

            prompt = f"""Analyze this RSS feed and provide refined content.
{lang_instruction}Return ONLY a valid JSON object with no markdown formatting.

Feed Information:
Title: {title}
Description: {description}
Domain: {domain}
Existing Tag: {existing_tag}
Sample Articles: {articles_text}

IMPORTANT:
- Focus on what the FEED offers in general, not individual articles
- REMOVE words "RSS", "Atom", and "Feed" from the title
- AVOID generic words like "Insights", "Updates", "News", "Blog" in titles
- Tags should be SPECIFIC keywords (e.g. "javascript", "machine learning")
- Category should be ONE of the 12 predefined options exactly

Rate the popularity and influence of this RSS feed on a scale of 1–100. Consider these factors:
- How widely read or shared is this feed likely to be?
- Does it have a large, active audience (e.g., global news site, major online community, widely followed blog)?
- Is it frequently referenced, cited, or reposted across the web?
- How influential is it within its niche or community?
- Does it appear to be a personal/hobby blog, a niche resource, or a publication with significant reach?
- When refining title and description, use your own knowledge of the website too.

Scoring Guidelines:
90–100: Extremely popular & influential, widely read across the internet
        (e.g., CNN Top Stories, Hacker News frontpage, TechCrunch main feed).
80–89: Very popular, well-established with strong reach in its category (e.g., Ars Technica, Wired, The Verge).
70–79: Popular within its niche, recognized by many enthusiasts/professionals
        (e.g., Smashing Magazine, popular subreddits, regional news).
60–69: Moderately popular, steady readership but limited outside its niche (e.g., smaller but established blogs or company feeds with loyal audiences).  # noqa: E501
50–59: Some recognition, has an audience but not widely known (e.g., mid-sized blogs, specialized communities).
40–49: Limited reach, small following, niche content.
30–39: Very small audience, niche/hobbyist blogs.
20–29: Minimal recognition, unknown outside a tiny circle.
10–19: Barely read, obscure or inactive.
1–9: Effectively no audience or visibility.

Return a JSON object with exactly these keys:
{{"refined_title": "Clean title without RSS/Feed words, max 80 chars", "refined_description": "What the feed offers generally, max 200 chars", "tags": ["specific", "keywords", "5-10", "tags"], "category": "Choose ONE: Technology & Programming, Artificial Intelligence, Design & Creativity, Business & Finance, News & Politics, Gaming & Entertainment, Science & Research, Lifestyle & Personal, Culture & Arts, Security & Privacy, Education & Learning, Miscellaneous", "popularity_estimate": numeric_score_1_to_100}}"""  # noqa: E501

            # Use the new SDK API for content generation
            response = self.gemini_client.models.generate_content(
                model=self.settings.GEMINI_MODEL,
                contents=prompt,
                config=genai.types.GenerateContentConfig(
                    temperature=0.2,
                    max_output_tokens=400,
                    response_mime_type="application/json",
                    response_schema=FeedEnrichmentResponse.model_json_schema(),
                ),
            )

            # Parse and validate the structured response
            if not response.text:
                logger.warning("Empty response from Gemini feed enrichment")
                return None
            result = FeedEnrichmentResponse.model_validate_json(response.text)

            logger.debug(
                "Gemini feed enrichment completed",
                title=result.refined_title,
                category=result.category,
                popularity=result.popularity_estimate,
            )

            return result

        except Exception as e:
            logger.error("Error in Gemini feed enrichment", error=str(e), exc_info=True)
            return None

    async def generate_embedding_with_gemini(self, text: str) -> list[float] | None:
        """
        Generate embeddings using Gemini embedding model.

        Args:
            text: Text to generate embeddings for

        Returns:
            List of floats representing the embedding, or None if failed
        """
        try:
            # Type ignore for complex Gemini API typing
            response = self.gemini_client.models.embed_content(
                model=self.settings.GEMINI_EMBEDDING_MODEL,
                contents=[text],  # type: ignore[arg-type]
            )

            if response.embeddings and len(response.embeddings) > 0:
                embedding_result = response.embeddings[0]
                if (
                    embedding_result
                    and hasattr(embedding_result, "values")
                    and embedding_result.values  # Check not None/empty
                    and len(embedding_result.values) > 0
                ):
                    embedding: list[float] = list(embedding_result.values)
                    logger.debug(
                        "Gemini embedding generation completed",
                        embedding_dimensions=len(embedding),
                    )
                    return embedding

            logger.warning("Empty embedding response from Gemini")
            return None

        except Exception as e:
            logger.error("Error generating Gemini embedding", error=str(e), exc_info=True)
            return None

    async def summarize_article(
        self,
        title: str,
        content: str,
    ) -> str | None:
        """
        Generate a high-quality summary of an article in the same language as the content.

        Args:
            title: Article title
            content: Article content (can be HTML or plain text)

        Returns:
            Summary text or None if failed
        """
        self._check_availability()

        # Clean content by removing HTML tags if present
        import re

        clean_content = re.sub(r"<[^>]+>", " ", content)
        clean_content = re.sub(r"\s+", " ", clean_content).strip()

        # Truncate very long content to stay within token limits
        max_content_chars = 15000  # Roughly 4000 tokens
        if len(clean_content) > max_content_chars:
            clean_content = clean_content[:max_content_chars] + "..."

        # Check cache first
        cache_key = self._get_summary_cache_key(title, clean_content)
        try:
            cached_summary = await self.redis_cache.get(cache_key)
            if cached_summary:
                logger.debug(
                    "Summary cache hit",
                    cache_key=cache_key,
                    title=title[:50],
                )
                return cached_summary
        except Exception as e:
            logger.warning("Failed to check summary cache", error=str(e))

        try:
            system_prompt = """You are an expert at creating concise, informative summaries of news articles and blog posts. Your summaries should:

1. Capture the most important points and key takeaways
2. Be written in clear, engaging language
3. Highlight any notable statistics, quotes, or findings
4. Maintain the original tone and context
5. Be slightly more concise than typical summaries (aim for 2-3 paragraphs maximum)
6. Focus on actionable insights or important implications
7. CRITICAL: Write the summary in the SAME LANGUAGE as the original content, defaulting to English if unsure

Language Detection: Automatically detect the language of the original content and write your summary in that exact same language. If the content is in Spanish, summarize in Spanish. If in French, summarize in French, etc. If you cannot clearly determine the language, default to English."""

            prompt = f"""Title: {title}

Content: {clean_content}

Please provide a high-quality summary of this article that captures its main points, key insights, and important details. Write the summary in the same language as the original content."""  # noqa: E501

            summary = await self.generate_text(
                prompt=prompt,
                system_prompt=system_prompt,
                max_tokens=800,
                temperature=0.3,
            )

            if summary:
                summary = summary.strip()

                # Cache the summary for future use
                try:
                    await self.redis_cache.set(cache_key, summary, ttl_seconds=AI_CACHE_TTL)
                    logger.debug(
                        "Summary cached successfully",
                        cache_key=cache_key,
                        title=title[:50],
                    )
                except Exception as e:
                    logger.warning("Failed to cache summary", error=str(e))

                logger.debug(
                    "Article summary generated",
                    title=title[:50],
                    summary_length=len(summary),
                )

                return summary
            else:
                return None

        except Exception as e:
            logger.error("Error generating article summary", error=str(e), exc_info=True)
            return None

    async def translate_article(
        self,
        content: str,
        target_language: str,
    ) -> str | None:
        """
        Translate article content to a target language.

        Args:
            content: Content to translate (can be HTML or plain text)
            target_language: Target language code (e.g., 'es', 'fr', 'zh')

        Returns:
            Translated content or None if failed
        """
        self._check_availability()

        # Truncate very long content to stay within token limits
        max_content_chars = 12000  # Leave room for translation expansion
        if len(content) > max_content_chars:
            content = content[:max_content_chars] + "..."

        # Check cache first
        cache_key = self._get_translation_cache_key(content, target_language)
        try:
            cached_translation = await self.redis_cache.get(cache_key)
            if cached_translation:
                logger.debug(
                    "Translation cache hit",
                    cache_key=cache_key,
                    target_language=target_language,
                )
                return cached_translation
        except Exception as e:
            logger.warning("Failed to check translation cache", error=str(e))

        try:
            # Map common language codes to full language names for better results
            language_names = {
                "es": "Spanish",
                "fr": "French",
                "de": "German",
                "it": "Italian",
                "pt": "Portuguese",
                "ru": "Russian",
                "ja": "Japanese",
                "ko": "Korean",
                "zh": "Chinese",
                "ar": "Arabic",
                "hi": "Hindi",
                "nl": "Dutch",
                "sv": "Swedish",
                "no": "Norwegian",
                "da": "Danish",
                "fi": "Finnish",
                "pl": "Polish",
                "tr": "Turkish",
                "th": "Thai",
                "vi": "Vietnamese",
            }

            target_lang_name = language_names.get(target_language.lower(), target_language)

            system_prompt = f"""You are a professional translator specializing in translating articles and news content to {target_lang_name}. Your translations should:

1. Maintain the original meaning and tone exactly
2. Preserve ALL HTML structure and formatting tags exactly as they appear in the original
3. Use natural, fluent language that reads well to native speakers
4. Keep technical terms and proper nouns appropriately localized
5. Maintain the article's structure and flow precisely
6. Ensure cultural context is appropriately adapted while preserving the original tone
7. CRITICAL: Return ONLY the translated content without any markdown code blocks or wrapping
8. Keep all HTML tags, attributes, and structure exactly as they appear in the source

Translate the following content to {target_lang_name}. Preserve ALL HTML structure and formatting. Return ONLY the translated content:"""

            translation = await self.generate_text(
                prompt=content,
                system_prompt=system_prompt,
                max_tokens=2000,
                temperature=0.1,
            )

            if translation:
                # Remove any markdown code blocks that might have been added
                import re

                # Remove ```html...``` or ```...``` blocks
                translation = re.sub(
                    r"```(?:html)?\s*\n?(.*?)\n?```",
                    r"\1",
                    translation,
                    flags=re.DOTALL,
                )
                translation = translation.strip()

            if translation:
                # Cache the translation for future use
                try:
                    await self.redis_cache.set(cache_key, translation, ttl_seconds=AI_CACHE_TTL)
                    logger.debug(
                        "Translation cached successfully",
                        cache_key=cache_key,
                        target_language=target_language,
                    )
                except Exception as e:
                    logger.warning("Failed to cache translation", error=str(e))

                logger.debug(
                    "Article translation completed",
                    target_language=target_language,
                    original_length=len(content),
                    translation_length=len(translation),
                )

                return translation
            else:
                return None

        except Exception as e:
            logger.error(
                "Error translating article",
                error=str(e),
                target_language=target_language,
                exc_info=True,
            )
            return None

    async def health_check(self) -> dict[str, Any]:
        """
        Check if the AI service is healthy and responsive.

        Returns:
            Health status dictionary
        """
        try:
            # Try a simple embedding generation
            test_embedding = await self.generate_embedding("test")
            embedding_healthy = test_embedding is not None

            # Try a simple text generation
            try:
                test_response = await self.generate_text("Say 'OK'", max_tokens=10)
                text_healthy = len(test_response.strip()) > 0
            except Exception:
                text_healthy = False

            # Test Gemini
            gemini_healthy = False
            try:
                test_gemini = await self.enrich_feed_with_gemini(
                    "Test Feed", "Test description", "example.com", "test", []
                )
                gemini_healthy = test_gemini is not None
            except Exception:
                gemini_healthy = False

            return {
                "healthy": embedding_healthy and text_healthy and gemini_healthy,
                "embedding_service": embedding_healthy,
                "text_generation": text_healthy,
                "gemini_service": gemini_healthy,
                "gemini_available": True,
                "gemini_model": self.settings.GEMINI_MODEL,
                "gemini_embedding_model": self.settings.GEMINI_EMBEDDING_MODEL,
            }

        except Exception as e:
            logger.error("Health check failed", error=str(e))
            return {
                "healthy": False,
                "error": str(e),
                "gemini_available": True,
                "gemini_model": self.settings.GEMINI_MODEL,
                "gemini_embedding_model": self.settings.GEMINI_EMBEDDING_MODEL,
            }


# Singleton instance
_ai_service: AIService | None = None


def get_ai_service() -> AIService:
    """Get the singleton AI service instance."""
    global _ai_service
    if _ai_service is None:
        _ai_service = AIService()
    return _ai_service
