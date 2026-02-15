"""Subscription schemas - DRY approach using SQLModel as base."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel

from app.typing.common import response_config
from app.typing.feeds import FeedDetail, FeedSummary
from app.typing.folders import FolderResponse

# ================= Base =================


class SubscriptionBase(BaseModel):
    """Shared subscription settings."""

    is_favorite: bool = False
    custom_title: str | None = None


class SubscriptionCreateBase(BaseModel):
    """Base for subscription creation fields."""

    custom_title: str | None = None


# ================= Requests =================


class SubscriptionCreate(SubscriptionCreateBase):
    """Create subscription by URL - service discovers feed."""

    url: str  # Input can be loose string, service handles normalization
    folder_id: UUID | str = "default"


class SubscriptionCreateByFeedId(SubscriptionCreateBase):
    """Create subscription by existing feed ID - no discovery needed."""

    folder_id: UUID | str = "default"


class SubscriptionUpdate(BaseModel):
    """Update subscription - all fields optional for PATCH."""

    custom_title: str | None = None
    folder_id: UUID | None = None
    is_favorite: bool | None = None


# ================= Responses =================


class SubscriptionResponse(SubscriptionBase):
    """
    Composite response: Subscription + embedded Feed + Folder.
    Optimized for sidebar view with denormalized data.
    """

    model_config = response_config

    id: UUID

    feed: FeedSummary
    folder: FolderResponse

    created_at: datetime


class SubscriptionResponseExtended(SubscriptionResponse):
    """
    Extended response with full feed details.
    """

    feed: FeedDetail
