"""
Schemas for AI and scraping enhancements.
"""

from pydantic import BaseModel, Field, field_validator, ConfigDict
from .common import LanguageCode

# Constants (Move these to app/core/constants.py in a real app)
MAX_SUMMARIZATION_BYTES = 100 * 1024  # 100KB
MAX_TRANSLATION_BYTES = 50 * 1024  # 50KB

# ================= Extraction =================


class ExtractionResponse(BaseModel):
    """
    Result of a full-text extraction job.
    """

    content: str | None = None
    estimated_read_time_minutes: int | None = None

    # If extraction failed but we want to return partial data/metadata,
    # we can keep content as None. HTTP 422/500 handles hard failures.


# ================= Summarization =================


class SummarizeRequest(BaseModel):
    """
    Request payload.
    If `content` is omitted, the backend uses the Entry's stored content.
    """

    content: str | None = Field(None, description="Override content to summarize. If None, uses article content.")

    # Optional: Allow user to specify length/format
    # format: Literal["bullet_points", "paragraph"] = "paragraph"

    @field_validator("content")
    @classmethod
    def validate_size(cls, v: str | None) -> str | None:
        if not v:
            return v

        # Check byte size, not just character length
        size = len(v.encode("utf-8"))
        if size > MAX_SUMMARIZATION_BYTES:
            raise ValueError(
                f"Content too large ({size / 1024:.1f}KB). Max allowed is {MAX_SUMMARIZATION_BYTES / 1024}KB."
            )
        return v


class SummarizeResponse(BaseModel):
    summary: str


# ================= Translation =================


class TranslateRequest(BaseModel):
    target_language: LanguageCode
    content: str | None = Field(None, description="Override content to translate. If None, uses article content.")

    @field_validator("content")
    @classmethod
    def validate_size(cls, v: str | None) -> str | None:
        if not v:
            return v

        size = len(v.encode("utf-8"))
        if size > MAX_TRANSLATION_BYTES:
            raise ValueError(
                f"Content too large ({size / 1024:.1f}KB). Max allowed is {MAX_TRANSLATION_BYTES / 1024}KB."
            )
        return v


class TranslateResponse(BaseModel):
    translated_content: str
    source_language: str | None = None  # Useful to return what AI detected
    target_language: LanguageCode
