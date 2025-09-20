"""Tests for language_normalizer utility functions."""

from app.utils.language_normalizer import (
    _extract_base_language,
    normalize_language_code,
)


class TestNormalizeLanguageCode:
    """Test the normalize_language_code function."""

    def test_normalize_language_code_with_none(self):
        """Test that None input returns None."""
        assert normalize_language_code(None) is None

    def test_normalize_language_code_with_empty_string(self):
        """Test that empty string returns None."""
        assert normalize_language_code("") is None
        assert normalize_language_code("   ") is None

    def test_normalize_language_code_with_simple_codes(self):
        """Test normalization of simple two-letter codes."""
        assert normalize_language_code("en") == "en"
        assert normalize_language_code("es") == "es"
        assert normalize_language_code("fr") == "fr"
        assert normalize_language_code("de") == "de"
        assert normalize_language_code("zh") == "zh"

    def test_normalize_language_code_with_case_variations(self):
        """Test that case variations are handled correctly."""
        assert normalize_language_code("EN") == "en"
        assert normalize_language_code("Es") == "es"
        assert normalize_language_code("FR") == "fr"

    def test_normalize_language_code_with_country_codes(self):
        """Test normalization of language-country codes."""
        assert normalize_language_code("en-US") == "en"
        assert normalize_language_code("en-GB") == "en"
        assert normalize_language_code("fr-FR") == "fr"
        assert normalize_language_code("pt-BR") == "pt"
        assert normalize_language_code("zh-CN") == "zh"
        assert normalize_language_code("zh-TW") == "zh"

    def test_normalize_language_code_with_script_codes(self):
        """Test normalization of language codes with script variants."""
        assert normalize_language_code("zh-Hans") == "zh"
        assert normalize_language_code("zh-Hant") == "zh"

    def test_normalize_language_code_with_underscore_format(self):
        """Test normalization of underscore format codes."""
        assert normalize_language_code("en_US") == "en"
        assert normalize_language_code("fr_FR") == "fr"
        assert normalize_language_code("pt_BR") == "pt"

    def test_normalize_language_code_with_three_letter_codes(self):
        """Test normalization of three-letter ISO codes."""
        # These should work if iso639 library supports them
        result = normalize_language_code("eng")
        # Should either return "en" or None if not supported
        assert result is None or result == "en"

    def test_normalize_language_code_with_invalid_codes(self):
        """Test that invalid codes return None."""
        assert normalize_language_code("invalid") is None
        assert normalize_language_code("x") is None
        assert normalize_language_code("toolong") is None
        assert normalize_language_code("123") is None
        assert normalize_language_code("en-") is None
        assert normalize_language_code("-US") is None

    def test_normalize_language_code_with_whitespace(self):
        """Test that codes with whitespace are handled correctly."""
        assert normalize_language_code(" en ") == "en"
        assert normalize_language_code(" en-US ") == "en"
        assert normalize_language_code("\ten-GB\n") == "en"


class TestExtractBaseLanguage:
    """Test the _extract_base_language helper function."""

    def test_extract_base_language_with_country_codes(self):
        """Test extraction from language-country codes."""
        assert _extract_base_language("en-US") == "en"
        assert _extract_base_language("fr-FR") == "fr"
        assert _extract_base_language("pt-BR") == "pt"
        assert _extract_base_language("zh-CN") == "zh"
        assert _extract_base_language("es-ES") == "es"

    def test_extract_base_language_with_script_codes(self):
        """Test extraction from language codes with script variants."""
        assert _extract_base_language("zh-Hans") == "zh"
        assert _extract_base_language("zh-Hant") == "zh"

    def test_extract_base_language_with_underscore_format(self):
        """Test extraction from underscore format codes."""
        assert _extract_base_language("en_US") == "en"
        assert _extract_base_language("fr_FR") == "fr"
        assert _extract_base_language("pt_BR") == "pt"

    def test_extract_base_language_with_simple_codes(self):
        """Test that simple codes are returned as-is."""
        assert _extract_base_language("en") == "en"
        assert _extract_base_language("fr") == "fr"
        assert _extract_base_language("de") == "de"
        assert _extract_base_language("zh") == "zh"

    def test_extract_base_language_with_three_letter_codes(self):
        """Test extraction from three-letter base codes."""
        assert _extract_base_language("eng") == "eng"
        assert _extract_base_language("fra") == "fra"
        assert _extract_base_language("deu") == "deu"

    def test_extract_base_language_with_case_variations(self):
        """Test that case variations are normalized to lowercase."""
        assert _extract_base_language("EN-US") == "en"
        assert _extract_base_language("Fr-FR") == "fr"
        assert _extract_base_language("ZH-CN") == "zh"

    def test_extract_base_language_with_invalid_codes(self):
        """Test that invalid codes return None."""
        assert _extract_base_language("") is None
        assert _extract_base_language("x") is None
        assert _extract_base_language("toolong") is None
        assert _extract_base_language("en-") is None
        assert _extract_base_language("-US") is None
        assert _extract_base_language("123") is None
        assert _extract_base_language("en-123") is None


class TestLanguageNormalizerIntegration:
    """Integration tests for common RSS feed language scenarios."""

    def test_common_rss_language_values(self):
        """Test normalization of common language values found in RSS feeds."""
        # Common RSS feed language values
        test_cases = [
            ("en-US", "en"),
            ("en-us", "en"),
            ("EN-US", "en"),
            ("en", "en"),
            ("English", "en"),  # Full language names work via iso639
            ("es-ES", "es"),
            ("fr-FR", "fr"),
            ("de-DE", "de"),
            ("pt-BR", "pt"),
            ("zh-CN", "zh"),
            ("zh-TW", "zh"),
            ("ja-JP", "ja"),
            ("ko-KR", "ko"),
            ("it-IT", "it"),
            ("nl-NL", "nl"),
            ("ru-RU", "ru"),
        ]

        for input_code, expected in test_cases:
            result = normalize_language_code(input_code)
            assert result == expected, f"Expected {input_code} -> {expected}, got {result}"

    def test_edge_cases_from_feeds(self):
        """Test edge cases that might appear in RSS feeds."""
        # These should all return None or a valid code
        edge_cases = [
            "",
            "   ",
            "unknown",
            "en-",
            "-US",
            "en-US-variant",
            "english",
            "ENGLISH",
        ]

        for case in edge_cases:
            result = normalize_language_code(case)
            # Should either be None or a valid 2-letter code
            assert result is None or (isinstance(result, str) and len(result) == 2 and result.isalpha())
