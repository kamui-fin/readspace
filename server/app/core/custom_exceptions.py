"""
Custom application exceptions
"""

from typing import Any

from fastapi import HTTPException, status


class ReadspaceException(Exception):
    """Base exception for all Readspace-specific errors"""

    def __init__(self, message: str, details: dict[str, Any] | None = None):
        self.message = message
        self.details = details or {}
        super().__init__(self.message)


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


class StorageError(ExternalServiceError):
    """Raised when file storage operations fail"""

    pass


class DatabaseError(ReadspaceException):
    """Raised when database operations fail"""

    pass


class ConfigurationError(ReadspaceException):
    """Raised when configuration is invalid"""

    pass


# HTTP Exception Factories
def http_not_found(message: str = "Resource not found") -> HTTPException:
    """Create a 404 HTTP exception"""
    return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=message)


def http_bad_request(message: str = "Bad request") -> HTTPException:
    """Create a 400 HTTP exception"""
    return HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=message)


def http_unauthorized(message: str = "Unauthorized") -> HTTPException:
    """Create a 401 HTTP exception"""
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=message,
        headers={"WWW-Authenticate": "Bearer"},
    )


def http_forbidden(message: str = "Forbidden") -> HTTPException:
    """Create a 403 HTTP exception"""
    return HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=message)


def http_conflict(message: str = "Resource already exists") -> HTTPException:
    """Create a 409 HTTP exception"""
    return HTTPException(status_code=status.HTTP_409_CONFLICT, detail=message)


def http_validation_error(message: str = "Validation failed") -> HTTPException:
    """Create a 422 HTTP exception"""
    return HTTPException(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=message
    )


def http_internal_server_error(message: str = "Internal server error") -> HTTPException:
    """Create a 500 HTTP exception"""
    return HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=message
    )
