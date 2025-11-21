"""Embedding generation functionality."""

import time

import structlog

from app.core.config import get_settings
from app.services.ai.client import get_gemini_client

logger = structlog.get_logger(__name__)


class EmbeddingService:
    """Handles embedding generation using Gemini."""

    def __init__(self) -> None:
        self.gemini_client = get_gemini_client()
        self.settings = get_settings()
        self.embedding_model = self.settings.GEMINI_EMBEDDING_MODEL

    async def generate_embedding(self, text: str) -> list[float] | None:
        """
        Generate embeddings using Gemini embedding model.

        Args:
            text: Text to generate embeddings for

        Returns:
            List of floats representing the embedding, or None if failed
        """
        self.gemini_client.check_availability()

        try:
            response = self.gemini_client.client.models.embed_content(
                model=self.embedding_model,
                contents=[text],  # type: ignore[arg-type]
            )

            if response.embeddings and len(response.embeddings) > 0:
                embedding_result = response.embeddings[0]
                if (
                    embedding_result
                    and hasattr(embedding_result, "values")
                    and embedding_result.values
                    and len(embedding_result.values) > 0
                ):
                    embedding: list[float] = list(embedding_result.values)
                    logger.debug(
                        "Gemini embedding generation completed",
                        embedding_dimensions=len(embedding),
                    )
                    return embedding

            logger.warning("Empty embedding response from Gemini")
            return None

        except Exception as e:
            logger.error("Error generating Gemini embedding", error=str(e), exc_info=True)
            return None

    async def generate_embeddings_batch(self, texts: list[str]) -> list[list[float] | None]:
        """
        Generate embeddings for multiple texts using Gemini batch API.

        Args:
            texts: List of texts to generate embeddings for

        Returns:
            List of embeddings (or None for failed ones)
        """
        self.gemini_client.check_availability()

        start_time = time.perf_counter()
        operation = "embed_batch"

        try:
            logger.debug(
                "Generating batch embeddings with Gemini",
                model=self.embedding_model,
                batch_size=len(texts),
            )

            response = self.gemini_client.client.models.embed_content(
                model=self.embedding_model,
                contents=texts,  # type: ignore[arg-type]
            )

            embeddings: list[list[float] | None] = []
            if response.embeddings:
                for i, embedding_result in enumerate(response.embeddings):
                    if (
                        embedding_result
                        and hasattr(embedding_result, "values")
                        and embedding_result.values
                        and len(embedding_result.values) > 0
                    ):
                        embeddings.append(list(embedding_result.values))
                    else:
                        logger.warning("Empty embedding returned from AI service", text_index=i, batch_size=len(texts))
                        embeddings.append(None)
            else:
                embeddings = [None] * len(texts)

            duration = time.perf_counter() - start_time
            successful_count = sum(1 for e in embeddings if e is not None)

            logger.info(
                "Batch embedding generation completed",
                operation=operation,
                model=self.embedding_model,
                batch_size=len(texts),
                successful_embeddings=successful_count,
                failed_embeddings=len(texts) - successful_count,
                duration_seconds=round(duration, 3),
            )
            return embeddings

        except Exception as e:
            duration = time.perf_counter() - start_time

            logger.error(
                "Error generating batch embeddings",
                operation=operation,
                model=self.embedding_model,
                batch_size=len(texts),
                error=str(e),
                error_type=type(e).__name__,
                duration_seconds=round(duration, 3),
                exc_info=True,
            )
            return [None] * len(texts)
