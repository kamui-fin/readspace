from typing import Any, Dict, Optional
from uuid import UUID

import structlog
from app.db.session import get_db
from app.schemas.auth import TokenData
from app.services.auth import get_current_user
from app.services.rss_service import RssService
from app.workers.tasks import import_opml_task  # Import the background task
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import PlainTextResponse
from sqlalchemy.ext.asyncio import AsyncSession
from celery.result import AsyncResult

logger = structlog.get_logger(__name__)
router = APIRouter(prefix="/opml", tags=["RSS OPML"])

# Maximum file size allowed
MAX_FILE_SIZE_MB = 50  # Maximum file size allowed

@router.post("/import/", response_model=Dict[str, Any], status_code=status.HTTP_200_OK)
async def import_opml_file(
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
    opml_file: UploadFile = File(..., description="OPML file to import (.opml, .xml)"),
    default_folder_name: Optional[str] = Form("Imported Feeds", description="Name for the default folder if OPML items are at the root or if specified folders can't be created.")
):
    """Import feeds from an OPML file. The import is orchestrated via Celery tasks."""
    if not opml_file.filename.endswith(('.opml', '.xml')):
        logger.warning("Invalid OPML file type uploaded", filename=opml_file.filename, user_id=current_user.sub)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid file type. Please upload a .opml or .xml file.")

    try:
        content_bytes = await opml_file.read()
        
        # Check file size
        file_size_mb = len(content_bytes) / (1024 * 1024)
        
        if file_size_mb > MAX_FILE_SIZE_MB:
            logger.warning("OPML file too large", filename=opml_file.filename, size_mb=file_size_mb, user_id=current_user.sub)
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, 
                detail=f"File too large. Maximum size is {MAX_FILE_SIZE_MB}MB."
            )
        
        content_str = content_bytes.decode('utf-8')
        
        # Queue orchestration task
        logger.info("Queuing OPML import orchestration task", 
                   filename=opml_file.filename, size_mb=file_size_mb, user_id=current_user.sub)
        
        orchestration_task = import_opml_task.delay(
            user_id=current_user.sub,
            opml_content=content_str,
            default_folder_name=default_folder_name
        )
        
        return {
            "processing_mode": "background",
            "task_id": orchestration_task.id,
            "message": f"OPML file ({file_size_mb:.1f}MB) queued for processing. Individual feed imports will be processed in parallel.",
            "estimated_feeds": content_str.count('xmlUrl'),  # Rough estimate
            "check_status_url": f"/api/rss/opml/import/status/{orchestration_task.id}"
        }
            
    except UnicodeDecodeError:
        logger.warning("Failed to decode OPML file as UTF-8", filename=opml_file.filename, user_id=current_user.sub)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="File encoding error. Please ensure the file is UTF-8 encoded.")
    except ValueError as e:
        logger.warning("Failed to import OPML due to value error", error=str(e), user_id=current_user.sub)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error("Error starting OPML import task", error=str(e), user_id=current_user.sub)
        raise HTTPException(status_code=500, detail="Failed to start OPML import task.")
    finally:
        await opml_file.close()

@router.get("/import/status/{task_id}", response_model=Dict[str, Any])
async def get_import_status(
    task_id: str,
    current_user: TokenData = Depends(get_current_user)
):
    """Get the status of a background OPML import orchestration task."""
    try:
        task_result = AsyncResult(task_id)
        
        response_data = {
            "task_id": task_id,
            "status": task_result.status,
            "result": task_result.result if task_result.ready() else None,
            "error": str(task_result.result) if task_result.failed() else None,
        }
        
        # If the task is in progress, we can add progress metadata if it exists
        if task_result.status == 'PROGRESS':
            response_data['progress'] = task_result.info
            
        # If completed, the result itself is what we want to show
        if task_result.status == 'SUCCESS':
            response_data['result'] = task_result.result

        return response_data
    except Exception as e:
        logger.error("Error fetching task status from Celery backend", task_id=task_id, error=str(e))
        raise HTTPException(status_code=500, detail="Could not retrieve task status.")

@router.get("/export/", response_class=PlainTextResponse)
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