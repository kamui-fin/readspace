import structlog
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt

from app.core.config import get_settings
from app.typing.user import TokenData

logger = structlog.get_logger()

# Standard FastAPI Security Scheme
security = HTTPBearer()


def verify_token(token: str) -> TokenData:
    """
    Pure function to decode and validate JWT.
    """
    settings = get_settings()
    try:
        payload = jwt.decode(
            token,
            key=settings.SUPABASE_JWT_SECRET.get_secret_value(),
            algorithms=["HS256"],
            options={"verify_aud": False},  # Skip audience check for Supabase
        )

        return TokenData(
            sub=str(payload.get("sub")),
            email=payload.get("email"),
            role=payload.get("role"),
        )
    except JWTError as e:
        logger.warning("JWT verification failed", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        ) from e


def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> TokenData:
    """
    FastAPI dependency for requiring authentication.
    Usage: async def route(user: TokenData = Depends(get_current_user))
    """
    return verify_token(credentials.credentials)


def get_optional_user(credentials: HTTPAuthorizationCredentials | None = Depends(security)) -> TokenData | None:
    """
    FastAPI dependency that returns User if token exists, else None.
    Usage: async def route(user: TokenData | None = Depends(get_optional_user))
    """
    if not credentials:
        return None

    try:
        return verify_token(credentials.credentials)
    except HTTPException:
        # If token is present but invalid, treating it as anonymous is usually
        # safer than crashing, though strictly debating 401 is also valid.
        return None
