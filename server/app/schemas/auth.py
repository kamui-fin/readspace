from typing import Any

from pydantic import BaseModel


class TokenData(BaseModel):
    sub: str  # User ID
    email: str | None = None
    role: str | None = None
    app_metadata: dict[str, Any] | None = None
    user_metadata: dict[str, Any] | None = None
