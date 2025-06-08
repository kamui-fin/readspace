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

logger = structlog.get_logger(__name__)
router = APIRouter()

# Maximum file size allowed
MAX_FILE_SIZE_MB = 50  # Maximum file size allowed

@router.post("/opml/import/", response_model=Dict[str, Any], status_code=status.HTTP_200_OK)
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
        logger.error("Unexpected error during OPML import", error=str(e), user_id=current_user.sub, exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="An unexpected error occurred during OPML import.")
    finally:
        await opml_file.close()

@router.get("/opml/import/status/{task_id}", response_model=Dict[str, Any])
async def get_import_status(
    task_id: str,
    current_user: TokenData = Depends(get_current_user)
):
    """Get the status of a background OPML import orchestration task."""
    try:
        from app.core.celery_app import celery
        
        # Get orchestration task result
        orchestration_result = celery.AsyncResult(task_id)
        
        if orchestration_result.state == 'PENDING':
            return {
                "task_id": task_id,
                "status": "pending",
                "message": "OPML processing is queued and waiting to start."
            }
        elif orchestration_result.state == 'PROGRESS':
            return {
                "task_id": task_id,
                "status": "in_progress",
                "message": "OPML is being processed and individual feed imports are being queued.",
                "progress": orchestration_result.info
            }
        elif orchestration_result.state == 'SUCCESS':
            # Orchestration completed, now check individual feed import tasks
            orchestration_data = orchestration_result.result
            feed_task_ids = orchestration_data.get("task_ids", [])
            
            if not feed_task_ids:
                return {
                    "task_id": task_id,
                    "status": "completed",
                    "result": {
                        "imported_count": 0,
                        "failed_count": 0,
                        "total_feeds": 0,
                        "message": "No feeds found in OPML file."
                    }
                }
            
            # Check status of individual feed import tasks
            completed_tasks = 0
            successful_imports = 0
            failed_imports = 0
            already_existed = 0
            errors = []
            
            logger.info("Checking status of individual feed import tasks", 
                       total_tasks=len(feed_task_ids), task_id=task_id)
            
            for i, feed_task_id in enumerate(feed_task_ids):
                feed_task_result = celery.AsyncResult(feed_task_id)
                logger.debug("Checking feed task", 
                           task_index=i, feed_task_id=feed_task_id, 
                           state=feed_task_result.state)
                
                if feed_task_result.state == 'SUCCESS':
                    completed_tasks += 1
                    task_data = feed_task_result.result
                    
                    logger.debug("Feed task SUCCESS", 
                               feed_task_id=feed_task_id,
                               task_data=task_data)
                    
                    if task_data.get("success"):
                        if task_data.get("status") == "already_exists":
                            already_existed += 1
                            logger.debug("Counted as already_exists", feed_task_id=feed_task_id)
                        else:
                            successful_imports += 1
                            logger.debug("Counted as successful_import", feed_task_id=feed_task_id)
                    else:
                        failed_imports += 1
                        logger.debug("Counted as failed_import", feed_task_id=feed_task_id)
                        errors.append({
                            "url": task_data.get("url", "Unknown"),
                            "title": task_data.get("title", "Unknown"),
                            "error": task_data.get("error", "Unknown error"),
                            "status": task_data.get("status", "unknown")
                        })
                elif feed_task_result.state == 'FAILURE':
                    completed_tasks += 1
                    failed_imports += 1
                    logger.debug("Feed task FAILURE", feed_task_id=feed_task_id, error=str(feed_task_result.info))
                    errors.append({
                        "url": "Unknown",
                        "title": "Unknown", 
                        "error": str(feed_task_result.info),
                        "status": "task_failed"
                    })
                else:
                    logger.debug("Feed task still processing", 
                               feed_task_id=feed_task_id, 
                               state=feed_task_result.state)
            
            total_feeds = len(feed_task_ids)
            is_complete = completed_tasks == total_feeds
            
            logger.info("Task status summary", 
                       completed=completed_tasks, total=total_feeds,
                       successful=successful_imports, failed=failed_imports, 
                       already_existed=already_existed, is_complete=is_complete)
            
            if is_complete:
                return {
                    "task_id": task_id,
                    "status": "completed",
                    "result": {
                        "imported_count": successful_imports,
                        "failed_count": failed_imports,
                        "already_existed_count": already_existed,
                        "total_feeds": total_feeds,
                        "errors": errors,
                        "summary": {
                            "successful": successful_imports,
                            "failed": failed_imports,
                            "already_existed": already_existed
                        }
                    }
                }
            else:
                return {
                    "task_id": task_id,
                    "status": "in_progress",
                    "message": f"Processing feeds: {completed_tasks}/{total_feeds} completed",
                    "progress": {
                        "completed": completed_tasks,
                        "total": total_feeds,
                        "successful": successful_imports,
                        "failed": failed_imports,
                        "already_existed": already_existed
                    }
                }
        elif orchestration_result.state == 'FAILURE':
            return {
                "task_id": task_id,
                "status": "failed",
                "error": str(orchestration_result.info),
                "message": "OPML processing failed. Please try again."
            }
        else:
            return {
                "task_id": task_id,
                "status": orchestration_result.state.lower(),
                "message": f"Task is in state: {orchestration_result.state}"
            }
            
    except Exception as e:
        logger.error("Error checking task status", task_id=task_id, error=str(e), user_id=current_user.sub)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Could not check import status.")

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