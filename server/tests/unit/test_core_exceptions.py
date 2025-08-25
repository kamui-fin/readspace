"""Tests for core exceptions module."""

import pytest
from fastapi import status

from app.core.exceptions import (
    AppException,
    AuthenticationError,
    StorageError,
    ValidationError,
)


@pytest.mark.unit
class TestAppException:
    def test_app_exception_with_default_status_code(self):
        """Test AppException with default status code."""
        exception = AppException("Test error")
        
        assert exception.message == "Test error"
        assert exception.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR
        assert str(exception) == "Test error"

    def test_app_exception_with_custom_status_code(self):
        """Test AppException with custom status code."""
        exception = AppException("Custom error", status.HTTP_400_BAD_REQUEST)
        
        assert exception.message == "Custom error"
        assert exception.status_code == status.HTTP_400_BAD_REQUEST
        assert str(exception) == "Custom error"


@pytest.mark.unit
class TestStorageError:
    def test_storage_error_inherits_from_app_exception(self):
        """Test that StorageError inherits from AppException."""
        exception = StorageError("Storage failed")
        
        assert isinstance(exception, AppException)
        assert exception.message == "Storage failed"
        assert exception.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR

    def test_storage_error_with_custom_status_code(self):
        """Test StorageError with custom status code."""
        exception = StorageError("Storage failed", status.HTTP_503_SERVICE_UNAVAILABLE)
        
        assert exception.message == "Storage failed"
        assert exception.status_code == status.HTTP_503_SERVICE_UNAVAILABLE


@pytest.mark.unit
class TestAuthenticationError:
    def test_authentication_error_with_default_message(self):
        """Test AuthenticationError with default message."""
        exception = AuthenticationError()
        
        assert exception.message == "Authentication failed"
        assert exception.status_code == status.HTTP_401_UNAUTHORIZED

    def test_authentication_error_with_custom_message(self):
        """Test AuthenticationError with custom message."""
        exception = AuthenticationError("Invalid token")
        
        assert exception.message == "Invalid token"
        assert exception.status_code == status.HTTP_401_UNAUTHORIZED

    def test_authentication_error_inherits_from_app_exception(self):
        """Test that AuthenticationError inherits from AppException."""
        exception = AuthenticationError()
        
        assert isinstance(exception, AppException)


@pytest.mark.unit
class TestValidationError:
    def test_validation_error_with_message(self):
        """Test ValidationError with message."""
        exception = ValidationError("Invalid input")
        
        assert exception.message == "Invalid input"
        assert exception.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    def test_validation_error_inherits_from_app_exception(self):
        """Test that ValidationError inherits from AppException."""
        exception = ValidationError("Invalid input")
        
        assert isinstance(exception, AppException)

    def test_validation_error_str_representation(self):
        """Test ValidationError string representation."""
        exception = ValidationError("Invalid field value")
        
        assert str(exception) == "Invalid field value"