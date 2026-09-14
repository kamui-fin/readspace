"""
Functional Feed Enrichment via the Gemini Developer API's Batch mode.
"""

import asyncio
import time
from typing import Any

import structlog
from google.genai import types

from app.core.config import get_settings
from app.services.ai.client import get_gemini_client
from app.services.ai.prompts import ENRICHMENT_SYSTEM_PROMPT
from app.typing.feeds import FeedEnrichmentInput, FeedEnrichmentResponse

logger = structlog.get_logger(__name__)

_TERMINAL_STATES = (
    "JOB_STATE_SUCCEEDED",
    "JOB_STATE_FAILED",
    "JOB_STATE_CANCELLED",
    "JOB_STATE_PAUSED",
    "JOB_STATE_EXPIRED",
)


async def enrich_feeds_batch(
    feeds: list[FeedEnrichmentInput],
    timeout_seconds: int = 3600,  # 1 hour maximum timeout for safety
) -> list[FeedEnrichmentResponse | None]:
    """Process a list of feeds via the Gemini Developer API's Batch mode, using inline requests."""
    if not feeds:
        return []

    client = get_gemini_client()
    if not client:
        logger.warning("Feed enrichment skipped: no Gemini client configured")
        return [None] * len(feeds)

    settings = get_settings()

    try:
        job = client.batches.create(
            model=settings.GEMINI_SMART_MODEL,
            src=[_build_request(feed, index) for index, feed in enumerate(feeds)],  # type: ignore[arg-type]
        )
        if not job.name:
            raise RuntimeError("Gemini batch job was created without a name")
        logger.info("Gemini batch job submitted", job=job.name, size=len(feeds))

        job = await _poll_job(client, job.name, timeout_seconds)

        if job.state.name != "JOB_STATE_SUCCEEDED":
            logger.error("Gemini batch job failed", state=job.state.name)
            return [None] * len(feeds)

        return _parse_inlined_responses(job, count=len(feeds))

    except Exception as e:
        logger.error("Gemini batch enrichment failed", error=str(e), exc_info=True)
        return [None] * len(feeds)


def _build_request(feed: FeedEnrichmentInput, index: int) -> dict[str, Any]:
    """Build a single inline batch request, tagged with its index for response correlation."""
    lang_note = f"Content Language: {feed.language}. "

    extras = []
    if feed.link:
        extras.append(f"Website: {feed.link}")
    if feed.url:
        extras.append(f"RSS: {feed.url}")
    if feed.tags:
        extras.append(f"Tags: {', '.join(feed.tags)}")
    if feed.contributors:
        extras.append(f"Contributors: {', '.join(feed.contributors)}")

    extra_text = "\n".join(extras)
    user_prompt = f"{lang_note}\nTitle: {feed.title}\nDesc: {feed.description}\nDomain: {feed.domain}\n{extra_text}"

    return {
        "contents": [{"role": "user", "parts": [{"text": user_prompt}]}],
        "config": types.GenerateContentConfig(
            system_instruction=ENRICHMENT_SYSTEM_PROMPT,
            temperature=0.2,
            # GEMINI_SMART_MODEL is a thinking model; its reasoning tokens are billed against
            # max_output_tokens before the JSON answer itself, so the budget must cover both
            # (observed ~700-960 thinking tokens per feed) or responses truncate mid-JSON.
            max_output_tokens=2000,
            response_mime_type="application/json",
            response_schema=FeedEnrichmentResponse,
        ),
        "metadata": {"index": str(index)},
    }


async def _poll_job(client: Any, job_name: str, timeout_seconds: int) -> Any:
    """Poll batch job state with defensive timeouts."""
    start = time.time()
    last_log_time = 0.0

    while (time.time() - start) < timeout_seconds:
        job = client.batches.get(name=job_name)

        if job and job.state and job.state.name in _TERMINAL_STATES:
            return job

        current_time = time.time()
        # Log job status once every 60s to keep standard output logs clean
        if current_time - last_log_time >= 60:
            logger.info(
                "Batch job polling state",
                job=job_name.split("/")[-1],
                state=getattr(job.state, "name", "UNKNOWN"),
            )
            last_log_time = current_time

        await asyncio.sleep(60)
    raise TimeoutError("Batch job timed out")


def _parse_inlined_responses(job: Any, count: int) -> list[FeedEnrichmentResponse | None]:
    """Map inlined batch responses back to their originating feeds via index metadata."""
    results: list[FeedEnrichmentResponse | None] = [None] * count
    inlined_responses = getattr(job.dest, "inlined_responses", None) or []

    for inlined in inlined_responses:
        try:
            index = int(inlined.metadata["index"])
        except (TypeError, KeyError, ValueError):
            logger.warning("Batch response missing index metadata")
            continue

        if not (0 <= index < count):
            logger.warning("Batch response index out of range", index=index)
            continue

        if inlined.error:
            logger.warning("Feed enrichment request failed", index=index, error=str(inlined.error))
            continue

        parsed = getattr(inlined.response, "parsed", None)
        if isinstance(parsed, FeedEnrichmentResponse):
            results[index] = parsed
            continue

        text = getattr(inlined.response, "text", None)
        if not text:
            logger.warning("Feed enrichment response had no parsable output", index=index)
            continue

        try:
            results[index] = FeedEnrichmentResponse.model_validate_json(text)
        except Exception as e:
            logger.warning("Failed to parse feed enrichment response", index=index, error=str(e))

    return results
