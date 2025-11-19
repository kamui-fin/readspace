"""Shared utilities for article operations."""

import pytz
import structlog
from fastapi import HTTPException, status

logger = structlog.get_logger(__name__)


def validate_timezone(timezone: str | None) -> str | None:
    """Validate timezone against IANA timezone database.

    Args:
        timezone: Timezone string to validate (e.g., 'America/New_York')

    Returns:
        The validated timezone string or None if input was None

    Raises:
        HTTPException: If timezone is not a valid IANA timezone
    """
    if timezone is None:
        return None

    if timezone not in pytz.all_timezones_set:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Invalid timezone '{timezone}'. Must be a valid IANA timezone "
                f"(e.g., 'America/New_York', 'Europe/London', 'Asia/Tokyo'). "
                f"See https://en.wikipedia.org/wiki/List_of_tz_database_time_zones for valid values."
            ),
        )
    return timezone
