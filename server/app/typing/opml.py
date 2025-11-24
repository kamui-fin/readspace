"""OPML import/export schema definitions."""

from datetime import datetime, timezone
from typing import Any

from pydantic import AnyUrl, BaseModel, Field


class OpmlImportRequest(BaseModel):
    """Request schema for OPML import."""

    opml_content: str


class OpmlOutline(BaseModel):
    """Schema for OPML outline/feed entry."""

    text: str | None = None
    title: str | None = None
    type: str | None = None
    xmlUrl: AnyUrl | None = None  # noqa: N815
    htmlUrl: AnyUrl | None = None  # noqa: N815
    # For nested outlines/folders
    children: list["OpmlOutline"] | None = None


class OpmlExport(BaseModel):
    """Schema for OPML export content."""

    opml_content: str


class OpmlImportResponse(BaseModel):
    """Response schema for OPML import endpoint."""

    processing_mode: str = Field(..., description="Processing mode: 'background' for async processing")
    task_id: str = Field(..., description="Celery task ID for tracking import progress")
    message: str = Field(..., description="Human-readable status message")
    estimated_feeds: int = Field(..., ge=0, description="Estimated number of feeds to import")
    check_status_url: str = Field(..., description="API endpoint to check import status")
    status_page_url: str = Field(..., description="Frontend URL to view import progress")


class OpmlTaskMetadata(BaseModel):
    """Metadata for OPML import tasks stored in Redis."""

    user_id: str = Field(..., description="User ID who owns this import task")
    task_id: str = Field(..., description="Celery task ID")
    estimated_feeds: int = Field(..., ge=0, description="Estimated number of feeds")
    filename: str = Field(..., description="Original filename of uploaded OPML")
    created_at: str = Field(..., description="ISO timestamp when task was created")
    status: str = Field(..., description="Current task status")
    current_status: str | None = Field(None, description="Real-time status from Celery")


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


class OpmlImportState(BaseModel):
    """Complete state of an OPML import stored in Redis.

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
    status: str = Field(
        default="pending", description="Current status: pending, in_progress, completed, cancelled, failed"
    )

    # Progress counters
    total_feeds: int = Field(..., ge=0, description="Total number of feeds to import")
    completed_feeds: int = Field(0, ge=0, description="Number of feeds processed")
    successful_imports: int = Field(0, ge=0, description="Number of successfully imported feeds")
    failed_imports: int = Field(0, ge=0, description="Number of failed imports")
    already_existed: int = Field(0, ge=0, description="Number of feeds that already existed")
    skipped_limit: int = Field(0, ge=0, description="Number of feeds skipped due to subscription limit")
    cancelled_count: int = Field(0, ge=0, description="Number of cancelled feed imports")

    # Errors
    errors: list[FeedImportError] = Field(default_factory=list, description="List of feed import errors")

    # Optional message
    message: str | None = Field(None, description="Status message")

    def to_progress(self) -> OpmlImportProgress:
        """Convert to OpmlImportProgress response model."""
        return OpmlImportProgress(
            completed=self.completed_feeds,
            total=self.total_feeds,
            successful=self.successful_imports,
            failed=self.failed_imports,
            already_existed=self.already_existed,
            skipped_limit=self.skipped_limit,
        )

    def to_result(self) -> "OpmlImportResult":
        """Convert to OpmlImportResult response model."""
        message = f"{self.successful_imports} feeds added. {self.already_existed} were already in your library."
        if self.failed_imports > 0:
            message += f" {self.failed_imports} failed to import."
        if self.skipped_limit > 0:
            message += f" {self.skipped_limit} skipped due to subscription limit."
        if self.cancelled_count > 0:
            message += f" {self.cancelled_count} cancelled."

        # Convert errors list to dict format, or None if empty
        # self.errors is always a list due to default_factory=list
        errors_list: list[FeedImportError] = self.errors
        error_list = [error.model_dump() for error in errors_list] if errors_list else []
        errors_output = error_list if error_list else None

        return OpmlImportResult(
            imported_count=self.successful_imports,
            failed_count=self.failed_imports,
            already_existed_count=self.already_existed,
            skipped_limit_count=self.skipped_limit,
            total_feeds=self.total_feeds,
            summary={
                "successful": self.successful_imports,
                "failed": self.failed_imports,
                "already_existed": self.already_existed,
                "skipped_limit": self.skipped_limit,
            },
            message=message,
            errors=errors_output,
        )

    def to_metadata(self) -> "OpmlTaskMetadata":
        """Convert to OpmlTaskMetadata response model."""
        return OpmlTaskMetadata(
            user_id=self.user_id,
            task_id=self.task_id,
            estimated_feeds=self.total_feeds,
            filename=self.filename,
            created_at=self.created_at,
            status=self.status,
            current_status=self.status,
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
    status: str = Field(..., description="Current status: pending, in_progress, completed, failed")
    message: str = Field(..., description="Human-readable status message")
    progress: OpmlImportProgress | dict[str, Any] | None = Field(
        None, description="Progress information for active imports"
    )
    result: OpmlImportResult | None = Field(None, description="Final results for completed imports")
    error: str | None = Field(None, description="Error message for failed imports")
    metadata: OpmlTaskMetadata | None = Field(None, description="Task metadata from Redis")


class OpmlImportCancelResponse(BaseModel):
    """Response schema for import cancellation endpoint."""

    task_id: str = Field(..., description="Celery task ID that was cancelled")
    message: str = Field(..., description="Human-readable cancellation message")
    cancelled: bool = Field(..., description="Whether the cancellation was successful")
    cancelled_subtasks: int = Field(0, ge=0, description="Number of individual feed tasks cancelled")
    previous_state: str | None = Field(None, description="Previous task state if already completed")


class OpmlExportResponse(BaseModel):
    """Response schema for OPML export (returned as PlainTextResponse)."""

    content: str = Field(..., description="OPML XML content")
    filename: str = Field(default="readspace_feeds_export.opml", description="Suggested filename")
    media_type: str = Field(default="application/xml", description="MIME type")


# For parsing OPML structure
OpmlOutline.model_rebuild()
