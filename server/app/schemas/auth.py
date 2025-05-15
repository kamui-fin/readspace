from typing import Any, Dict, Optional

from pydantic import BaseModel


class TokenData(BaseModel):
    sub: str  # User ID
    email: Optional[str] = None
    role: Optional[str] = None
    app_metadata: Optional[Dict[str, Any]] = None
    user_metadata: Optional[Dict[str, Any]] = None
