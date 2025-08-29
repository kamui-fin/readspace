from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID as PGUUID

from app.db.base_class import Base


class AuthUser(Base):
    __tablename__ = "users"
    __table_args__ = {"schema": "auth", "keep_existing": True}

    id = Column(PGUUID, primary_key=True)


class Profile(Base):
    __tablename__ = "profiles"

    id = Column(PGUUID, ForeignKey(AuthUser.id, ondelete="CASCADE"), primary_key=True)
    email = Column(Text, nullable=False)
    created_at = Column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
