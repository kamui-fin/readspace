"""OPML import/export schema definitions."""

from datetime import datetime, timezone
from typing import Any, Optional

from pydantic import BaseModel, Field, computed_field

from app.typing.common import ImportStatus


class OpmlTaskMetadata(BaseModel):
    """Metadata for OPML import tasks."""
    user_id: str
    task_id: str
    estimated_feeds: int = Field(ge=0)
    filename: str
    opml_title: str | None = Field(None, description="Title extracted from OPML meta")
    opml_author: str | None = Field(None, description="Author extracted from OPML meta")
    created_at: str
    status: ImportStatus


class FeedImportError(BaseModel):
    """Error information for a failed feed import."""
    url: str
    title: str = "Unknown"
    error: str
    status: str


class OpmlImportProgress(BaseModel):
    """Progress counters."""
    completed: int = Field(0, ge=0)
    total: int = Field(0, ge=0)
    successful: int = Field(0, ge=0)
    failed: int = Field(0, ge=0)
    already_existed: int = Field(0, ge=0)
    skipped_limit: int = Field(0, ge=0)


class OpmlImportState(OpmlImportProgress):
    """
    Complete state of an OPML import stored in Redis.
    Source of truth for: opml_import_progress:{task_id}
    """
    task_id: str
    user_id: str
    filename: str
    opml_title: str | None = None
    opml_author: str | None = None
    status: ImportStatus = ImportStatus.PENDING
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    started_at: str | None = None
    completed_at: str | None = None
    cancelled_count: int = Field(0, ge=0)
    message: str | None = None
    errors: list[FeedImportError] = Field(default_factory=list)

    @computed_field
    def progress_percentage(self) -> int:
        if self.total == 0:
            return 0
        return int((self.completed / self.total) * 100)

    def to_metadata(self) -> OpmlTaskMetadata:
        return OpmlTaskMetadata(
            user_id=self.user_id,
            task_id=self.task_id,
            estimated_feeds=self.total,
            filename=self.filename,
            opml_title=self.opml_title,
            opml_author=self.opml_author,
            created_at=self.created_at,
            status=self.status,
        )

    def to_result(self) -> "OpmlImportResult":
        """Generates the final summary result."""
        msg = (
            f"{self.successful} feeds added. "
            f"{self.already_existed} pre-existing. "
            f"{self.failed} failed."
        )
        if self.skipped_limit > 0:
            msg += f" {self.skipped_limit} skipped (limit reached)."
            
        return OpmlImportResult(
            # Pass all fields from self (OpmlImportProgress)
            **self.model_dump(include=OpmlImportProgress.model_fields.keys()),
            total_feeds=self.total,
            message=self.message or msg,
            errors=[e.model_dump() for e in self.errors] if self.errors else None,
        )


class OpmlImportResult(OpmlImportProgress):
    """Final result summary."""
    total_feeds: int
    message: str
    errors: list[dict[str, Any]] | None = None


class OpmlImportStatusResponse(BaseModel):
    """API Response for status polling."""
    task_id: str
    status: ImportStatus
    message: str
    progress: Optional[OpmlImportProgress] = None
    result: Optional[OpmlImportResult] = None
    error: Optional[str] = None
    metadata: Optional[OpmlTaskMetadata] = None


class OpmlImportCancelResponse(BaseModel):
    """API Response for cancellation."""
    task_id: str
    message: str
    cancelled: bool
    previous_state: Optional[ImportStatus] = None