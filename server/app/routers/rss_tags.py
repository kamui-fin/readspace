from uuid import UUID

import structlog
from fastapi import APIRouter, Body, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.schemas.auth import TokenData
from app.schemas.rss_schemas import TagCreate, TagResponse, TagUpdate
from app.services.auth import get_current_user
from app.services.rss_service import RssService

logger = structlog.get_logger(__name__)
router = APIRouter(prefix="/tags", tags=["RSS Tags"])


@router.post("/", response_model=TagResponse, status_code=status.HTTP_201_CREATED)
async def create_tag(
    *,
    db: AsyncSession = Depends(get_db),
    tag_in: TagCreate = Body(...),
    current_user: TokenData = Depends(get_current_user),
):
    """Create a new tag for the current user."""
    rss_service = RssService(db=db, user_id=UUID(current_user.sub))
    try:
        # Normalization of tag_in.name is handled within RssService.create_tag
        tag = await rss_service.create_tag(tag_in=tag_in)
        logger.info(
            "Tag created successfully",
            tag_id=tag.id,
            user_id=current_user.sub,
            tag_name=tag.name,
        )
        return tag
    except ValueError as e:
        logger.warning(
            "Failed to create tag due to value error",
            error=str(e),
            user_id=current_user.sub,
            tag_name=tag_in.name,
        )
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(
            "Unexpected error creating tag",
            error=str(e),
            user_id=current_user.sub,
            tag_name=tag_in.name,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred.",
        )


@router.get("/", response_model=list[TagResponse])
async def list_tags(
    db: AsyncSession = Depends(get_db),
    skip: int = 0,
    limit: int = 100,
    current_user: TokenData = Depends(get_current_user),
):
    """List all tags for the current user."""
    rss_service = RssService(db=db, user_id=UUID(current_user.sub))
    tags = await rss_service.list_tags(skip=skip, limit=limit)
    return tags


@router.get("/{tag_id}", response_model=TagResponse)
async def get_tag(
    tag_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    """Get a specific tag by its ID."""
    rss_service = RssService(db=db, user_id=UUID(current_user.sub))
    tag = await rss_service.get_tag(tag_id=tag_id)
    if not tag:
        logger.warning(
            "Tag not found or access denied", tag_id=tag_id, user_id=current_user.sub
        )
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Tag not found"
        )
    return tag


@router.put("/{tag_id}", response_model=TagResponse)
async def update_tag(
    tag_id: UUID,
    tag_in: TagUpdate = Body(...),
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    """Update a tag's details."""
    rss_service = RssService(db=db, user_id=UUID(current_user.sub))
    try:
        # Normalization of tag_in.name is handled within RssService.update_tag
        updated_tag = await rss_service.update_tag(tag_id=tag_id, tag_in=tag_in)
        if not updated_tag:
            logger.warning(
                "Tag not found for update or access denied",
                tag_id=tag_id,
                user_id=current_user.sub,
            )
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Tag not found"
            )
        logger.info(
            "Tag updated successfully", tag_id=updated_tag.id, user_id=current_user.sub
        )
        return updated_tag
    except ValueError as e:
        logger.warning(
            "Failed to update tag due to value error",
            error=str(e),
            user_id=current_user.sub,
            tag_id=tag_id,
        )
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(
            "Unexpected error updating tag",
            error=str(e),
            user_id=current_user.sub,
            tag_id=tag_id,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred.",
        )


@router.delete("/{tag_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_tag(
    tag_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    """Delete a tag."""
    rss_service = RssService(db=db, user_id=UUID(current_user.sub))
    try:
        success = await rss_service.delete_tag(tag_id=tag_id)
        if not success:
            logger.warning(
                "Tag not found for deletion or access denied",
                tag_id=tag_id,
                user_id=current_user.sub,
            )
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Tag not found"
            )
        logger.info("Tag deleted successfully", tag_id=tag_id, user_id=current_user.sub)
        return  # Returns 204 No Content on success
    except (
        ValueError
    ) as e:  # Should not typically be raised by tag deletion unless logic changes
        logger.warning(
            "Failed to delete tag due to value error",
            error=str(e),
            user_id=current_user.sub,
            tag_id=tag_id,
        )
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(
            "Unexpected error deleting tag",
            error=str(e),
            user_id=current_user.sub,
            tag_id=tag_id,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred while deleting the tag.",
        )
