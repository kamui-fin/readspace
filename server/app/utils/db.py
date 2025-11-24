"""
SQLAlchemy query builder helpers.
"""

from sqlalchemy import or_
from sqlalchemy.orm import InstrumentedAttribute
from sqlalchemy.sql import Select


def apply_boolean_filter(
    stmt: Select,
    field: InstrumentedAttribute,
    value: bool,
) -> Select:
    """
    Apply a boolean filter that handles NULL states appropriately.
    
    - If value=True: filters where field IS True
    - If value=False: filters where field IS False OR field IS NULL
    
    Useful for tristate flags (read/unread, etc).
    """
    if value:
        return stmt.filter(field.is_(True))
    else:
        return stmt.filter(or_(field.is_(None), field.is_(False)))