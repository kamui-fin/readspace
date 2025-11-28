"""Integration tests for language detection with real RSS feeds."""

import pytest

from app.services.feeds.language_detection import (
    detect_feed_language,
)


class TestLanguageDetection:
    """Test language detection with various text samples."""

    def test_detect_english_text(self):
        """Test detection of English text."""
        text = "This is a sample English text about technology and programming."
        result = detect_feed_language(text)
        assert result == "en"

    def test_detect_spanish_text(self):
        """Test detection of Spanish text."""
        text = "Este es un texto de ejemplo en español sobre tecnología y programación."
        result = detect_feed_language(text)
        assert result == "es"

    def test_detect_french_text(self):
        """Test detection of French text."""
        text = "Ceci est un exemple de texte en français sur la technologie et la programmation."
        result = detect_feed_language(text)
        assert result == "fr"

    def test_detect_german_text(self):
        """Test detection of German text."""
        text = "Dies ist ein Beispieltext auf Deutsch über Technologie und Programmierung."
        result = detect_feed_language(text)
        assert result == "de"

    def test_short_text_returns_none(self):
        """Test that very short text returns None."""
        text = "Hi"
        result = detect_feed_language(text)
        assert result is None

    def test_empty_text_returns_none(self):
        """Test that empty text returns None."""
        result = detect_feed_language("")
        assert result is None

    def test_low_confidence_returns_none(self):
        """Test that low confidence detection returns None."""
        # Ambiguous word that exists in multiple languages
        text = "prologue"
        result = detect_feed_language(text, min_confidence=0.9)
        assert result is None

    def test_detect_from_feed_content_with_all_fields(self):
        """Test detection from complete feed content."""
        title = "Technology News and Updates"
        description = "The latest news about technology, programming, and software development."
        articles = [
            "New Python release brings performance improvements",
            "JavaScript framework comparison for 2025",
            "Machine learning trends in artificial intelligence",
        ]
        
        result = detect_feed_language(title, description, articles)
        assert result == "en"

    def test_detect_from_feed_content_title_only(self):
        """Test detection from title only."""
        title = "Technology News and Updates for Developers"
        result = detect_feed_language(title, None, [])
        assert result == "en"

    def test_detect_from_feed_content_articles_only(self):
        """Test detection from articles only."""
        articles = [
            "Breaking news about artificial intelligence",
            "Software development best practices",
            "Cloud computing infrastructure updates",
        ]
        result = detect_feed_language(None, None, articles)
        assert result == "en"

    def test_detect_from_feed_content_no_text_defaults_english(self):
        """Test that no text defaults to English."""
        result = detect_feed_language(None, None, [])
        assert result == "en"

    def test_detect_from_feed_content_spanish(self):
        """Test detection from Spanish feed content."""
        title = "Noticias de Tecnología"
        description = "Las últimas noticias sobre tecnología y desarrollo de software."
        articles = [
            "Nueva versión de Python mejora el rendimiento",
            "Comparación de frameworks de JavaScript",
        ]
        
        result = detect_feed_language(title, description, articles)
        assert result == "es"


@pytest.mark.asyncio
@pytest.mark.integration
class TestLanguageDetectionWithRealFeeds:
    """Integration tests with real RSS feeds."""

    async def test_hacker_news_feed_language_detection(self):
        """Test language detection with Hacker News RSS feed."""
        import httpx
        from app.services.feeds import parsing
        
        # Fetch HN RSS feed
        url = "https://hnrss.org/newest"
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(url)
            response.raise_for_status()
            content = response.content
        
        # Parse feed
        parsed = parsing.parse_feed_content(content, url)
        
        # Extract article texts
        article_texts = [
            f"{article.title or ''} {article.description or ''}".strip()
            for article in parsed["articles"][:5]
        ]
        
        # Detect language
        detected_lang = detect_language_from_feed_content(
            title=parsed["title"],
            description=parsed["description"],
            article_texts=article_texts,
        )
        
        # HN is primarily English
        assert detected_lang == "en"
        
    async def test_feed_without_language_metadata(self):
        """Test detection for feeds that don't provide language metadata."""
        import httpx
        from app.services.feeds import parsing
        
        # Use a feed known to not include language metadata
        url = "https://hnrss.org/newest"
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(url)
            response.raise_for_status()
            content = response.content
        
        parsed = parsing.parse_feed_content(content, url)
        
        # If feed doesn't provide language, it should be None or empty
        # Our detection should handle this
        article_texts = [
            f"{article.title or ''} {article.description or ''}".strip()
            for article in parsed["articles"][:5]
        ]
        
        detected_lang = detect_language_from_feed_content(
            title=parsed["title"],
            description=parsed["description"],
            article_texts=article_texts,
        )
        
        # Should detect a valid language code
        assert detected_lang is not None
        assert len(detected_lang) == 2  # ISO 639-1 code
        assert detected_lang.islower()
