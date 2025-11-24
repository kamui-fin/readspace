"""Shared utilities, enums, and generic models."""

from enum import Enum
from typing import Generic, TypeVar
from pydantic import BaseModel

T = TypeVar("T")


class PaginatedResponse(BaseModel, Generic[T]):
    """Generic wrapper for paginated lists."""

    items: list[T]
    total: int
    page: int
    size: int
    pages: int


# Re-export enums here to avoid circular imports in schema files
class ArticlePriority(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"


class FeedCategory(str, Enum):
    TECHNOLOGY = "Technology & Programming"
    CULTURE = "Culture & Arts"
    NEWS = "News & Politics"
    # ... (Add rest from your Enums file if needed for validation)
    MISC = "Miscellaneous"
