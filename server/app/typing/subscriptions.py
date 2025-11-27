"""Subscription schemas - DRY approach using SQLModel as base."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel

from app.typing.common import response_config
from app.typing.feeds import FeedSummary
from app.typing.folders import FolderResponse

# ================= Base (Field Bundle) =================


class SubscriptionBase(BaseModel):
    """Shared subscription settings."""

    is_favorite: bool = False
    custom_title: str | None = None


# ================= Requests =================


class SubscriptionCreate(SubscriptionBase):
    """Create subscription by URL - service discovers feed."""

    url: str  # Input can be loose string, service handles normalization
    folder_id: UUID | str = "default"


class SubscriptionCreateByFeedId(SubscriptionBase):
    """Create subscription by existing feed ID - no discovery needed."""

    folder_id: UUID | str = "default"


class SubscriptionUpdate(BaseModel):
    """Update subscription - all fields optional for PATCH."""

    is_favorite: bool | None = None
    custom_title: str | None = None
    folder_id: UUID | None = None


# ================= Responses =================


class SubscriptionResponse(SubscriptionBase):
    """
    Composite response: Subscription + embedded Feed + Folder.
    Optimized for sidebar view with denormalized data.
    """

    model_config = response_config

    id: UUID
    user_id: UUID
    folder_id: UUID

    # Dynamic/Calculated fields
    unread_count: int = 0

    # Embedded Objects
    feed: FeedSummary
    folder: FolderResponse | None = None

    created_at: datetime
