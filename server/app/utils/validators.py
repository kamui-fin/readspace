"""
Input validation utilities for API models.
"""

import re
from datetime import datetime, timezone
from urllib.parse import urlparse
from uuid import UUID

from app.core.constants import (
    ARTICLE_PRIORITIES,
    HIGHLIGHT_COLORS,
    MAX_FOLDER_NAME_LENGTH,
    MAX_PAGE_SIZE,
    MAX_TAG_NAME_LENGTH,
    MAX_TITLE_LENGTH,
    MAX_URL_LENGTH,
)
from app.core.custom_exceptions import ValidationError

# --- Regex Patterns ---
EMAIL_PATTERN = re.compile(r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$")
TAG_NAME_PATTERN = re.compile(r"^[a-z0-9_-]+$")
# Allows Unicode letters/nums, spaces, hyphens, brackets. No control chars.
FOLDER_NAME_PATTERN = re.compile(r"^[\w\s\-_()\[\].]+$", re.UNICODE)


def validate_url(url: str, required: bool = True) -> str | None:
    """Basic format validation for URLs."""
    if not url:
        if required:
            raise ValidationError("URL is required")
        return None

    if len(url) > MAX_URL_LENGTH:
        raise ValidationError(f"URL too long (max {MAX_URL_LENGTH} characters)")

    try:
        parsed = urlparse(url)
        if not parsed.scheme or not parsed.netloc:
            raise ValidationError("Invalid URL format")
        if parsed.scheme not in ["http", "https"]:
            raise ValidationError("URL must use HTTP or HTTPS scheme")
        return url
    except Exception as e:
        raise ValidationError(f"Invalid URL: {str(e)}") from e


def validate_folder_name(name: str) -> str:
    """Strict folder name validation."""
    if not name or not name.strip():
        raise ValidationError("Folder name cannot be empty")

    name = name.strip()

    if len(name) > MAX_FOLDER_NAME_LENGTH:
        raise ValidationError(f"Folder name must be {MAX_FOLDER_NAME_LENGTH} characters or less")

    if not FOLDER_NAME_PATTERN.match(name):
        raise ValidationError(
            "Folder name contains invalid characters. Allowed: letters, numbers, "
            "spaces, hyphens, underscores, brackets, and periods."
        )

    return name


def validate_email(email: str) -> str:
    if not email:
        raise ValidationError("Email is required")
    if not EMAIL_PATTERN.match(email):
        raise ValidationError("Invalid email format")
    return email.lower()


def validate_uuid(uuid_str: str, field_name: str = "ID") -> UUID:
    if not uuid_str:
        raise ValidationError(f"{field_name} is required")
    try:
        return UUID(uuid_str)
    except (ValueError, TypeError) as e:
        raise ValidationError(f"Invalid {field_name} format") from e


def validate_title(title: str, required: bool = True) -> str | None:
    if not title:
        if required:
            raise ValidationError("Title is required")
        return None
    if len(title) > MAX_TITLE_LENGTH:
        raise ValidationError(f"Title must be at most {MAX_TITLE_LENGTH} characters")
    return title.strip()


def validate_tag_name(name: str) -> str:
    if not name or len(name) > MAX_TAG_NAME_LENGTH:
        raise ValidationError(f"Tag name invalid (max {MAX_TAG_NAME_LENGTH} chars)")

    name_lower = name.lower().strip()
    if not TAG_NAME_PATTERN.match(name_lower):
        raise ValidationError("Tag name can only contain lowercase letters, numbers, hyphens, and underscores")

    return name_lower


def validate_highlight_color(color: str) -> str:
    if not color:
        raise ValidationError("Highlight color is required")
    color_lower = color.lower()
    if color_lower not in HIGHLIGHT_COLORS:
        raise ValidationError(f"Invalid highlight color. Allowed: {', '.join(HIGHLIGHT_COLORS)}")
    return color_lower


def validate_article_priority(priority: str) -> str:
    if not priority:
        raise ValidationError("Article priority is required")
    priority_lower = priority.lower()
    if priority_lower not in ARTICLE_PRIORITIES:
        raise ValidationError(f"Invalid priority. Allowed: {', '.join(ARTICLE_PRIORITIES)}")
    return priority_lower


def validate_datetime(dt_str: str, field_name: str = "datetime") -> datetime:
    if not dt_str:
        raise ValidationError(f"{field_name} is required")
    try:
        dt = datetime.fromisoformat(dt_str.replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except (ValueError, TypeError) as e:
        raise ValidationError(f"Invalid {field_name} format: {str(e)}") from e


def validate_pagination(skip: int = 0, limit: int = 100) -> tuple[int, int]:
    if skip < 0:
        raise ValidationError("Skip parameter must be non-negative")
    if limit < 1:
        raise ValidationError("Limit parameter must be positive")
    if limit > MAX_PAGE_SIZE:
        raise ValidationError(f"Limit parameter too large (max {MAX_PAGE_SIZE})")
    return skip, limit
