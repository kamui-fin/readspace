"""OPML import/export schema definitions."""

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


class OpmlImportProgress(BaseModel):
    """Progress information for active OPML imports."""

    completed: int = Field(..., ge=0, description="Number of feeds processed")
    total: int = Field(..., ge=0, description="Total number of feeds to process")
    successful: int = Field(..., ge=0, description="Number of successfully imported feeds")
    failed: int = Field(..., ge=0, description="Number of failed feed imports")
    already_existed: int = Field(..., ge=0, description="Number of feeds that already existed")


class OpmlImportResult(BaseModel):
    """Final result summary for completed OPML imports."""

    imported_count: int = Field(..., ge=0, description="Number of new feeds imported")
    failed_count: int = Field(..., ge=0, description="Number of feeds that failed to import")
    already_existed_count: int = Field(..., ge=0, description="Number of feeds that already existed")
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
