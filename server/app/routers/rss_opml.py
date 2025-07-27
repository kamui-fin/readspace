from typing import Any, Dict, List, Optional
from uuid import UUID
from datetime import datetime, timezone

import structlog
from app.core.redis_cache import RedisCache
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

# Redis TTL for import task metadata (24 hours)
IMPORT_TASK_TTL_SECONDS = 24 * 60 * 60

async def store_import_task_metadata(user_id: str, task_id: str, estimated_feeds: int, filename: str):
    """Store import task metadata in Redis for user ownership tracking."""
    redis_cache = RedisCache()
    task_metadata = {
        "user_id": user_id,
        "task_id": task_id,
        "estimated_feeds": estimated_feeds,
        "filename": filename,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "status": "pending"
    }
    
    # Store with two keys for different access patterns
    # 1. User -> task mapping (for listing user's tasks)
    user_tasks_key = f"opml_import_tasks:user:{user_id}"
    existing_tasks = await redis_cache.get(user_tasks_key) or []
    
    # Remove any old tasks for this user that might be completed
    active_tasks = []
    for task in existing_tasks:
        if task.get("task_id") != task_id:
            active_tasks.append(task)
    
    active_tasks.append(task_metadata)
    await redis_cache.set(user_tasks_key, active_tasks, ttl_seconds=IMPORT_TASK_TTL_SECONDS)
    
    # 2. Task -> metadata mapping (for auth and quick lookup)
    task_key = f"opml_import_task:{task_id}"
    await redis_cache.set(task_key, task_metadata, ttl_seconds=IMPORT_TASK_TTL_SECONDS)

async def get_import_task_metadata(task_id: str) -> Optional[Dict[str, Any]]:
    """Get import task metadata from Redis."""
    redis_cache = RedisCache()
    task_key = f"opml_import_task:{task_id}"
    return await redis_cache.get(task_key)

async def cleanup_completed_task(user_id: str, task_id: str):
    """Remove completed task from Redis."""
    redis_cache = RedisCache()
    
    # Remove from user's active tasks list
    user_tasks_key = f"opml_import_tasks:user:{user_id}"
    existing_tasks = await redis_cache.get(user_tasks_key) or []
    active_tasks = [task for task in existing_tasks if task.get("task_id") != task_id]
    
    if active_tasks:
        await redis_cache.set(user_tasks_key, active_tasks, ttl_seconds=IMPORT_TASK_TTL_SECONDS)
    else:
        await redis_cache.delete(user_tasks_key)
    
    # Remove task metadata
    task_key = f"opml_import_task:{task_id}"
    await redis_cache.delete(task_key)

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
        
        # Store task metadata in Redis for persistence and auth
        estimated_feeds = content_str.count('xmlUrl')
        await store_import_task_metadata(
            user_id=current_user.sub,
            task_id=orchestration_task.id,
            estimated_feeds=estimated_feeds,
            filename=opml_file.filename or "unknown.opml"
        )
        
        return {
            "processing_mode": "background",
            "task_id": orchestration_task.id,
            "message": f"OPML file ({file_size_mb:.1f}MB) queued for processing. New feeds will be imported and existing feeds will be updated/reorganized as needed.",
            "estimated_feeds": estimated_feeds,
            "check_status_url": f"/api/rss/opml/import/status/{orchestration_task.id}",
            "status_page_url": f"/import-opml/status/{orchestration_task.id}"
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
    # Try to get task metadata from Redis
    task_metadata = await get_import_task_metadata(task_id)
    
    # If metadata exists, verify user ownership
    if task_metadata and task_metadata.get("user_id") != current_user.sub:
        logger.warning("Unauthorized access to import task", task_id=task_id, user_id=current_user.sub, task_owner=task_metadata.get("user_id"))
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You don't have permission to access this import task.")
    
    try:
        task_result = AsyncResult(task_id)
        
        # If task doesn't exist in Celery either, it's truly not found
        if task_result.state == 'PENDING' and not task_metadata:
            logger.warning("Task not found in both Redis and Celery", task_id=task_id, user_id=current_user.sub)
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Import task not found or has expired.")
        
        # If we have metadata but no user verification was done above, verify now
        if not task_metadata:
            logger.info("Task metadata missing from Redis, checking Celery task only", task_id=task_id, user_id=current_user.sub)
            # Without metadata, we can't verify user ownership, but we can still return task status
            # This is a fallback for cases where Redis data was lost but Celery task still exists
            
        if task_result.state == 'PENDING':
            return {
                "task_id": task_id,
                "status": "pending",
                "message": "OPML import is queued and waiting to start.",
                "metadata": task_metadata
            }
        elif task_result.state == 'PROGRESS':
            return {
                "task_id": task_id,
                "status": "in_progress",
                "message": "OPML import is being processed and individual feeds are being queued.",
                "progress": task_result.info,
                "metadata": task_metadata
            }
        elif task_result.state == 'SUCCESS':
            # Orchestration completed, now check individual feed import tasks
            orchestration_data = task_result.result
            feed_task_ids = orchestration_data.get("task_ids", [])
            
            if not feed_task_ids:
                # Clean up task metadata for completed task if it exists
                if task_metadata:
                    await cleanup_completed_task(current_user.sub, task_id)
                
                return {
                    "task_id": task_id,
                    "status": "completed",
                    "result": {
                        "imported_count": 0,
                        "failed_count": 0,
                        "already_existed_count": 0,
                        "total_feeds": 0,
                        "summary": {
                            "successful": 0,
                            "failed": 0,
                            "already_existed": 0
                        },
                        "message": "No feeds found to import."
                    },
                    "metadata": task_metadata
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
                feed_task_result = AsyncResult(feed_task_id)
                logger.debug("Checking feed import task", 
                           task_index=i, feed_task_id=feed_task_id, 
                           state=feed_task_result.state)
                
                if feed_task_result.state == 'SUCCESS':
                    completed_tasks += 1
                    task_data = feed_task_result.result
                    
                    if task_data.get("success"):
                        task_status = task_data.get("status", "unknown")
                        if task_status == "already_exists":
                            already_existed += 1
                        elif task_status in ["imported", "imported_or_updated"]:
                            successful_imports += 1
                        else:
                            # Handle any other success statuses as successful
                            successful_imports += 1
                    else:
                        failed_imports += 1
                        errors.append({
                            "url": task_data.get("url", "Unknown"),
                            "title": task_data.get("title", "Unknown"),
                            "error": task_data.get("error", "Unknown error"),
                            "status": task_data.get("status", "unknown")
                        })
                elif feed_task_result.state == 'FAILURE':
                    completed_tasks += 1
                    failed_imports += 1
                    
                    # Try to get error information
                    error_info = {
                        "url": "Unknown",
                        "title": "Unknown",
                        "error": str(feed_task_result.info) if feed_task_result.info else "Task failed",
                        "status": "task_failed"
                    }
                    errors.append(error_info)
            
            total_feeds = len(feed_task_ids)
            is_complete = completed_tasks == total_feeds
            
            logger.info("OPML import task status summary", 
                       completed=completed_tasks, total=total_feeds,
                       successful=successful_imports, failed=failed_imports,
                       already_existed=already_existed, is_complete=is_complete)
            
            if is_complete:
                # Clean up task metadata for completed task if it exists
                if task_metadata:
                    await cleanup_completed_task(current_user.sub, task_id)
                
                result = {
                    "task_id": task_id,
                    "status": "completed",
                    "result": {
                        "imported_count": successful_imports,
                        "failed_count": failed_imports,
                        "already_existed_count": already_existed,
                        "total_feeds": total_feeds,
                        "summary": {
                            "successful": successful_imports,
                            "failed": failed_imports,
                            "already_existed": already_existed
                        },
                        "message": f"Import completed: {successful_imports} imported, {already_existed} already existed, {failed_imports} failed"
                    },
                    "metadata": task_metadata
                }
                
                # Include error details if any failed
                if errors:
                    result["result"]["errors"] = errors
                
                return result
            else:
                return {
                    "task_id": task_id,
                    "status": "in_progress",
                    "message": f"Importing feeds: {completed_tasks}/{total_feeds} completed",
                    "progress": {
                        "completed": completed_tasks,
                        "total": total_feeds,
                        "successful": successful_imports,
                        "failed": failed_imports,
                        "already_existed": already_existed
                    },
                    "metadata": task_metadata
                }
        elif task_result.state == 'FAILURE':
            # Clean up task metadata for failed task if it exists
            if task_metadata:
                await cleanup_completed_task(current_user.sub, task_id)
            
            return {
                "task_id": task_id,
                "status": "failed",
                "error": str(task_result.info) if task_result.info else "Unknown error",
                "message": "OPML import failed. Please try again.",
                "metadata": task_metadata
            }
        else:
            return {
                "task_id": task_id,
                "status": task_result.state.lower(),
                "message": f"Task is in state: {task_result.state}",
                "metadata": task_metadata
            }
            
    except Exception as e:
        logger.error("Error fetching task status from Celery backend", task_id=task_id, error=str(e))
        raise HTTPException(status_code=500, detail="Could not retrieve task status.")

@router.get("/import/tasks", response_model=List[Dict[str, Any]])
async def list_user_import_tasks(
    current_user: TokenData = Depends(get_current_user)
):
    """List all active OPML import tasks for the current user."""
    redis_cache = RedisCache()
    user_tasks_key = f"opml_import_tasks:user:{current_user.sub}"
    user_tasks = await redis_cache.get(user_tasks_key) or []
    
    # Clean up completed tasks and get updated status
    active_tasks = []
    tasks_to_remove = []
    
    for task in user_tasks:
        task_id = task.get("task_id")
        if not task_id:
            continue
            
        try:
            task_result = AsyncResult(task_id)
            
            # Check if task is completed or failed
            if task_result.state in ['SUCCESS', 'FAILURE']:
                # Check if it's truly done by looking at individual feed tasks
                if task_result.state == 'SUCCESS':
                    orchestration_data = task_result.result
                    feed_task_ids = orchestration_data.get("task_ids", [])
                    
                    if feed_task_ids:
                        # Check if all individual tasks are complete
                        all_complete = True
                        for feed_task_id in feed_task_ids:
                            feed_task_result = AsyncResult(feed_task_id)
                            if feed_task_result.state not in ['SUCCESS', 'FAILURE']:
                                all_complete = False
                                break
                        
                        if not all_complete:
                            # Still in progress
                            task['current_status'] = 'in_progress'
                            active_tasks.append(task)
                        else:
                            # Truly complete
                            tasks_to_remove.append(task_id)
                    else:
                        # No feeds to import, completed
                        tasks_to_remove.append(task_id)
                else:
                    # Failed
                    tasks_to_remove.append(task_id)
            else:
                # Still pending or in progress
                task['current_status'] = task_result.state.lower()
                active_tasks.append(task)
                
        except Exception as e:
            logger.warning("Error checking task status in list_user_import_tasks", task_id=task_id, error=str(e))
            # Keep the task in list but mark as unknown
            task['current_status'] = 'unknown'
            active_tasks.append(task)
    
    # Clean up completed tasks from Redis
    if tasks_to_remove:
        for task_id in tasks_to_remove:
            await cleanup_completed_task(current_user.sub, task_id)
    
    return active_tasks

@router.get("/import/active", response_model=Optional[Dict[str, Any]])
async def get_active_import_task(
    current_user: TokenData = Depends(get_current_user)
):
    """Get the most recent active OPML import task for the current user."""
    tasks = await list_user_import_tasks(current_user)
    
    if not tasks:
        return None
    
    # Return the most recent task (tasks are ordered by creation time)
    return max(tasks, key=lambda x: x.get("created_at", ""))

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