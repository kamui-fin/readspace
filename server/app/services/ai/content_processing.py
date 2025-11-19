"""Content processing functionality (summarization and translation)."""

import re

import structlog

from app.services.ai.cache_utils import AICacheManager
from app.services.ai.text_generation import TextGenerationService

logger = structlog.get_logger(__name__)


class ContentProcessor:
    """Handles article summarization and translation."""

    def __init__(self) -> None:
        self.text_generator = TextGenerationService()
        self.cache_manager = AICacheManager()

    async def summarize_article(self, title: str, content: str) -> str | None:
        """
        Generate a high-quality summary of an article in the same language as the content.

        Args:
            title: Article title
            content: Article content (can be HTML or plain text)

        Returns:
            Summary text or None if failed
        """
        clean_content = self._clean_content(content)
        clean_content = self._truncate_content(clean_content, max_chars=15000)

        cache_key = self.cache_manager.get_summary_cache_key(title, clean_content)
        cached_summary = await self.cache_manager.get_cached(cache_key)
        if cached_summary:
            logger.debug("Summary cache hit", cache_key=cache_key, title=title[:50])
            return cached_summary

        try:
            system_prompt = self._get_summary_system_prompt()
            prompt = f"""Title: {title}

Content: {clean_content}

Please provide a high-quality summary of this article that captures its main points, key insights, and important details. Write the summary in the same language as the original content."""  # noqa: E501

            summary = await self.text_generator.generate_text(
                prompt=prompt,
                system_prompt=system_prompt,
                max_tokens=400,
                temperature=0.3,
            )

            if summary:
                summary = summary.strip()
                await self.cache_manager.set_cached(cache_key, summary)
                logger.debug("Article summary generated", title=title[:50], summary_length=len(summary))
                return summary
            else:
                return None

        except Exception as e:
            logger.error("Error generating article summary", error=str(e), exc_info=True)
            return None

    async def translate_article(self, content: str, target_language: str) -> str | None:
        """
        Translate article content to a target language.

        Args:
            content: Content to translate (can be HTML or plain text)
            target_language: Target language code (e.g., 'es', 'fr', 'zh')

        Returns:
            Translated content or None if failed
        """
        content = self._truncate_content(content, max_chars=12000)

        cache_key = self.cache_manager.get_translation_cache_key(content, target_language)
        cached_translation = await self.cache_manager.get_cached(cache_key)
        if cached_translation:
            logger.debug("Translation cache hit", cache_key=cache_key, target_language=target_language)
            return cached_translation

        try:
            target_lang_name = self._get_language_name(target_language)
            system_prompt = self._get_translation_system_prompt(target_lang_name)

            translation = await self.text_generator.generate_text(
                prompt=content,
                system_prompt=system_prompt,
                max_tokens=2000,
                temperature=0.1,
            )

            if translation:
                translation = self._clean_translation(translation)

            if translation:
                await self.cache_manager.set_cached(cache_key, translation)
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
            logger.error("Error translating article", error=str(e), target_language=target_language, exc_info=True)
            return None

    @staticmethod
    def _clean_content(content: str) -> str:
        """Clean content by removing HTML tags."""
        clean = re.sub(r"<[^>]+>", " ", content)
        clean = re.sub(r"\s+", " ", clean).strip()
        return clean

    @staticmethod
    def _truncate_content(content: str, max_chars: int) -> str:
        """Truncate content to stay within token limits."""
        if len(content) > max_chars:
            return content[:max_chars] + "..."
        return content

    @staticmethod
    def _clean_translation(translation: str) -> str:
        """Remove markdown code blocks from translation."""
        translation = re.sub(r"```(?:html)?\s*\n?(.*?)\n?```", r"\1", translation, flags=re.DOTALL)
        return translation.strip()

    @staticmethod
    def _get_language_name(language_code: str) -> str:
        """Map language code to full language name."""
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
        return language_names.get(language_code.lower(), language_code)

    @staticmethod
    def _get_summary_system_prompt() -> str:
        """Get system prompt for summarization."""
        return """You are an expert at creating concise, informative summaries of news articles and blog posts.
Your summaries should:

1. Capture the main points and key insights
2. Be written in clear, engaging language
3. Highlight any notable statistics, quotes, or findings
4. Maintain the original tone and context
5. Be CONCISE - scale with article length:
   - Short articles (< 500 words): 1-2 sentences
   - Medium articles (500-2000 words): 1 paragraph (3-4 sentences)
   - Long articles (> 2000 words): 2 paragraphs maximum
6. Focus on actionable insights or important implications
7. CRITICAL: Write the summary in the SAME LANGUAGE as the original content, defaulting to English if unsure

Language Detection: Automatically detect the language of the original content and write your summary in that exact same language. If the content is in Spanish, summarize in Spanish. If in French, summarize in French, etc. If you cannot clearly determine the language, default to English."""  # noqa: E501

    @staticmethod
    def _get_translation_system_prompt(target_lang_name: str) -> str:
        """Get system prompt for translation."""
        return f"""You are a professional translator specializing in translating articles and news content to {target_lang_name}.
Your translations should:

1. Maintain the original meaning and tone exactly
2. Preserve ALL HTML structure and formatting tags exactly as they appear in the original
3. Use natural, fluent language that reads well to native speakers
4. Keep technical terms and proper nouns appropriately localized
5. Maintain the article's structure and flow precisely
6. Ensure cultural context is appropriately adapted while preserving the original tone
7. CRITICAL: Return ONLY the translated content without any markdown code blocks or wrapping
8. Keep all HTML tags, attributes, and structure exactly as they appear in the source

Translate the following content to {target_lang_name}. Preserve ALL HTML structure and formatting. Return ONLY the translated content:"""  # noqa: E501
