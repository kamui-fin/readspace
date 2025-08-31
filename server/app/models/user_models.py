from datetime import datetime, timezone
from enum import Enum

from sqlalchemy import Column, DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID as PGUUID

from app.db.base_class import Base


class UserRole(str, Enum):
    BASIC = "basic"
    PRO = "pro"
    ADMIN = "admin"


class AuthUser(Base):
    __tablename__ = "users"
    __table_args__ = {"schema": "auth", "keep_existing": True}

    id = Column(PGUUID, primary_key=True)


class Profile(Base):
    __tablename__ = "profiles"

    id = Column(PGUUID, ForeignKey(AuthUser.id, ondelete="CASCADE"), primary_key=True)
    email = Column(Text, nullable=False)
    role = Column(String(10), nullable=False, default=UserRole.BASIC.value)
    created_at = Column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
