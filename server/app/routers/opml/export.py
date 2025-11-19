import time
from uuid import UUID

import structlog
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import PlainTextResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.metrics import opml_export_duration_seconds, opml_export_total
from app.db.session import get_db
from app.schemas.auth import TokenData
from app.services.feeds.feed_management import FeedManagementService
from app.services.opml.opml_processor import OpmlProcessor
from app.services.user.auth import get_current_user

logger = structlog.get_logger(__name__)
router = APIRouter()


@router.get(
    "/export/",
    response_class=PlainTextResponse,
    summary="Export user feeds to OPML",
    description="Export all of the user's RSS feeds to a standard OPML file for backup or migration.",
    responses={
        200: {
            "description": "OPML file generated successfully",
            "content": {
                "application/xml": {
                    "example": "<?xml version='1.0' encoding='UTF-8'?>\n<opml version='2.0'>\n  <head>\n    <title>Readspace Feeds Export</title>\n  </head>\n  <body>\n    <outline text='Technology' title='Technology'>\n      <outline type='rss' text='TechCrunch' title='TechCrunch' xmlUrl='https://techcrunch.com/feed/' htmlUrl='https://techcrunch.com'/>\n    </outline>\n  </body>\n</opml>"
                }
            },
        },
        401: {"description": "Authentication required"},
        500: {
            "description": "Error generating OPML export",
            "content": {
                "application/json": {"example": {"detail": "An unexpected error occurred during OPML export."}}
            },
        },
    },
)
async def export_opml_file(
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
) -> PlainTextResponse:
    """
    Export all user feeds to a standard OPML file.

    This endpoint generates an OPML file containing all of the authenticated
    user's RSS feeds, organized by folders. The file can be imported into
    other RSS readers or used as a backup.

    **OPML Structure:**
    - Feeds are organized by their folder structure
    - Each feed includes title, description, RSS URL, and website URL
    - Standard OPML 2.0 format for maximum compatibility
    - UTF-8 encoding for international characters

    **Export Contents:**
    - All subscribed feeds
    - Folder organization
    - Feed metadata (title, description, URLs)
    - Creation timestamps

    **File Format:**
    The exported file follows OPML 2.0 standards and includes:
    - XML declaration with UTF-8 encoding
    - OPML version specification
    - Header with export metadata
    - Body with nested outline elements

    **Download Behavior:**
    - File is returned as an attachment
    - Filename: `readspace_feeds_export.opml`
    - MIME type: `application/xml`
    - Browser will prompt to save the file

    **Use Cases:**
    - Backup feed subscriptions
    - Migrate to another RSS reader
    - Share feed collections
    - Archive feed lists

    Args:
        db: Database session dependency
        current_user: Authenticated user information

    Returns:
        PlainTextResponse: OPML XML content as downloadable file

    Raises:
        HTTPException: 500 for export generation errors
    """
    start_time = time.perf_counter()
    feed_service = FeedManagementService(db=db, user_id=UUID(current_user.sub))

    try:
        # Get all user feeds and export to OPML
        user_feeds = await feed_service.list_feeds()

        # Use OPML processor to handle export
        opml_processor = OpmlProcessor()
        opml_string = await opml_processor.export_feeds_to_opml(user_feeds)

        duration = time.perf_counter() - start_time
        opml_export_total.labels(status="success").inc()
        opml_export_duration_seconds.observe(duration)

        logger.info(
            "OPML export successful",
            user_id=current_user.sub,
            feed_count=len(user_feeds),
            export_size_bytes=len(opml_string),
            duration_seconds=round(duration, 3),
        )

        return PlainTextResponse(
            content=opml_string,
            media_type="application/xml",
            headers={"Content-Disposition": "attachment; filename=readspace_feeds_export.opml"},
        )
    except Exception as e:
        duration = time.perf_counter() - start_time
        opml_export_total.labels(status="error").inc()
        opml_export_duration_seconds.observe(duration)

        logger.error(
            "Unexpected error during OPML export",
            error=str(e),
            error_type=type(e).__name__,
            user_id=current_user.sub,
            duration_seconds=round(duration, 3),
            exc_info=True,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred during OPML export.",
        ) from e
