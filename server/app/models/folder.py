"""Folder model definition."""

import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, ForeignKey, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as SQLUUID

from app.db.base_class import Base


class Folder(Base):
    """User folder for organizing feed subscriptions."""

    __tablename__ = "folders"

    id = Column(SQLUUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    # CHECK constraint ensures name is not empty (enforced at database level)
    name = Column(String(255), nullable=False)
    user_id = Column(
        SQLUUID(as_uuid=True),
        ForeignKey("profiles.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        # UNIQUE constraint ensures one folder name per user
        UniqueConstraint("user_id", "name", name="uq_folder_user_name"),
        # CHECK constraint added in migration: ck_folder_name_not_empty
        # Ensures name <> '' AND name IS NOT NULL
    )
