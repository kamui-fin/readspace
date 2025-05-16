from typing import Annotated, List, Optional
from uuid import UUID

from app.core.dependencies import get_current_user
from app.core.database import get_db
from app.models.feedback_models import Feedback
from app.repositories.feedback import FeedbackRepository
from app.schemas.feedback import FeedbackCreate, FeedbackResponse
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(prefix="/feedback", tags=["feedback"])
feedback_repo = FeedbackRepository()


@router.post("/", response_model=FeedbackResponse)
async def create_feedback(
    feedback: FeedbackCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[Optional[dict], Depends(get_current_user)] = None
):
    """
    Create a new feedback entry.
    """
    db_feedback = Feedback(
        user_id=user["id"] if user else None,
        feedback_type=feedback.feedback_type,
        description=feedback.description,
        allow_follow_up=feedback.allow_follow_up,
    )

    db.add(db_feedback)
    await db.commit()
    await db.refresh(db_feedback)

    return db_feedback

@router.get("/", response_model=List[FeedbackResponse])
async def get_feedback(
    db: Annotated[AsyncSession, Depends(get_db)],
    skip: int = 0,
    limit: int = 100
):
    return await feedback_repo.get_all(db, skip, limit)

@router.get("/{feedback_id}", response_model=FeedbackResponse)
async def get_feedback_by_id(
    feedback_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)]
):
    feedback = await feedback_repo.get(db, feedback_id)
    if not feedback:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Feedback not found")
    return feedback
