"""Composite response models to avoid circular imports."""

from pydantic import BaseModel

from app.typing.folders import FolderResponse
from app.typing.subscriptions import SubscriptionResponse, SubscriptionResponseExtended


class FeedsResponse(BaseModel):
    """
    Unified response for feeds and folders.
    Ensures empty folders are included in the initial load.
    """

    subscriptions: list[SubscriptionResponse | SubscriptionResponseExtended]
    folders: list[FolderResponse]
