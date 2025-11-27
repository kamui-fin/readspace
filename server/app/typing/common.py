"""Shared utilities, enums, and generic models."""

from enum import Enum
from typing import Generic, TypeVar

from pydantic import BaseModel, ConfigDict

# Re-export enums from models for convenience

T = TypeVar("T")


class PaginatedResponse(BaseModel, Generic[T]):
    """Generic wrapper for paginated lists."""

    items: list[T]
    total: int
    page: int
    size: int
    pages: int


class CursorPaginatedResponse(BaseModel, Generic[T]):
    """Generic wrapper for cursor-based pagination."""

    items: list[T]
    next_cursor: str | None = None
    has_more: bool = False
    total_count: int | None = None


class ImportStatus(str, Enum):
    """Status of an OPML import task."""

    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"
    UNKNOWN = "unknown"


class LanguageCode(str, Enum):
    """ISO 639-1 language codes supported for translation."""

    EN = "en"  # English
    ES = "es"  # Spanish
    FR = "fr"  # French
    DE = "de"  # German
    IT = "it"  # Italian
    PT = "pt"  # Portuguese
    RU = "ru"  # Russian
    JA = "ja"  # Japanese
    KO = "ko"  # Korean
    ZH = "zh"  # Chinese (Simplified)
    AR = "ar"  # Arabic
    HI = "hi"  # Hindi
    NL = "nl"  # Dutch
    SV = "sv"  # Swedish
    NO = "no"  # Norwegian
    DA = "da"  # Danish
    FI = "fi"  # Finnish
    PL = "pl"  # Polish
    TR = "tr"  # Turkish
    TH = "th"  # Thai
    VI = "vi"  # Vietnamese


# Shared config for response models
response_config = ConfigDict(from_attributes=True)
