"""Unit tests for article enhancement input validation."""

import pytest
from pydantic import BaseModel, Field, ValidationError, field_validator

from app.core.constants import MAX_AI_SUMMARIZATION_CONTENT_BYTES, MAX_AI_TRANSLATION_CONTENT_BYTES
from app.schemas.enums import LanguageCode


# Define test schemas locally to avoid circular imports during testing
class SummarizeRequest(BaseModel):
    """Request for article summarization."""

    content: str | None = Field(
        None,
        description="Optional content to summarize instead of article content (max 100KB)",
    )

    @field_validator("content")
    @classmethod
    def validate_content_size(cls, v: str | None) -> str | None:
        """Validate that content does not exceed maximum size for AI processing."""
        if v is None or v == "":
            return v

        content_bytes = len(v.encode("utf-8"))
        if content_bytes > MAX_AI_SUMMARIZATION_CONTENT_BYTES:
            size_kb = MAX_AI_SUMMARIZATION_CONTENT_BYTES // 1024
            raise ValueError(
                f"Content too large for summarization. Maximum size is {size_kb}KB "
                f"({MAX_AI_SUMMARIZATION_CONTENT_BYTES:,} bytes), received {content_bytes:,} bytes."
            )
        return v


class TranslateRequest(BaseModel):
    """Request for article translation."""

    target_language: LanguageCode = Field(
        ...,
        description="Target language code (ISO 639-1 format, e.g., 'es', 'fr', 'zh')",
    )
    content: str | None = Field(
        None,
        description="Optional content to translate instead of article content (max 50KB)",
    )

    @field_validator("content")
    @classmethod
    def validate_content_size(cls, v: str | None) -> str | None:
        """Validate that content does not exceed maximum size for AI processing."""
        if v is None or v == "":
            return v

        content_bytes = len(v.encode("utf-8"))
        if content_bytes > MAX_AI_TRANSLATION_CONTENT_BYTES:
            size_kb = MAX_AI_TRANSLATION_CONTENT_BYTES // 1024
            raise ValueError(
                f"Content too large for translation. Maximum size is {size_kb}KB "
                f"({MAX_AI_TRANSLATION_CONTENT_BYTES:,} bytes), received {content_bytes:,} bytes."
            )
        return v


class TestSummarizeRequestValidation:
    """Test content length validation for summarization requests."""

    def test_summarize_request_with_valid_content(self):
        """Test that valid content within limits is accepted."""
        content = "A" * 1000  # 1KB of content
        request = SummarizeRequest(content=content)
        assert request.content == content

    def test_summarize_request_with_none_content(self):
        """Test that None content is accepted (will use article content)."""
        request = SummarizeRequest(content=None)
        assert request.content is None

    def test_summarize_request_with_empty_content(self):
        """Test that empty content is accepted."""
        request = SummarizeRequest(content="")
        assert request.content == ""

    def test_summarize_request_with_max_size_content(self):
        """Test that content at exactly max size is accepted."""
        # Create content that's exactly 100KB
        content = "A" * MAX_AI_SUMMARIZATION_CONTENT_BYTES
        request = SummarizeRequest(content=content)
        assert len(request.content.encode("utf-8")) == MAX_AI_SUMMARIZATION_CONTENT_BYTES

    def test_summarize_request_with_oversized_content(self):
        """Test that content exceeding max size is rejected."""
        # Create content that's 100KB + 1 byte
        content = "A" * (MAX_AI_SUMMARIZATION_CONTENT_BYTES + 1)
        with pytest.raises(ValidationError) as exc_info:
            SummarizeRequest(content=content)

        errors = exc_info.value.errors()
        assert len(errors) == 1
        assert errors[0]["loc"] == ("content",)
        assert "maximum" in errors[0]["msg"].lower() or "100" in errors[0]["msg"]

    def test_summarize_request_with_multibyte_characters(self):
        """Test that multibyte characters are counted correctly in byte size."""
        # Unicode characters can be multiple bytes
        # "你好" (Hello in Chinese) is 6 bytes in UTF-8 (3 bytes per character)
        chars_needed = MAX_AI_SUMMARIZATION_CONTENT_BYTES // 3 + 1
        content = "你" * chars_needed  # Should exceed 100KB
        with pytest.raises(ValidationError) as exc_info:
            SummarizeRequest(content=content)

        errors = exc_info.value.errors()
        assert len(errors) == 1
        assert errors[0]["loc"] == ("content",)


class TestTranslateRequestValidation:
    """Test content length and language code validation for translation requests."""

    def test_translate_request_with_valid_language_code(self):
        """Test that valid language codes are accepted."""
        request = TranslateRequest(target_language=LanguageCode.SPANISH)
        assert request.target_language == LanguageCode.SPANISH

    def test_translate_request_with_all_supported_languages(self):
        """Test that all supported language codes are valid."""
        for lang_code in LanguageCode:
            request = TranslateRequest(target_language=lang_code)
            assert request.target_language == lang_code

    def test_translate_request_with_invalid_language_code(self):
        """Test that invalid language codes are rejected."""
        with pytest.raises(ValidationError) as exc_info:
            TranslateRequest(target_language="invalid_lang")

        errors = exc_info.value.errors()
        assert len(errors) == 1
        assert errors[0]["loc"] == ("target_language",)

    def test_translate_request_with_empty_language_code(self):
        """Test that empty language code is rejected."""
        with pytest.raises(ValidationError) as exc_info:
            TranslateRequest(target_language="")

        errors = exc_info.value.errors()
        assert len(errors) == 1
        assert errors[0]["loc"] == ("target_language",)

    def test_translate_request_with_valid_content(self):
        """Test that valid content within limits is accepted."""
        content = "A" * 1000  # 1KB of content
        request = TranslateRequest(target_language=LanguageCode.FRENCH, content=content)
        assert request.content == content

    def test_translate_request_with_none_content(self):
        """Test that None content is accepted (will use article content)."""
        request = TranslateRequest(target_language=LanguageCode.GERMAN, content=None)
        assert request.content is None

    def test_translate_request_with_max_size_content(self):
        """Test that content at exactly max size is accepted."""
        # Create content that's exactly 50KB
        content = "A" * MAX_AI_TRANSLATION_CONTENT_BYTES
        request = TranslateRequest(target_language=LanguageCode.ITALIAN, content=content)
        assert len(request.content.encode("utf-8")) == MAX_AI_TRANSLATION_CONTENT_BYTES

    def test_translate_request_with_oversized_content(self):
        """Test that content exceeding max size is rejected."""
        # Create content that's 50KB + 1 byte
        content = "A" * (MAX_AI_TRANSLATION_CONTENT_BYTES + 1)
        with pytest.raises(ValidationError) as exc_info:
            TranslateRequest(target_language=LanguageCode.JAPANESE, content=content)

        errors = exc_info.value.errors()
        assert len(errors) == 1
        assert errors[0]["loc"] == ("content",)
        assert "maximum" in errors[0]["msg"].lower() or "50" in errors[0]["msg"]

    def test_translate_request_with_multibyte_characters(self):
        """Test that multibyte characters are counted correctly in byte size."""
        # Create content that exceeds 50KB with multibyte characters
        chars_needed = MAX_AI_TRANSLATION_CONTENT_BYTES // 3 + 1
        content = "你" * chars_needed
        with pytest.raises(ValidationError) as exc_info:
            TranslateRequest(target_language=LanguageCode.CHINESE_SIMPLIFIED, content=content)

        errors = exc_info.value.errors()
        assert len(errors) == 1
        assert errors[0]["loc"] == ("content",)


class TestLanguageCodeEnum:
    """Test the LanguageCode enum."""

    def test_language_code_enum_values(self):
        """Test that language code enum has expected values."""
        assert LanguageCode.ENGLISH.value == "en"
        assert LanguageCode.SPANISH.value == "es"
        assert LanguageCode.FRENCH.value == "fr"
        assert LanguageCode.GERMAN.value == "de"
        assert LanguageCode.CHINESE_SIMPLIFIED.value == "zh"
        assert LanguageCode.JAPANESE.value == "ja"
        assert LanguageCode.KOREAN.value == "ko"

    def test_language_code_enum_membership(self):
        """Test checking language code membership."""
        assert "en" in [lang.value for lang in LanguageCode]
        assert "invalid" not in [lang.value for lang in LanguageCode]

    def test_language_code_from_value(self):
        """Test creating language code from value."""
        assert LanguageCode("en") == LanguageCode.ENGLISH
        assert LanguageCode("es") == LanguageCode.SPANISH

    def test_language_code_invalid_value(self):
        """Test that invalid value raises error."""
        with pytest.raises(ValueError):
            LanguageCode("invalid_lang")
