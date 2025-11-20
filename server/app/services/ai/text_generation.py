"""Text generation functionality."""

import time

import structlog
from google.genai import types

from app.core.config import get_settings
from app.core.metrics import (
    ai_request_duration_seconds,
    ai_requests_total,
    ai_token_usage_total,
)
from app.services.ai.client import get_gemini_client

logger = structlog.get_logger(__name__)


class TextGenerationService:
    """Handles text generation using Gemini."""

    def __init__(self) -> None:
        self.gemini_client = get_gemini_client()
        self.settings = get_settings()
        self.model = self.settings.GEMINI_MODEL

    async def generate_text(
        self,
        prompt: str,
        system_prompt: str | None = None,
        max_tokens: int = 1000,
        temperature: float = 0.7,
    ) -> str:
        """
        Generate text using Gemini.

        Args:
            prompt: The user prompt
            system_prompt: Optional system prompt (combined with prompt)
            max_tokens: Maximum tokens to generate
            temperature: Generation temperature

        Returns:
            Generated text response
        """
        self.gemini_client.check_availability()

        start_time = time.perf_counter()
        operation = "generate_text"

        try:
            full_prompt = prompt
            if system_prompt:
                full_prompt = f"{system_prompt}\n\n{prompt}"

            logger.debug(
                "Generating text with Gemini",
                model=self.model,
                prompt_length=len(full_prompt),
                max_tokens=max_tokens,
            )

            response = self.gemini_client.client.models.generate_content(
                model=self.model,
                contents=full_prompt,
                config=types.GenerateContentConfig(temperature=temperature, max_output_tokens=max_tokens),
            )

            content = response.text or ""
            duration = time.perf_counter() - start_time

            ai_requests_total.labels(operation=operation, model=self.model, status="success").inc()
            ai_request_duration_seconds.labels(operation=operation, model=self.model).observe(duration)

            if hasattr(response, "usage_metadata") and response.usage_metadata:
                usage = response.usage_metadata
                if hasattr(usage, "prompt_token_count"):
                    ai_token_usage_total.labels(operation=operation, model=self.model, direction="prompt").inc(
                        usage.prompt_token_count
                    )
                if hasattr(usage, "candidates_token_count"):
                    ai_token_usage_total.labels(operation=operation, model=self.model, direction="response").inc(
                        usage.candidates_token_count
                    )

            logger.info(
                "Text generation completed",
                operation=operation,
                model=self.model,
                response_length=len(content),
                duration_seconds=round(duration, 3),
                prompt_tokens=usage.prompt_token_count
                if hasattr(response, "usage_metadata")
                and response.usage_metadata
                and hasattr(response.usage_metadata, "prompt_token_count")
                else None,
                response_tokens=usage.candidates_token_count
                if hasattr(response, "usage_metadata")
                and response.usage_metadata
                and hasattr(response.usage_metadata, "candidates_token_count")
                else None,
            )
            return content

        except Exception as e:
            duration = time.perf_counter() - start_time
            ai_requests_total.labels(operation=operation, model=self.model, status="error").inc()
            ai_request_duration_seconds.labels(operation=operation, model=self.model).observe(duration)

            logger.error(
                "Error generating text",
                operation=operation,
                model=self.model,
                error=str(e),
                error_type=type(e).__name__,
                duration_seconds=round(duration, 3),
                exc_info=True,
            )
            raise
