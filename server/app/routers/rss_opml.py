from typing import Any, Dict, Optional
from uuid import UUID

import structlog
from app.db.session import get_db
from app.schemas.auth import TokenData
from app.services.auth import get_current_user
from app.services.rss_service import RssService
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import PlainTextResponse
from sqlalchemy.ext.asyncio import AsyncSession

logger = structlog.get_logger(__name__)
router = APIRouter()


@router.post("/opml/import/", response_model=Dict[str, Any], status_code=status.HTTP_200_OK)
async def import_opml_file(
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
    opml_file: UploadFile = File(..., description="OPML file to import (.opml, .xml)"),
    default_folder_name: Optional[str] = Form("Imported Feeds", description="Name for the default folder if OPML items are at the root or if specified folders can't be created.")
):
    """Import feeds from an OPML file."""
    if not opml_file.filename.endswith(('.opml', '.xml')):
        logger.warning("Invalid OPML file type uploaded", filename=opml_file.filename, user_id=current_user.sub)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid file type. Please upload a .opml or .xml file.")

    rss_service = RssService(db=db, user_id=UUID(current_user.sub))
    try:
        content_bytes = await opml_file.read()
        content_str = content_bytes.decode('utf-8')
        import_summary = await rss_service.import_opml(opml_content=content_str, default_folder_name=default_folder_name)
        logger.info("OPML import completed", user_id=current_user.sub, summary=import_summary)
        return import_summary
    except ValueError as e:
        logger.warning("Failed to import OPML due to value error", error=str(e), user_id=current_user.sub)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error("Unexpected error during OPML import", error=str(e), user_id=current_user.sub, exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="An unexpected error occurred during OPML import.")
    finally:
        await opml_file.close()


@router.get("/opml/export/", response_class=PlainTextResponse)
async def export_opml_file(
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user)
):
    """Export all user feeds to an OPML file."""
    rss_service = RssService(db=db, user_id=UUID(current_user.sub))
    try:
        opml_string = await rss_service.export_opml()
        logger.info("OPML export successful", user_id=current_user.sub)
        return PlainTextResponse(
            content=opml_string, 
            media_type="application/xml",
            headers={"Content-Disposition": "attachment; filename=readspace_feeds_export.opml"}
        )
    except Exception as e:
        logger.error("Unexpected error during OPML export", error=str(e), user_id=current_user.sub, exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="An unexpected error occurred during OPML export.") 