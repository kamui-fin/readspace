"""AI Service for OpenAI-compatible API interactions."""

from typing import Any

import structlog
from openai import AsyncOpenAI

from app.core.config import get_settings

logger = structlog.get_logger(__name__)


class AIService:
    """Service for interacting with OpenAI-compatible AI APIs (like Ollama)."""

    def __init__(self):
        self.settings = get_settings()
        self.client = AsyncOpenAI(
            api_key=self.settings.OPENAI_API_KEY,
            base_url=self.settings.OPENAI_BASE_URL,
        )
        self.model = self.settings.AI_MODEL

    async def generate_text(
        self,
        prompt: str,
        system_prompt: str | None = None,
        max_tokens: int = 1000,
        temperature: float = 0.7,
        **kwargs: Any,
    ) -> str:
        """
        Generate text using the configured AI model.
        
        Args:
            prompt: The user prompt
            system_prompt: Optional system prompt
            max_tokens: Maximum tokens to generate
            temperature: Generation temperature
            **kwargs: Additional parameters for the API
            
        Returns:
            Generated text response
        """
        try:
            messages = []
            if system_prompt:
                messages.append({"role": "system", "content": system_prompt})
            messages.append({"role": "user", "content": prompt})

            logger.debug(
                "Generating text",
                model=self.model,
                prompt_length=len(prompt),
                max_tokens=max_tokens,
            )

            response = await self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                max_tokens=max_tokens,
                temperature=temperature,
                **kwargs,
            )

            if response.choices and response.choices[0].message:
                content = response.choices[0].message.content or ""
                logger.debug(
                    "Text generation completed",
                    response_length=len(content),
                    finish_reason=response.choices[0].finish_reason,
                )
                return content

            logger.warning("Empty response from AI model")
            return ""

        except Exception as e:
            logger.error("Error generating text", error=str(e), exc_info=True)
            raise

    async def generate_embedding(self, text: str) -> list[float] | None:
        """
        Generate embeddings for the given text using the configured embedding model.
        
        Args:
            text: Text to generate embeddings for
            
        Returns:
            List of floats representing the embedding, or None if failed
        """
        try:
            logger.debug(
                "Generating embedding",
                model=self.settings.EMBEDDING_MODEL,
                text_length=len(text),
            )

            response = await self.client.embeddings.create(
                model=self.settings.EMBEDDING_MODEL, input=[text]
            )

            if response.data and len(response.data) > 0:
                embedding = response.data[0].embedding
                logger.debug(
                    "Embedding generation completed", embedding_dimensions=len(embedding)
                )
                return embedding

            logger.warning("Empty embedding response")
            return None

        except Exception as e:
            logger.error("Error generating embedding", error=str(e), exc_info=True)
            return None

    async def generate_embeddings_batch(self, texts: list[str]) -> list[list[float] | None]:
        """
        Generate embeddings for multiple texts in a single request.
        
        Args:
            texts: List of texts to generate embeddings for
            
        Returns:
            List of embeddings (or None for failed ones)
        """
        try:
            logger.debug(
                "Generating batch embeddings",
                model=self.settings.EMBEDDING_MODEL,
                batch_size=len(texts),
            )

            response = await self.client.embeddings.create(
                model=self.settings.EMBEDDING_MODEL, input=texts
            )

            embeddings = []
            for i, data in enumerate(response.data):
                if data.embedding:
                    embeddings.append(data.embedding)
                else:
                    logger.warning(f"Empty embedding for text {i}")
                    embeddings.append(None)

            logger.debug(
                "Batch embedding generation completed",
                successful_embeddings=sum(1 for e in embeddings if e is not None),
            )
            return embeddings

        except Exception as e:
            logger.error("Error generating batch embeddings", error=str(e), exc_info=True)
            return [None] * len(texts)

    async def health_check(self) -> dict[str, Any]:
        """
        Check if the AI service is healthy and responsive.
        
        Returns:
            Health status dictionary
        """
        try:
            # Try a simple embedding generation
            test_embedding = await self.generate_embedding("test")
            embedding_healthy = test_embedding is not None

            # Try a simple text generation
            try:
                test_response = await self.generate_text("Say 'OK'", max_tokens=10)
                text_healthy = len(test_response.strip()) > 0
            except Exception:
                text_healthy = False

            return {
                "healthy": embedding_healthy and text_healthy,
                "embedding_service": embedding_healthy,
                "text_generation": text_healthy,
                "base_url": self.settings.OPENAI_BASE_URL,
                "embedding_model": self.settings.EMBEDDING_MODEL,
                "ai_model": self.model,
            }

        except Exception as e:
            logger.error("Health check failed", error=str(e))
            return {
                "healthy": False,
                "error": str(e),
                "base_url": self.settings.OPENAI_BASE_URL,
                "embedding_model": self.settings.EMBEDDING_MODEL,
                "ai_model": self.model,
            }


# Singleton instance
_ai_service: AIService | None = None


def get_ai_service() -> AIService:
    """Get the singleton AI service instance."""
    global _ai_service
    if _ai_service is None:
        _ai_service = AIService()
    return _ai_service
