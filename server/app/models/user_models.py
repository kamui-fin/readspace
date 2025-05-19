from datetime import datetime

from app.db.base_class import Base
from sqlalchemy import Column, DateTime, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import declarative_base

AuthBase = declarative_base()

class AuthUser(AuthBase):
    __tablename__ = "users"
    __table_args__ = {"schema": "auth"}

    id = Column(PGUUID, primary_key=True)

class Profile(Base):
    __tablename__ = "profiles"

    id = Column(PGUUID, ForeignKey(AuthUser.id, ondelete="CASCADE"), primary_key=True)
    email = Column(Text, nullable=False)
    created_at = Column(
        DateTime(timezone=True), nullable=False, default=datetime.utcnow
    )
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )
