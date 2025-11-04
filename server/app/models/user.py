from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, ForeignKey, Text
from sqlalchemy import Enum as SQLEnum
from sqlalchemy.dialects.postgresql import UUID as PGUUID

from app.db.base_class import Base
from app.models.enums import UserRole


class AuthUser(Base):
    __tablename__ = "users"
    __table_args__ = {"schema": "auth", "keep_existing": True}

    id = Column(PGUUID, primary_key=True)


class Profile(Base):
    __tablename__ = "profiles"

    id = Column(PGUUID, ForeignKey(AuthUser.id, ondelete="CASCADE"), primary_key=True)
    email = Column(Text, nullable=False)
    role = Column(SQLEnum(UserRole, name="userrole"), nullable=False, default=UserRole.BASIC)
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
