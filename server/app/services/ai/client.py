"""Gemini client initialization and availability checking."""

import structlog
from google import genai

from app.core.config import get_settings
from app.core.custom_exceptions import ServiceUnavailableError

logger = structlog.get_logger(__name__)


class GeminiClient:
    """Manages Gemini client initialization and availability."""

    def __init__(self) -> None:
        self.settings = get_settings()
        self.client = None
        self._initialization_error = None

        if not self.settings.ENABLE_AI:
            self._initialization_error = "AI features are disabled in the configuration."
            logger.info("AI features disabled")
            return

        if not self.settings.GEMINI_API_KEY:
            self._initialization_error = "AI features are not configured. Please contact your administrator."
            logger.warning("AI service initialized without API key")
            return

        try:
            self.client = genai.Client(api_key=self.settings.GEMINI_API_KEY)
            logger.info("Gemini client initialized successfully")
        except Exception as e:
            self._initialization_error = "AI service is temporarily unavailable. Please try again later."
            logger.error("Failed to initialize Gemini client", error=str(e), exc_info=True)

    def check_availability(self) -> None:
        """Check if AI service is available and raise appropriate error if not."""
        if self._initialization_error:
            raise ServiceUnavailableError(self._initialization_error)

        if not self.client:
            raise ServiceUnavailableError("AI service is not properly initialized.")

    def is_available(self) -> bool:
        """Check if AI service is available without raising exceptions."""
        return self._initialization_error is None and self.client is not None

    def get_status_message(self) -> str:
        """Get a user-friendly status message about AI availability."""
        if self._initialization_error:
            return self._initialization_error
        if self.client:
            return "AI features are available."
        return "AI service status unknown."


# Singleton instance
_gemini_client: GeminiClient | None = None


def get_gemini_client() -> GeminiClient:
    """Get the singleton Gemini client instance."""
    global _gemini_client
    if _gemini_client is None:
        _gemini_client = GeminiClient()
    return _gemini_client
