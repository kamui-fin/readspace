"""OPML import/export schema definitions."""

from datetime import datetime, timezone
from typing import Any

from pydantic import BaseModel, Field

from app.models.enums import ImportStatus


class OpmlImportResponse(BaseModel):
    """Response schema for OPML import endpoint."""

    task_id: str = Field(..., description="Celery task ID for tracking import progress")
    message: str = Field(..., description="Human-readable status message")
    estimated_feeds: int = Field(..., ge=0, description="Estimated number of feeds to import")


class OpmlTaskMetadata(BaseModel):
    """Metadata for OPML import tasks stored in Redis."""

    user_id: str = Field(..., description="User ID who owns this import task")
    task_id: str = Field(..., description="Celery task ID")
    estimated_feeds: int = Field(..., ge=0, description="Estimated number of feeds")
    filename: str = Field(..., description="Original filename of uploaded OPML")
    created_at: str = Field(..., description="ISO timestamp when task was created")
    status: ImportStatus = Field(..., description="Current task status")


class FeedImportError(BaseModel):
    """Error information for a failed feed import."""

    url: str = Field(..., description="Feed URL that failed")
    title: str = Field(..., description="Feed title or 'Unknown'")
    error: str = Field(..., description="Error message")
    status: str = Field(..., description="Error status code")


class OpmlImportProgress(BaseModel):
    """Progress information for active OPML imports."""

    completed: int = Field(..., ge=0, description="Number of feeds processed")
    total: int = Field(..., ge=0, description="Total number of feeds to process")
    successful: int = Field(..., ge=0, description="Number of successfully imported feeds")
    failed: int = Field(..., ge=0, description="Number of failed feed imports")
    already_existed: int = Field(..., ge=0, description="Number of feeds that already existed")
    skipped_limit: int = Field(0, ge=0, description="Number of feeds skipped due to subscription limit")


class OpmlImportState(OpmlImportProgress):
    """Complete state of an OPML import stored in Redis.

    Extends OpmlImportProgress with metadata and full state tracking.
    This is the single source of truth for import progress, stored under
    the key: opml_import_progress:{task_id}
    """

    # Metadata
    task_id: str = Field(..., description="Taskiq task ID")
    user_id: str = Field(..., description="User ID who owns this import")
    filename: str = Field(..., description="Original filename of uploaded OPML")
    created_at: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat(),
        description="ISO timestamp when task was created",
    )
    started_at: str | None = Field(None, description="ISO timestamp when processing started")
    completed_at: str | None = Field(None, description="ISO timestamp when processing completed")

    # Status
    status: ImportStatus = Field(
        default=ImportStatus.PENDING, description="Current status: pending, in_progress, completed, cancelled, failed"
    )

    # Additional counters that aren't part of the public progress interface?
    # Actually cancelled_count is internal detail but useful
    cancelled_count: int = Field(0, ge=0, description="Number of cancelled feed imports")

    # Errors
    errors: list[FeedImportError] = Field(default_factory=list, description="List of feed import errors")

    # Optional message
    message: str | None = Field(None, description="Status message")

    # Rename to disambiguate from the method names in previous version or keep them clean?
    # We'll use simple methods or properties if needed.

    def to_progress(self) -> OpmlImportProgress:
        """Convert to OpmlImportProgress response model (superclass)."""
        # Since it inherits, we can just dump and validate or manually construct
        return OpmlImportProgress(
            completed=self.completed,  # inherited fields
            total=self.total,
            successful=self.successful,
            failed=self.failed,
            already_existed=self.already_existed,
            skipped_limit=self.skipped_limit,
        )

    def to_result(self) -> "OpmlImportResult":
        """Convert to OpmlImportResult response model."""
        message = f"{self.successful} feeds added. {self.already_existed} were already in your library."
        if self.failed > 0:
            message += f" {self.failed} failed to import."
        if self.skipped_limit > 0:
            message += f" {self.skipped_limit} skipped due to subscription limit."
        if self.cancelled_count > 0:
            message += f" {self.cancelled_count} cancelled."

        errors_list = [error.model_dump() for error in self.errors] if self.errors else None

        return OpmlImportResult(
            imported_count=self.successful,
            failed_count=self.failed,
            already_existed_count=self.already_existed,
            skipped_limit_count=self.skipped_limit,
            total_feeds=self.total,
            summary={
                "successful": self.successful,
                "failed": self.failed,
                "already_existed": self.already_existed,
                "skipped_limit": self.skipped_limit,
            },
            message=message,
            errors=errors_list,
        )

    def to_metadata(self) -> OpmlTaskMetadata:
        """Convert to OpmlTaskMetadata response model."""
        return OpmlTaskMetadata(
            user_id=self.user_id,
            task_id=self.task_id,
            estimated_feeds=self.total,
            filename=self.filename,
            created_at=self.created_at,
            status=self.status,
        )


class OpmlImportResult(BaseModel):
    """Final result summary for completed OPML imports."""

    imported_count: int = Field(..., ge=0, description="Number of new feeds imported")
    failed_count: int = Field(..., ge=0, description="Number of feeds that failed to import")
    already_existed_count: int = Field(..., ge=0, description="Number of feeds that already existed")
    skipped_limit_count: int = Field(0, ge=0, description="Number of feeds skipped due to subscription limit")
    total_feeds: int = Field(..., ge=0, description="Total number of feeds processed")
    summary: dict[str, int] = Field(..., description="Summary breakdown of results")
    message: str = Field(..., description="Human-readable result summary")
    errors: list[dict[str, Any]] | None = Field(None, description="Detailed error information for failed imports")


class OpmlImportStatusResponse(BaseModel):
    """Response schema for import status endpoint."""

    task_id: str = Field(..., description="Celery task ID")
    status: ImportStatus = Field(..., description="Current status")
    message: str = Field(..., description="Human-readable status message")
    progress: OpmlImportProgress | None = Field(None, description="Progress information for active imports")
    result: OpmlImportResult | None = Field(None, description="Final results for completed imports")
    error: str | None = Field(None, description="Error message for failed imports")
    metadata: OpmlTaskMetadata | None = Field(None, description="Task metadata from Redis")


class OpmlImportCancelResponse(BaseModel):
    """Response schema for import cancellation endpoint."""

    task_id: str = Field(..., description="Celery task ID that was cancelled")
    message: str = Field(..., description="Human-readable cancellation message")
    cancelled: bool = Field(..., description="Whether the cancellation was successful")
    previous_state: ImportStatus | None = Field(None, description="Previous task state if already completed")
