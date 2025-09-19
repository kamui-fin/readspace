"""User and profile endpoints."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud.crud_profile import crud_profile
from app.db.session import get_db
from app.schemas.user_schemas import ProfileResponse
from app.services.auth import TokenData, get_current_user

router = APIRouter(prefix="/users", tags=["Users"])


@router.get(
    "/profile",
    response_model=ProfileResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Current User Profile",
    description="Retrieve the authenticated user's profile information including email, role, and timestamps.",
    responses={
        200: {
            "description": "User profile retrieved successfully",
            "model": ProfileResponse,
            "content": {
                "application/json": {
                    "example": {
                        "id": "123e4567-e89b-12d3-a456-426614174000",
                        "email": "user@example.com",
                        "role": "user",
                        "created_at": "2024-01-01T00:00:00Z",
                        "updated_at": "2024-01-01T00:00:00Z",
                    }
                }
            },
        },
        401: {
            "description": "Authentication failed - invalid or missing token",
            "content": {
                "application/json": {
                    "examples": {
                        "missing_token": {
                            "summary": "Missing authentication token",
                            "value": {"detail": "Not authenticated"},
                        },
                        "invalid_token": {
                            "summary": "Invalid or expired token",
                            "value": {"detail": "Could not validate credentials"},
                        },
                    }
                }
            },
        },
        404: {
            "description": "User profile not found in database",
            "content": {"application/json": {"example": {"detail": "User profile not found"}}},
        },
        422: {
            "description": "Validation error in request parameters",
            "content": {
                "application/json": {"example": {"detail": [{"loc": ["string"], "msg": "string", "type": "string"}]}}
            },
        },
    },
)
async def get_current_user_profile(
    current_user: TokenData = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ProfileResponse:
    """
    Retrieve the authenticated user's profile information.

    This endpoint returns the complete profile information for the currently
    authenticated user, including their unique identifier, email address,
    assigned role, and account creation/modification timestamps.

    Args:
        current_user: The authenticated user's token data, automatically
                     extracted from the Authorization header
        db: Database session dependency for data access

    Returns:
        ProfileResponse: Complete user profile information including:
            - id: Unique user identifier (UUID)
            - email: User's email address
            - role: User's role in the system (e.g., 'user', 'admin')
            - created_at: Account creation timestamp
            - updated_at: Last profile modification timestamp

    Raises:
        HTTPException:
            - 401: If authentication token is missing, invalid, or expired
            - 404: If the user profile is not found in the database
            - 422: If request validation fails

    Example:
        ```python
        # Request headers
        Authorization: Bearer <jwt_token>

        # Response
        {
            "id": "123e4567-e89b-12d3-a456-426614174000",
            "email": "user@example.com",
            "role": "user",
            "created_at": "2024-01-01T00:00:00Z",
            "updated_at": "2024-01-01T00:00:00Z"
        }
        ```
    """
    profile = await crud_profile.get_by_id(db, user_id=UUID(current_user.sub))
    if not profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User profile not found")
    return profile
