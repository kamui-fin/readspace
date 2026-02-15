"""User/Profile models - pure SQLAlchemy."""

from sqlalchemy import Column, DateTime, ForeignKey, Text
from sqlalchemy import Enum as SQLEnum
from sqlalchemy.dialects.postgresql import UUID as SQLUUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.base_class import Base
from app.models.enums import UserRole


class AuthUser(Base):
    """Auth schema user table (managed by Supabase)."""

    __tablename__ = "users"
    __table_args__ = {"schema": "auth", "keep_existing": True}

    id = Column(SQLUUID(as_uuid=True), primary_key=True)


class Profile(Base):
    """Public profile table for application users."""

    __tablename__ = "profiles"

    id = Column(SQLUUID(as_uuid=True), ForeignKey(AuthUser.id, ondelete="CASCADE"), primary_key=True)
    email = Column(Text, nullable=False)
    role = Column(SQLEnum(UserRole, name="userrole"), nullable=False, server_default="BASIC")
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    # Relationships
    folders = relationship("Folder", back_populates="user")
    subscriptions = relationship("FeedSubscription", back_populates="user")
    entries = relationship("UserEntry", back_populates="user")
