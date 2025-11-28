"""
Custom application exceptions with structured error responses
"""

from typing import Any

import structlog
from fastapi import HTTPException, Request, status
from fastapi.responses import JSONResponse


class ReadspaceException(Exception):
    """Base exception for all Readspace-specific errors with structured error details"""

    def __init__(
        self,
        message: str,
        details: dict[str, Any] | None = None,
        error_code: str | None = None,
        field_errors: dict[str, str] | None = None,
    ):
        """
        Initialize a structured exception.

        Args:
            message: User-friendly error message
            details: Additional context/debug information
            error_code: Machine-readable error code (e.g., "FEED_ALREADY_EXISTS")
            field_errors: Field-specific validation errors {field_name: error_message}
        """
        self.message = message
        self.details = details or {}
        self.error_code = error_code
        self.field_errors = field_errors or {}
        super().__init__(self.message)

    def to_dict(self) -> dict[str, Any]:
        """Convert exception to structured error dictionary."""
        error_dict: dict[str, Any] = {
            "message": self.message,
        }

        if self.error_code:
            error_dict["error_code"] = self.error_code

        if self.field_errors:
            error_dict["field_errors"] = self.field_errors

        if self.details:
            error_dict["details"] = self.details

        return error_dict


class ValidationError(ReadspaceException):
    """Raised when input validation fails"""

    pass


class NotFoundError(ReadspaceException):
    """Raised when a resource is not found"""

    pass


class AuthenticationError(ReadspaceException):
    """Raised when authentication fails"""

    pass


class AuthorizationError(ReadspaceException):
    """Raised when user lacks permission for an operation"""

    pass


class DuplicateResourceError(ReadspaceException):
    """Raised when attempting to create a duplicate resource"""

    pass


class ExternalServiceError(ReadspaceException):
    """Raised when external service calls fail"""

    pass


class FeedParsingError(ExternalServiceError):
    """Raised when RSS/Atom feed parsing fails"""

    pass


class FeedConnectionError(ExternalServiceError):
    """Raised when feed URL cannot be reached"""

    pass


class FeedValidationError(ValidationError):
    """Raised when feed content is invalid"""

    pass


class FeedSubscriptionError(DuplicateResourceError):
    """Raised when feed subscription conflicts occur"""

    pass


class StorageError(ExternalServiceError):
    """Raised when file storage operations fail"""

    pass


class DatabaseError(ReadspaceException):
    """Raised when database operations fail"""

    pass


class ConfigurationError(ReadspaceException):
    """Raised when configuration is invalid"""

    pass


class ServiceUnavailableError(ReadspaceException):
    """Raised when a service is unavailable or not configured"""

    pass


class ResourceLimitError(ReadspaceException):
    """Raised when a user hits a usage limit (e.g. max subscriptions)"""

    pass


# Exception Mapper - Maps custom exceptions to HTTP exceptions
EXCEPTION_STATUS_MAP: dict[type[ReadspaceException], int] = {
    # Client errors (4xx)
    NotFoundError: status.HTTP_404_NOT_FOUND,
    ValidationError: status.HTTP_400_BAD_REQUEST,
    FeedValidationError: status.HTTP_400_BAD_REQUEST,
    FeedParsingError: status.HTTP_400_BAD_REQUEST,
    AuthenticationError: status.HTTP_401_UNAUTHORIZED,
    AuthorizationError: status.HTTP_403_FORBIDDEN,
    DuplicateResourceError: status.HTTP_409_CONFLICT,
    FeedSubscriptionError: status.HTTP_400_BAD_REQUEST,  # Already subscribed scenarios
    # Server errors (5xx)
    ExternalServiceError: status.HTTP_503_SERVICE_UNAVAILABLE,
    FeedConnectionError: status.HTTP_503_SERVICE_UNAVAILABLE,
    ServiceUnavailableError: status.HTTP_503_SERVICE_UNAVAILABLE,
    StorageError: status.HTTP_500_INTERNAL_SERVER_ERROR,
    DatabaseError: status.HTTP_500_INTERNAL_SERVER_ERROR,
    ConfigurationError: status.HTTP_500_INTERNAL_SERVER_ERROR,
    ResourceLimitError: status.HTTP_429_TOO_MANY_REQUESTS,
}


def to_http_exception(exc: ReadspaceException) -> HTTPException:
    """Convert a custom exception to an HTTP exception with structured error details.

    Args:
        exc: Custom exception to convert

    Returns:
        HTTPException with appropriate status code and structured error detail

    Example:
        try:
            feed = await feed_service.get_feed(feed_id)
        except ReadspaceException as e:
            raise to_http_exception(e)
    """
    status_code = EXCEPTION_STATUS_MAP.get(type(exc), status.HTTP_500_INTERNAL_SERVER_ERROR)

    # Add authentication headers for 401 responses
    headers = None
    if status_code == status.HTTP_401_UNAUTHORIZED:
        headers = {"WWW-Authenticate": "Bearer"}

    # Use structured error response if exception provides it
    detail = exc.to_dict()

    return HTTPException(status_code=status_code, detail=detail, headers=headers)


logger = structlog.get_logger("api.errors")


async def readspace_exception_handler(request: Request, exc: Exception):
    """
    Global handler for all ReadspaceException subclasses.
    Automatically maps the exception to the correct HTTP status code and JSON format.
    """
    if not isinstance(exc, ReadspaceException):
        # Fallback for non-ReadspaceException exceptions
        logger.error("Unexpected exception type", exc_type=type(exc).__name__, path=request.url.path)
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"message": "An unexpected error occurred"},
        )
    # 1. Determine Status Code from your existing MAP
    # Use strict type checking first, fallback to parent classes, default to 500
    status_code = EXCEPTION_STATUS_MAP.get(type(exc))

    if not status_code:
        # If specific class not mapped, check if it's a subclass of a mapped error
        for mapped_exc, code in EXCEPTION_STATUS_MAP.items():
            if isinstance(exc, mapped_exc):
                status_code = code
                break
        else:
            status_code = status.HTTP_500_INTERNAL_SERVER_ERROR

    # 2. Log it (Orthogonality: Logging logic lives here, not in the route)
    # We can access request details here if needed
    log_method = logger.error if status_code >= 500 else logger.warning
    log_method(
        "Application exception occurred",
        error_code=exc.error_code,
        message=exc.message,
        details=exc.details,
        path=request.url.path,
        status_code=status_code,
    )

    # 3. Return JSON Response
    return JSONResponse(
        status_code=status_code,
        content=exc.to_dict(),
    )
