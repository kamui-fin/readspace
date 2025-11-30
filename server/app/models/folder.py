"""Folder model - pure SQLAlchemy."""

from sqlalchemy import Column, DateTime, ForeignKey, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as SQLUUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.base_class import Base


class Folder(Base):
    """User folder for organizing feed subscriptions."""

    __tablename__ = "folders"

    id = Column(
        SQLUUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid()
    )
    name = Column(Text, nullable=False)
    user_id = Column(
        SQLUUID(as_uuid=True),
        ForeignKey("profiles.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    created_at = Column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    # Relationships
    user = relationship("Profile", back_populates="folders")
    subscriptions = relationship(
        "FeedSubscription",
        back_populates="folder",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

    __table_args__ = (
        UniqueConstraint("user_id", "name", name="uq_folder_user_name"),
        # CHECK constraint: ck_folder_name_not_empty (enforced at DB level)
    )
