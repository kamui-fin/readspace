"""Codex Digest LLM calls - Phase 1 triage/cluster and Phase 2 synthesis.

Both calls use GEMINI_SMART_MODEL and Gemini's structured-output feature (response_schema),
never a "return only JSON" instruction. The client itself is synchronous (matching the only
other Gemini call site in this codebase, services/ai/service.py) so calls run via
asyncio.to_thread to avoid blocking the worker's event loop.
"""

import asyncio
import json
from functools import lru_cache
from typing import TypeVar

import structlog
from google import genai
from google.genai import types
from pydantic import BaseModel
from tenacity import retry, retry_if_exception_type, stop_after_attempt, wait_exponential

from app.core.config import get_settings
from app.services.ai.prompts import get_codex_synthesis_system_prompt, get_codex_triage_system_prompt
from app.typing.codex import CodexSynthesisOutput, CodexTriageOutput

logger = structlog.get_logger(__name__)

SchemaT = TypeVar("SchemaT", bound=BaseModel)


class CodexGenerationError(Exception):
    """Raised when a Codex LLM call fails after retries, or returns unparsable output."""


@lru_cache(maxsize=1)
def _get_client() -> genai.Client | None:
    """Lazy load the Gemini client. Mirrors services/ai/service.py::_get_client."""
    settings = get_settings()
    if not settings.ENABLE_AI:
        return None
    try:
        if settings.GOOGLE_CLOUD_PROJECT:
            return genai.Client(
                vertexai=True,
                project=settings.GOOGLE_CLOUD_PROJECT,
                location=settings.GOOGLE_CLOUD_LOCATION,
            )
        elif settings.GEMINI_API_KEY:
            return genai.Client(api_key=settings.GEMINI_API_KEY)
    except Exception as e:
        logger.error("Failed to initialize Gemini client for Codex", error=str(e))
    return None


@retry(
    retry=retry_if_exception_type(Exception),
    stop=stop_after_attempt(2),
    wait=wait_exponential(multiplier=1, min=1, max=8),
    reraise=True,
)
async def run_codex_triage(triage_prompt: str) -> CodexTriageOutput:
    """Phase 1: cluster + rank the whole catalog. Raises CodexGenerationError on failure."""
    client = _get_client()
    if not client:
        raise CodexGenerationError("AI is disabled or no Gemini client is configured")

    settings = get_settings()

    def _call() -> types.GenerateContentResponse:
        return client.models.generate_content(
            model=settings.GEMINI_SMART_MODEL,
            contents=triage_prompt,
            config=types.GenerateContentConfig(
                system_instruction=get_codex_triage_system_prompt(),
                response_mime_type="application/json",
                response_schema=CodexTriageOutput,
                temperature=0.3,
            ),
        )

    try:
        resp = await asyncio.to_thread(_call)
    except Exception as e:
        logger.error("Codex triage call failed", error=str(e))
        raise

    return _parse_response(resp, CodexTriageOutput, stage="triage")


@retry(
    retry=retry_if_exception_type(Exception),
    stop=stop_after_attempt(2),
    wait=wait_exponential(multiplier=1, min=1, max=8),
    reraise=True,
)
async def run_codex_synthesis(synthesis_prompt: str) -> CodexSynthesisOutput:
    """Phase 2: write the finished digest over the chosen full-text articles."""
    client = _get_client()
    if not client:
        raise CodexGenerationError("AI is disabled or no Gemini client is configured")

    settings = get_settings()

    def _call() -> types.GenerateContentResponse:
        return client.models.generate_content(
            model=settings.GEMINI_SMART_MODEL,
            contents=synthesis_prompt,
            config=types.GenerateContentConfig(
                system_instruction=get_codex_synthesis_system_prompt(),
                response_mime_type="application/json",
                response_schema=CodexSynthesisOutput,
                temperature=0.4,
            ),
        )

    try:
        resp = await asyncio.to_thread(_call)
    except Exception as e:
        logger.error("Codex synthesis call failed", error=str(e))
        raise

    return _parse_response(resp, CodexSynthesisOutput, stage="synthesis")


def _parse_response(
    resp: types.GenerateContentResponse,
    schema: type[SchemaT],
    *,
    stage: str,
) -> SchemaT:
    """Read resp.parsed, falling back to json.loads(resp.text) + model_validate."""
    parsed = getattr(resp, "parsed", None)
    if isinstance(parsed, schema):
        return parsed

    text = getattr(resp, "text", None)
    if not text:
        raise CodexGenerationError(f"Codex {stage} returned no parsable output")

    try:
        data = json.loads(text)
        return schema.model_validate(data)
    except Exception as e:
        logger.error(f"Codex {stage} output failed to parse", error=str(e), raw_response=text[:2000])
        raise CodexGenerationError(f"Codex {stage} output was malformed") from e
