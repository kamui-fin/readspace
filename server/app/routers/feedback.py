from typing import Annotated

from app.core.auth import get_current_user_optional
from app.db.session import get_db
from app.models.feedback_models import Feedback
from app.schemas.feedback import FeedbackCreate, FeedbackResponse
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(prefix="/feedback", tags=["feedback"])


@router.post("", response_model=FeedbackResponse)
async def create_feedback(
    feedback: FeedbackCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[dict | None, Depends(get_current_user_optional)] = None,
):
    """
    Create a new feedback entry.
    """
    db_feedback = Feedback(
        user_id=current_user["id"] if current_user else None,
        feedback_type=feedback.feedback_type,
        description=feedback.description,
        allow_follow_up=feedback.allow_follow_up,
    )
    
    db.add(db_feedback)
    await db.commit()
    await db.refresh(db_feedback)
    
    return db_feedback 