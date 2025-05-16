from datetime import datetime

from app.db.base_class import Base
from sqlalchemy import Column, DateTime, Text
from sqlalchemy.dialects.postgresql import UUID as PGUUID


class Profile(Base):
    __tablename__ = "profiles"

    id = Column(PGUUID, primary_key=True)
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
