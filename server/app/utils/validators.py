"""
Input validation utilities
"""

import re
from datetime import datetime, timezone
from urllib.parse import urlparse
from uuid import UUID

from app.core.constants import (
    ALLOWED_BOOK_FORMATS,
    ARTICLE_PRIORITIES,
    HIGHLIGHT_COLORS,
    MAX_DESCRIPTION_LENGTH,
    MAX_FOLDER_NAME_LENGTH,
    MAX_PAGE_SIZE,
    MAX_TAG_NAME_LENGTH,
    MAX_TITLE_LENGTH,
    MAX_URL_LENGTH,
)
from app.core.custom_exceptions import ValidationError

# Precompiled regex patterns
EMAIL_PATTERN = re.compile(r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$")
TAG_NAME_PATTERN = re.compile(r"^[a-z0-9_-]+$")


def validate_url(url: str, required: bool = True) -> str | None:
    """
    Validate URL format and scheme

    Args:
        url: URL string to validate
        required: Whether URL is required (raises error if None/empty)

    Returns:
        Validated URL string or None

    Raises:
        ValidationError: If URL is invalid
    """
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


def validate_email(email: str) -> str:
    """
    Validate email format

    Args:
        email: Email string to validate

    Returns:
        Validated email string

    Raises:
        ValidationError: If email is invalid
    """
    if not email:
        raise ValidationError("Email is required")

    if not EMAIL_PATTERN.match(email):
        raise ValidationError("Invalid email format")

    return email.lower()


def validate_uuid(uuid_str: str, field_name: str = "ID") -> UUID:
    """
    Validate UUID format

    Args:
        uuid_str: UUID string to validate
        field_name: Name of the field for error messages

    Returns:
        UUID object

    Raises:
        ValidationError: If UUID is invalid
    """
    if not uuid_str:
        raise ValidationError(f"{field_name} is required")

    try:
        return UUID(uuid_str)
    except (ValueError, TypeError) as e:
        raise ValidationError(f"Invalid {field_name} format") from e


def validate_string_length(
    value: str,
    field_name: str,
    max_length: int,
    min_length: int = 0,
    required: bool = True,
) -> str | None:
    """
    Validate string length constraints

    Args:
        value: String to validate
        field_name: Name of the field for error messages
        max_length: Maximum allowed length
        min_length: Minimum required length
        required: Whether the field is required

    Returns:
        Validated string or None

    Raises:
        ValidationError: If string violates length constraints
    """
    if not value:
        if required:
            raise ValidationError(f"{field_name} is required")
        return None

    if len(value) < min_length:
        raise ValidationError(f"{field_name} must be at least {min_length} characters")

    if len(value) > max_length:
        raise ValidationError(f"{field_name} must be at most {max_length} characters")

    return value.strip()


def validate_title(title: str, required: bool = True) -> str | None:
    """Validate title field"""
    return validate_string_length(title, "Title", MAX_TITLE_LENGTH, 1, required)


def validate_description(description: str, required: bool = False) -> str | None:
    """Validate description field"""
    return validate_string_length(description, "Description", MAX_DESCRIPTION_LENGTH, 0, required)


def validate_tag_name(name: str) -> str:
    """Validate tag name"""
    validated = validate_string_length(name, "Tag name", MAX_TAG_NAME_LENGTH, 1, True)

    if validated is None:
        raise ValidationError("Tag name cannot be empty")

    # Tag names should be lowercase and alphanumeric with hyphens/underscores
    if not TAG_NAME_PATTERN.match(validated.lower()):
        raise ValidationError("Tag name can only contain lowercase letters, numbers, hyphens, and underscores")

    return validated.lower()


def validate_folder_name(name: str) -> str:
    """Validate folder name"""
    validated = validate_string_length(name, "Folder name", MAX_FOLDER_NAME_LENGTH, 1, True)
    if validated is None:
        raise ValidationError("Folder name cannot be empty")
    return validated


def validate_book_format(format_str: str) -> str:
    """
    Validate book format

    Args:
        format_str: Book format string

    Returns:
        Validated format string

    Raises:
        ValidationError: If format is not supported
    """
    if not format_str:
        raise ValidationError("Book format is required")

    format_upper = format_str.upper()
    if format_upper not in ALLOWED_BOOK_FORMATS:
        raise ValidationError(f"Unsupported book format. Allowed: {', '.join(ALLOWED_BOOK_FORMATS)}")

    return format_upper


def validate_highlight_color(color: str) -> str:
    """
    Validate highlight color

    Args:
        color: Color string

    Returns:
        Validated color string

    Raises:
        ValidationError: If color is not supported
    """
    if not color:
        raise ValidationError("Highlight color is required")

    color_lower = color.lower()
    if color_lower not in HIGHLIGHT_COLORS:
        raise ValidationError(f"Invalid highlight color. Allowed: {', '.join(HIGHLIGHT_COLORS)}")

    return color_lower


def validate_article_priority(priority: str) -> str:
    """
    Validate article priority

    Args:
        priority: Priority string

    Returns:
        Validated priority string

    Raises:
        ValidationError: If priority is not supported
    """
    if not priority:
        raise ValidationError("Article priority is required")

    priority_lower = priority.lower()
    if priority_lower not in ARTICLE_PRIORITIES:
        raise ValidationError(f"Invalid priority. Allowed: {', '.join(ARTICLE_PRIORITIES)}")

    return priority_lower


def validate_datetime(dt_str: str, field_name: str = "datetime") -> datetime:
    """
    Validate and parse datetime string

    Args:
        dt_str: Datetime string (ISO format)
        field_name: Name of the field for error messages

    Returns:
        Parsed datetime object with timezone info

    Raises:
        ValidationError: If datetime format is invalid
    """
    if not dt_str:
        raise ValidationError(f"{field_name} is required")

    try:
        # Try parsing ISO format
        dt = datetime.fromisoformat(dt_str.replace("Z", "+00:00"))

        # Ensure timezone is set
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)

        return dt
    except (ValueError, TypeError) as e:
        raise ValidationError(f"Invalid {field_name} format: {str(e)}") from e


def validate_pagination(skip: int = 0, limit: int = 100) -> tuple[int, int]:
    """
    Validate pagination parameters

    Args:
        skip: Number of items to skip
        limit: Maximum number of items to return

    Returns:
        Tuple of (validated_skip, validated_limit)

    Raises:
        ValidationError: If pagination parameters are invalid
    """
    if skip < 0:
        raise ValidationError("Skip parameter must be non-negative")

    if limit < 1:
        raise ValidationError("Limit parameter must be positive")

    if limit > MAX_PAGE_SIZE:
        raise ValidationError(f"Limit parameter too large (max {MAX_PAGE_SIZE})")

    return skip, limit
