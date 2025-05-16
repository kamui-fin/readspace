from datetime import datetime
from typing import Optional
from uuid import UUID

from app.models.feedback_models import FeedbackType
from pydantic import BaseModel


class FeedbackCreate(BaseModel):
    feedback_type: FeedbackType
    description: str
    allow_follow_up: bool = False


class FeedbackResponse(BaseModel):
    id: UUID
    user_id: Optional[UUID]
    feedback_type: FeedbackType
    description: str
    allow_follow_up: bool
    created_at: datetime

    class Config:
        from_attributes = True
