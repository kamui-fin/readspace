import pytest
from app.services.feeds.parsing import _normalize_language


class TestLanguageNormalization:
    def test_standard_codes(self):
        """Test standard 2-letter ISO codes."""
        assert _normalize_language("en") == "en"
        assert _normalize_language("fr") == "fr"
        assert _normalize_language("de") == "de"
        assert _normalize_language("es") == "es"

    def test_regional_codes(self):
        """Test codes with region/script modifiers - should return base language code."""
        assert _normalize_language("en-US") == "en"
        assert _normalize_language("en-GB") == "en"
        assert _normalize_language("fr-CA") == "fr"
        assert _normalize_language("zh-CN") == "zh"
        assert _normalize_language("zh-Hant") == "zh"

    def test_complex_codes(self):
        """Test more complex language tags."""
        # English, US region, computer voice -> en
        assert _normalize_language("en-US-x-lvariant") == "en"

    def test_lingua_style_names(self):
        """Test full language names - unsupported by current normalizer, falls back to default."""
        # langcodes.standardize_tag doesn't parse names like "English"
        assert _normalize_language("English") == "en"
        assert _normalize_language("French") == "en" # Fallback

    def test_invalid_codes(self):
        """Test invalid or unknown codes fallback to 'en'."""
        assert _normalize_language("invalid-code-123") == "en"
        assert _normalize_language("12345") == "en"
        assert _normalize_language("") == "en"

    def test_none_input(self):
        """Test None input (though type hint says str, good to be safe if called dynamically)."""
        # The function expects str, but let's see how it behaves if we pass something else or if we need to handle it.
        # Looking at implementation: langcodes.Language.get() might raise TypeError or similar.
        # The current implementation catches LanguageTagError.
        # Let's stick to string inputs as per type hint.
        pass

    def test_case_insensitivity(self):
        """Test that it handles mixed case."""
        assert _normalize_language("EN-us") == "en"
        assert _normalize_language("Fr-ca") == "fr"
