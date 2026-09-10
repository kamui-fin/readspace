"""Codex Digest model - one row per user per local day per edition."""

from sqlalchemy import Column, Date, DateTime, ForeignKey, Integer, SmallInteger, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as SQLUUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.base_class import Base
from app.models.enums import CodexDigestStatus


class CodexDigest(Base):
    """A generated daily digest for a single user, covering a rolling 24h window.

    ``digest_date`` is the reader's *local* calendar day (supplied by the client on
    generate), used purely as the quota bucket - the content window is always the last
    ``window_hours`` from ``requested_at``. ``edition`` (1-based) lets a user hold more
    than one digest for the same local day (Pro: 2, Basic: 1).
    """

    __tablename__ = "codex_digests"

    id = Column(SQLUUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    user_id = Column(
        SQLUUID(as_uuid=True),
        ForeignKey("profiles.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    digest_date = Column(Date, nullable=False)
    edition = Column(SmallInteger, nullable=False, default=1, server_default="1")
    status = Column(
        String(20),
        nullable=False,
        default=CodexDigestStatus.PENDING.value,
        server_default=CodexDigestStatus.PENDING.value,
    )
    # Which pipeline phase an IN_PROGRESS digest is in - see CodexDigestPhase. Null before the
    # worker picks the task up; left at its last value once a status is terminal.
    progress_phase = Column(String(20), nullable=True)

    requested_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    generated_at = Column(DateTime(timezone=True), nullable=True)

    model = Column(String(100), nullable=True)
    window_hours = Column(Integer, nullable=True)

    input_article_count = Column(Integer, nullable=True)
    input_source_count = Column(Integer, nullable=True)
    clusters_found = Column(Integer, nullable=True)

    payload = Column(JSONB, nullable=True)
    error = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())

    user = relationship("Profile")

    __table_args__ = (UniqueConstraint("user_id", "digest_date", "edition", name="uq_codex_digest_user_date_edition"),)
