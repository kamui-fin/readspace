from uuid import UUID

import structlog
from fastapi import APIRouter, Body, Depends, HTTPException, Query, status
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.custom_exceptions import (
    FeedConnectionError,
    FeedParsingError,
    FeedSubscriptionError,
    FeedValidationError,
    NotFoundError,
)
from app.core.decorators import require_resource_limit
from app.crud import crud_tag
from app.db.session import get_db
from app.schemas.auth import TokenData
from app.schemas.rss_schemas import FeedCreate, FeedResponse, FeedUpdate
from app.services.auth import get_current_user
from app.services.rss_service import RssService

logger = structlog.get_logger(__name__)
router = APIRouter(prefix="/feeds", tags=["RSS Feeds"])


@router.post("/", response_model=FeedResponse, status_code=status.HTTP_201_CREATED)
@require_resource_limit("max_subscriptions")
async def add_new_feed(
    *,
    db: AsyncSession = Depends(get_db),
    feed_in: FeedCreate = Body(...),
    current_user: TokenData = Depends(get_current_user),
):
    """Add a new RSS feed by URL, associate with a folder and optional tags."""
    rss_service = RssService(db=db, user_id=UUID(current_user.sub))
    try:
        tag_names_to_pass: list[str] | None = None
        if feed_in.tag_ids:
            tag_names_list = []
            for tag_id in feed_in.tag_ids:
                tag_db = await crud_tag.get_tag(
                    db, tag_id=tag_id, user_id=UUID(current_user.sub)
                )
                if tag_db:
                    tag_names_list.append(tag_db.name)
                else:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Tag with ID {tag_id} not found.",
                    )
            tag_names_to_pass = tag_names_list

        feed = await rss_service.add_new_feed(
            url=str(feed_in.url),
            folder_id=feed_in.folder_id,
            tag_names=tag_names_to_pass,
        )
        logger.info(
            "Feed added successfully",
            feed_id=feed.id,
            user_id=current_user.sub,
            url=feed_in.url,
        )
        return feed
    except (FeedValidationError, FeedSubscriptionError, NotFoundError) as e:
        logger.warning(
            "Failed to add feed due to validation error",
            error=str(e),
            user_id=current_user.sub,
            url=feed_in.url,
        )
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except FeedConnectionError as e:
        logger.error(
            "Connection error adding feed",
            error=str(e),
            user_id=current_user.sub,
            url=feed_in.url,
        )
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Could not connect to feed URL: {e}",
        )
    except HTTPException:
        # Re-raise HTTP exceptions (like tag not found)
        raise
    except Exception as e:
        logger.error("Unexpected error adding new feed", error=str(e), exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred.",
        )


@router.get("/", response_model=list[FeedResponse])
async def list_feeds(
    db: AsyncSession = Depends(get_db),
    folder_id: UUID | None = Query(None, description="Filter feeds by folder ID"),
    tag_names: list[str] | None = Query(
        None,
        description="Filter feeds by a list of tag names (case-insensitive, matches all provided tags)",
    ),
    is_favorite: bool | None = Query(
        None, description="Filter feeds by favorite status"
    ),
    search_query: str | None = Query(None, description="Search query for feed titles"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=200),
    current_user: TokenData = Depends(get_current_user),
):
    """List feeds for the current user with optional filtering."""
    rss_service = RssService(db=db, user_id=UUID(current_user.sub))
    feeds = await rss_service.list_feeds(
        folder_id=folder_id,
        tag_names=tag_names,
        is_favorite=is_favorite,
        search_query=search_query,
        skip=skip,
        limit=limit,
    )
    return feeds


@router.get("/{feed_id}", response_model=FeedResponse)
async def get_feed(
    feed_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    """Get a specific feed by its ID."""
    rss_service = RssService(db=db, user_id=UUID(current_user.sub))
    feed = await rss_service.get_feed(feed_id=feed_id)
    if not feed:
        logger.warning(
            "Feed not found or access denied", feed_id=feed_id, user_id=current_user.sub
        )
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Feed not found"
        )
    return feed


@router.put("/{feed_id}", response_model=FeedResponse)
async def update_feed_settings(
    feed_id: UUID,
    feed_in: FeedUpdate = Body(...),
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    """Update a feed's user-configurable settings (folder, tags, favorite status, title)."""
    rss_service = RssService(db=db, user_id=UUID(current_user.sub))
    try:
        updated_feed = await rss_service.update_feed_user_settings(
            feed_id=feed_id, feed_in=feed_in
        )
        if not updated_feed:
            logger.warning(
                "Feed not found for update or access denied",
                feed_id=feed_id,
                user_id=current_user.sub,
            )
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Feed not found"
            )
        logger.info(
            "Feed settings updated successfully",
            feed_id=updated_feed.id,
            user_id=current_user.sub,
        )
        return updated_feed
    except (FeedValidationError, FeedSubscriptionError, NotFoundError) as e:
        logger.warning(
            f"Validation error updating feed {feed_id} for user {current_user.sub}: {e}"
        )
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(
            "Unexpected error updating feed settings",
            error=str(e),
            user_id=current_user.sub,
            feed_id=feed_id,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred.",
        )


@router.post("/{feed_id}/refresh", response_model=FeedResponse)
async def refresh_feed(
    feed_id: UUID,
    force_refetch: bool = Query(
        False,
        description="Force refetch even if not modified based on ETag/Last-Modified",
    ),
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    """Manually trigger a refresh of a specific feed to fetch new articles."""
    rss_service = RssService(db=db, user_id=UUID(current_user.sub))
    try:
        refreshed_feed = await rss_service.refresh_feed(
            feed_id=feed_id, force_refetch=force_refetch
        )
        if not refreshed_feed:
            logger.warning(
                "Feed not found for refresh or access denied",
                feed_id=feed_id,
                user_id=current_user.sub,
            )
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Feed not found"
            )
        logger.info(
            "Feed refresh triggered/completed",
            feed_id=refreshed_feed.id,
            user_id=current_user.sub,
        )
        return refreshed_feed
    except FeedConnectionError as e:
        logger.error(
            "Connection error refreshing feed",
            error=str(e),
            user_id=current_user.sub,
            feed_id=feed_id,
        )
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Could not connect to feed URL during refresh: {e}",
        )
    except (FeedValidationError, FeedParsingError) as e:
        logger.warning(
            "Validation/parsing error during feed refresh",
            error=str(e),
            user_id=current_user.sub,
            feed_id=feed_id,
        )
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except HTTPException:
        # Re-raise HTTP exceptions (like feed not found)
        raise
    except Exception as e:
        logger.error(
            "Unexpected error refreshing feed",
            error=str(e),
            user_id=current_user.sub,
            feed_id=feed_id,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred during feed refresh.",
        )


@router.get("/refresh_status/{task_id}", response_model=dict)
async def get_refresh_status(
    task_id: str,
    page: int = Query(1, ge=1, description="Page number for paginated task checking"),
    page_size: int = Query(100, ge=1, le=500, description="Number of tasks to check per page"),
    current_user: TokenData = Depends(get_current_user)
):
    """Get the status of a background feed refresh task."""
    try:
        from app.core.celery_app import celery

        # Get orchestration task result
        orchestration_result = celery.AsyncResult(task_id)

        if orchestration_result.state == "PENDING":
            return {
                "task_id": task_id,
                "status": "pending",
                "message": "Feed refresh is queued and waiting to start.",
            }
        elif orchestration_result.state == "PROGRESS":
            return {
                "task_id": task_id,
                "status": "in_progress",
                "message": "Feed refresh is being processed and individual feeds are being queued.",
                "progress": orchestration_result.info,
            }
        elif orchestration_result.state == "SUCCESS":
            # Orchestration completed, now check individual feed refresh tasks
            orchestration_data = orchestration_result.result
            feed_task_ids = orchestration_data.get("task_ids", [])

            if not feed_task_ids:
                return {
                    "task_id": task_id,
                    "status": "completed",
                    "result": {
                        "refreshed_count": 0,
                        "failed_count": 0,
                        "total_feeds": 0,
                        "message": "No feeds found to refresh.",
                    },
                }

            # Implement pagination to handle large imports efficiently
            total_tasks = len(feed_task_ids)
            start_idx = (page - 1) * page_size
            end_idx = start_idx + page_size
            paginated_task_ids = feed_task_ids[start_idx:end_idx]

            # Calculate pagination info
            total_pages = (total_tasks + page_size - 1) // page_size
            has_more_pages = page < total_pages

            logger.info(
                "Checking status of individual feed refresh tasks (paginated)",
                total_tasks=total_tasks,
                current_page=page,
                total_pages=total_pages,
                tasks_this_page=len(paginated_task_ids),
                task_id=task_id,
            )

            # Check status of individual feed refresh tasks using batch operations
            completed_tasks = 0
            successful_refreshes = 0
            failed_refreshes = 0
            failed_feeds = []  # Track which feeds failed and why

            # Use Redis pipeline for efficient batch operations instead of individual calls
            from redis import Redis

            from app.core.config import get_settings

            settings = get_settings()

            # Get Redis connection from Celery backend
            redis_client = None
            if hasattr(celery, 'backend') and hasattr(celery.backend, 'client'):
                redis_client = celery.backend.client

            # Fallback to creating new Redis connection if needed
            if not redis_client:
                redis_client = Redis.from_url(settings.CELERY_BROKER_URL)

            # Batch fetch task states using Redis pipeline for efficiency (paginated)
            task_results = {}
            if redis_client:
                with redis_client.pipeline() as pipe:
                    # Batch get task results for current page only
                    for task_id in paginated_task_ids:
                        pipe.get(f"celery-task-meta-{task_id}")
                    results = pipe.execute()

                    # Parse results
                    import json
                    for task_id, result in zip(paginated_task_ids, results, strict=False):
                        if result:
                            try:
                                task_data = json.loads(result.decode('utf-8'))
                                task_results[task_id] = task_data.get('status', 'PENDING')
                            except (json.JSONDecodeError, AttributeError):
                                task_results[task_id] = 'PENDING'
                        else:
                            task_results[task_id] = 'PENDING'
            else:
                # Fallback to individual calls if Redis pipeline fails
                task_results = {task_id: celery.AsyncResult(task_id).state for task_id in paginated_task_ids}

            # Process paginated task states efficiently
            for i, feed_task_id in enumerate(paginated_task_ids):
                task_state = task_results.get(feed_task_id, 'PENDING')
                logger.debug(
                    "Checking feed refresh task",
                    task_index=i,
                    feed_task_id=feed_task_id,
                    state=task_state,
                )

                if task_state == "SUCCESS":
                    completed_tasks += 1
                    successful_refreshes += 1
                    logger.debug("Feed refresh task SUCCESS", feed_task_id=feed_task_id)
                elif task_state == "FAILURE":
                    completed_tasks += 1
                    failed_refreshes += 1

                    # Try to get detailed error information
                    error_info = {"task_id": feed_task_id, "error": "Unknown error"}
                    try:
                        # For failed tasks, we need to get the full task result for error details
                        feed_task_result = celery.AsyncResult(feed_task_id)
                        if hasattr(feed_task_result, "info") and feed_task_result.info:
                            error_str = str(feed_task_result.info)
                            # Categorize common errors for better user understanding
                            if (
                                "timeout" in error_str.lower()
                                or "timed out" in error_str.lower()
                            ):
                                error_info["error"] = (
                                    "Feed timed out (server not responding)"
                                )
                                error_info["category"] = "timeout"
                            elif "404" in error_str or "not found" in error_str.lower():
                                error_info["error"] = "Feed not found (404)"
                                error_info["category"] = "not_found"
                            elif "403" in error_str or "forbidden" in error_str.lower():
                                error_info["error"] = "Access denied (403)"
                                error_info["category"] = "access_denied"
                            elif (
                                "500" in error_str
                                or "502" in error_str
                                or "503" in error_str
                            ):
                                error_info["error"] = "Server error"
                                error_info["category"] = "server_error"
                            elif (
                                "parse" in error_str.lower()
                                or "xml" in error_str.lower()
                            ):
                                error_info["error"] = "Invalid feed format"
                                error_info["category"] = "parse_error"
                            elif "connection" in error_str.lower():
                                error_info["error"] = "Connection failed"
                                error_info["category"] = "connection_error"
                            elif (
                                "invalid types" in error_str.lower()
                                or "dataerror" in error_str.lower()
                            ):
                                error_info["error"] = "Feed contains invalid data types"
                                error_info["category"] = "data_error"
                            else:
                                # Don't expose internal error details - provide generic message
                                error_info["error"] = "Feed refresh failed"
                                error_info["category"] = "other"
                    except Exception as e:
                        logger.debug(
                            "Could not extract detailed error info",
                            feed_task_id=feed_task_id,
                            error=str(e),
                        )

                    failed_feeds.append(error_info)
                    logger.debug(
                        "Feed refresh task FAILURE",
                        feed_task_id=feed_task_id,
                        error=error_info["error"],
                    )
                else:
                    logger.debug(
                        "Feed refresh task still processing",
                        feed_task_id=feed_task_id,
                        state=feed_task_result.state,
                    )

            total_feeds = len(feed_task_ids)

            # For pagination, we need to return page-specific information
            # The client needs to check all pages to determine overall completion

            logger.info(
                "Refresh task status summary (paginated)",
                page_completed=completed_tasks,
                page_tasks=len(paginated_task_ids),
                page_successful=successful_refreshes,
                page_failed=failed_refreshes,
                total_feeds=total_feeds,
                current_page=page,
                total_pages=total_pages,
            )

            # Return paginated results - client determines overall completion
            if len(paginated_task_ids) == 0:
                return {
                    "task_id": task_id,
                    "status": "completed",
                    "pagination": {
                        "current_page": page,
                        "total_pages": total_pages,
                        "page_size": page_size,
                        "total_tasks": total_feeds,
                        "has_more": has_more_pages,
                    },
                    "result": {
                        "page_refreshed_count": 0,
                        "page_failed_count": 0,
                        "page_completed_count": 0,
                        "total_feeds": total_feeds,
                        "message": "Page contains no tasks.",
                    },
                }

            # Always return in_progress for paginated results
            # Client must check all pages to determine completion
            result = {
                "task_id": task_id,
                "status": "in_progress",
                "pagination": {
                    "current_page": page,
                    "total_pages": total_pages,
                    "page_size": page_size,
                    "total_tasks": total_feeds,
                    "has_more": has_more_pages,
                },
                "result": {
                    "page_refreshed_count": successful_refreshes,
                    "page_failed_count": failed_refreshes,
                    "page_completed_count": completed_tasks,
                    "page_total_count": len(paginated_task_ids),
                    "total_feeds": total_feeds,
                    "summary": {
                        "page_successful": successful_refreshes,
                        "page_failed": failed_refreshes,
                        "page_pending": len(paginated_task_ids) - completed_tasks,
                    },
                },
            }

            # Include failed feeds details if any failed on this page
            if failed_feeds:
                result["result"]["failed_feeds"] = failed_feeds
                # Summarize error categories for this page
                error_categories = {}
                for failed_feed in failed_feeds:
                    category = failed_feed.get("category", "other")
                    error_categories[category] = (
                        error_categories.get(category, 0) + 1
                    )
                result["result"]["error_summary"] = error_categories

            return result
        elif orchestration_result.state == "FAILURE":
            return {
                "task_id": task_id,
                "status": "failed",
                "error": "Background task failed",
                "message": "Feed refresh failed. Please try again.",
            }
        else:
            return {
                "task_id": task_id,
                "status": orchestration_result.state.lower(),
                "message": f"Task is in state: {orchestration_result.state}",
            }

    except Exception as e:
        logger.error(
            "Error checking refresh task status",
            task_id=task_id,
            error=str(e),
            user_id=current_user.sub,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not check refresh status.",
        )


@router.delete("/{feed_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_feed(
    feed_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    """Delete a feed. Associated articles will also be deleted (cascade)."""
    rss_service = RssService(db=db, user_id=UUID(current_user.sub))
    success = await rss_service.delete_feed(feed_id=feed_id)
    if not success:
        logger.warning(
            "Feed not found for deletion or access denied",
            feed_id=feed_id,
            user_id=current_user.sub,
        )
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Feed not found"
        )
    logger.info("Feed deleted successfully", feed_id=feed_id, user_id=current_user.sub)
    return JSONResponse(status_code=status.HTTP_200_OK, content={"ok": True})
