from datetime import datetime
from enum import Enum

from app.db.base_class import Base
from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Text
from sqlalchemy import Enum as SQLEnum
from sqlalchemy.dialects.postgresql import UUID as PGUUID


class FeedbackType(str, Enum):
    BUG = "bug"
    SUGGESTION = "suggestion"
    CONFUSING = "confusing"
    OTHER = "other"


class Feedback(Base):
    __tablename__ = "feedback"

    id = Column(PGUUID, primary_key=True, server_default="gen_random_uuid()")
    user_id = Column(
        PGUUID, ForeignKey("auth.users", ondelete="SET NULL"), nullable=True
    )

    feedback_type = Column(SQLEnum(FeedbackType), nullable=False)
    description = Column(Text, nullable=False)
    allow_follow_up = Column(Boolean, nullable=False, default=False)

    created_at = Column(
        DateTime(timezone=True), nullable=False, default=datetime.utcnow
    )
