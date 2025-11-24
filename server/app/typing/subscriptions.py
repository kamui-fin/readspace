"""User-Feed Relationship definitions."""

from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field
from .feeds import FeedSummary
from .folders import FolderResponse


class SubscriptionBase(BaseModel):
    is_favorite: bool = False
    custom_title: str | None = None


class SubscriptionCreate(SubscriptionBase):
    url: str  # Input can be loose string, service handles normalization
    folder_id: UUID | str = "default"


class SubscriptionUpdate(SubscriptionBase):
    folder_id: UUID | None = None


class SubscriptionResponse(SubscriptionBase):
    """
    Composite Object: Subscription Settings + Embedded Feed Summary.
    Optimized for the "Sidebar" view.
    """

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: UUID
    folder_id: UUID

    # Dynamic/Calculated fields
    unread_count: int = 0

    # Embedded Objects
    feed: FeedSummary
    folder: FolderResponse | None = None

    created_at: datetime
