"""Query builder helper utilities for SQLAlchemy queries."""

from sqlalchemy import or_
from sqlalchemy.orm import InstrumentedAttribute
from sqlalchemy.sql import Select


def apply_boolean_filter(
    stmt: Select,
    field: InstrumentedAttribute,
    value: bool,
) -> Select:
    """Apply a boolean filter that handles NULL states appropriately.

    When value is True, only show records explicitly marked as True.
    When value is False, show records that are either NULL or explicitly False.

    This is useful for filtering user-specific states like is_read, is_favorite,
    is_read_later, etc., where the absence of a record (NULL) should be treated
    as False.

    Args:
        stmt: The SQLAlchemy Select statement to filter
        field: The boolean field to filter on
        value: The filter value (True or False)

    Returns:
        The filtered Select statement

    Example:
        >>> stmt = select(Article)
        >>> stmt = apply_boolean_filter(stmt, UserArticleState.is_read, False)
        # Returns articles that are either not tracked (NULL) or explicitly unread
    """
    if value:
        # Only show records explicitly marked as True
        return stmt.filter(field.is_(True))
    else:
        # Show records that are either NULL or explicitly False
        return stmt.filter(or_(field.is_(None), field.is_(False)))
