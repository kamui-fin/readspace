import re
from uuid import UUID

from app.core.constants import (
    MAX_FOLDER_NAME_LENGTH,
    MAX_PAGE_SIZE,
    MAX_URL_LENGTH,
)
from app.core.custom_exceptions import ValidationError

# Pre-compiled regex for performance
EMAIL_PATTERN = re.compile(r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$")
TAG_NAME_PATTERN = re.compile(r"^[a-z0-9_-]+$")
FOLDER_NAME_PATTERN = re.compile(r"^[\w\s\-_()\[\].]+$", re.UNICODE)


def validate_url_format(url: str, required: bool = True) -> str | None:
    """Basic syntax check for URLs."""
    if not url:
        if required:
            raise ValidationError("URL is required")
        return None

    if len(url) > MAX_URL_LENGTH:
        raise ValidationError(f"URL too long (max {MAX_URL_LENGTH})")

    # Simple regex check is often faster/safer than urlparse for basic format
    if not url.startswith(("http://", "https://", "rsshub://")):
        raise ValidationError("Invalid URL format: must start with http, https, or rsshub")

    return url


def validate_email(email: str) -> str:
    if not email:
        raise ValidationError("Email is required")
    if not EMAIL_PATTERN.match(email):
        raise ValidationError("Invalid email format")
    return email.lower()


def validate_folder_name(name: str) -> str:
    if not name or not name.strip():
        raise ValidationError("Folder name cannot be empty")
    name = name.strip()
    if len(name) > MAX_FOLDER_NAME_LENGTH:
        raise ValidationError(f"Folder name too long (max {MAX_FOLDER_NAME_LENGTH})")
    if not FOLDER_NAME_PATTERN.match(name):
        raise ValidationError("Folder name contains invalid characters")
    return name


def validate_uuid(uuid_str: str, field_name: str = "ID") -> UUID:
    if not uuid_str:
        raise ValidationError(f"{field_name} is required")
    try:
        return UUID(uuid_str)
    except ValueError as e:
        raise ValidationError(f"Invalid {field_name} format") from e


def validate_pagination(skip: int = 0, limit: int = 100) -> tuple[int, int]:
    if skip < 0:
        raise ValidationError("Skip must be non-negative")
    if limit < 1:
        raise ValidationError("Limit must be positive")
    if limit > MAX_PAGE_SIZE:
        raise ValidationError(f"Limit too large (max {MAX_PAGE_SIZE})")
    return skip, limit
