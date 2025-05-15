import functools
from typing import Optional

import structlog
from app.repositories.supabase import get_supabase_client
from app.schemas.auth import TokenData
from app.schemas.settings import Settings
from fastapi import HTTPException, Request, status
from jose import JWTError, jwt

logger = structlog.get_logger()


def verify_token(token: str) -> TokenData:
    """Verify and decode a JWT token."""
    try:
        settings = Settings()
        payload = jwt.decode(
            token,
            key=settings.jwt_secret.get_secret_value(),
            algorithms=["HS256"],
            options={"verify_aud": False},  # Skip audience verification
        )
        return TokenData(
            sub=payload.get("sub"),
            email=payload.get("email"),
            role=payload.get("role"),
            app_metadata=payload.get("app_metadata"),
            user_metadata=payload.get("user_metadata"),
        )
    except JWTError as e:
        logger.error(f"JWT verification error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token"
        )


def get_current_user(request: Request) -> TokenData:
    """FastAPI dependency to get the current authenticated user."""
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid authorization header",
        )

    token = auth_header.split(" ")[1]
    token_data = verify_token(token)
    token_data.role = get_user_role(token_data.sub)
    return token_data


def get_user_role(user_id: str) -> str:
    """Get the role of the user from the database."""
    supabase = get_supabase_client()
    user = supabase.table("profiles").select("role").eq("id", user_id).execute().data[0]
    return user["role"]


# Optional dependency that doesn't require auth but provides user if available
def get_optional_user(request: Request) -> Optional[TokenData]:
    """FastAPI dependency to get the current user if available, but doesn't require auth."""
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        return None

    try:
        token = auth_header.split(" ")[1]
        return verify_token(token)
    except HTTPException:
        return None


def requires_auth(f):
    """
    Decorator for routes that require authentication.
    This simplifies protecting routes and handling errors.

    Usage:
        @router.get("/protected")
        @requires_auth
        async def protected_route(request: Request):
            user = request.state.user  # User is guaranteed to be available
            return {"message": f"Hello, {user.email}!"}
    """

    @functools.wraps(f)
    async def decorated_function(request: Request, *args, **kwargs):
        if not hasattr(request.state, "user") or request.state.user is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication required",
            )
        return await f(request, *args, **kwargs)

    return decorated_function
