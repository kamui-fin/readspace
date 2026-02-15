"""
Functional Feed Enrichment via Gemini Batch API.
"""

import asyncio
import os
import tempfile
import time
from typing import Any

import orjson
import structlog
from google import genai
from google.genai import types

from app.core.config import get_settings
from app.services.ai.prompts import ENRICHMENT_SYSTEM_PROMPT
from app.services.ai.service import _get_client  # Re-use the singleton
from app.typing.feeds import FeedEnrichmentInput, FeedEnrichmentResponse

logger = structlog.get_logger(__name__)


async def enrich_feeds_batch(
    feeds: list[FeedEnrichmentInput],
    timeout_seconds: int = 86400,
) -> list[FeedEnrichmentResponse | None]:
    """
    Process a list of feeds via Gemini Batch API.
    """
    if not feeds:
        return []

    client = _get_client()

    temp_file_path = None
    uploaded_file = None

    try:
        # 1. Create Request File
        temp_file_path = _create_batch_file(feeds)

        # 2. Upload
        uploaded_file = client.files.upload(file=temp_file_path, config=types.UploadFileConfig(mime_type="jsonl"))

        # 3. Start Job
        if not uploaded_file.name:
            raise ValueError("Uploaded file has no name")
        job = await _start_batch_job(client, uploaded_file.name)
        logger.info("Batch job started", job=job.name, size=len(feeds))

        # 4. Poll
        job = await _poll_job(client, job.name, timeout_seconds)

        if job.state.name != "JOB_STATE_SUCCEEDED":
            logger.error("Batch job failed", state=job.state.name)
            return [None] * len(feeds)

        # 5. Download & Parse
        if not job.dest or not job.dest.file_name:
            logger.error("Batch job has no result file")
            return [None] * len(feeds)
        return _download_results(client, job.dest.file_name, len(feeds))

    except Exception as e:
        logger.error("Batch enrichment failed", error=str(e))
        return [None] * len(feeds)

    finally:
        _cleanup(client, temp_file_path, uploaded_file)


# --- Internal Helpers ---


def _create_batch_file(feeds: list[FeedEnrichmentInput]) -> str:
    """Write requests to temp JSONL file."""
    with tempfile.NamedTemporaryFile(mode="w", suffix=".jsonl", delete=False) as f:
        for idx, feed in enumerate(feeds):
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

            user_prompt = (
                f"{lang_note}\nTitle: {feed.title}\nDesc: {feed.description}"
                f"\nDomain: {feed.domain}\n{extra_text}\n\n{ENRICHMENT_SYSTEM_PROMPT}"
            )

            request_obj = {
                "key": f"{idx}",
                "request": {
                    "contents": [{"parts": [{"text": user_prompt}]}],
                    "generationConfig": {
                        "temperature": 0.2,
                        "maxOutputTokens": 1000,
                        "responseMimeType": "application/json",
                        "responseJsonSchema": FeedEnrichmentResponse.model_json_schema(),
                    },
                },
            }
            f.write(orjson.dumps(request_obj).decode("utf-8") + "\n")
        return f.name


async def _start_batch_job(client: genai.Client, file_name: str) -> Any:
    """Start job with simple retry."""
    settings = get_settings()
    for attempt in range(3):
        try:
            return client.batches.create(model=settings.GEMINI_MODEL, src=file_name)
        except Exception as e:
            if "429" in str(e) or "RESOURCE_EXHAUSTED" in str(e):
                await asyncio.sleep(2 ** (attempt + 1))
                continue
            raise
    raise RuntimeError("Quota exceeded")


async def _poll_job(client: genai.Client, job_name: str, timeout_seconds: int = 86400) -> Any:
    """Poll until done or timeout."""
    start = time.time()
    last_log_time = 0

    while (time.time() - start) < timeout_seconds:
        job = client.batches.get(name=job_name)

        if (
            job
            and job.state
            and job.state.name
            in (
                "JOB_STATE_SUCCEEDED",
                "JOB_STATE_FAILED",
                "JOB_STATE_CANCELLED",
                "JOB_STATE_EXPIRED",
            )
        ):
            return job

        # Log progress every 30 seconds
        current_time = time.time()
        if current_time - last_log_time >= 30:
            stats_str = ""
            # Try to extract completion stats safely
            try:
                stats = getattr(job, "completion_stats", None)
                if stats:
                    # Handle both object and dict (just in case)
                    if isinstance(stats, dict):
                        success = stats.get("successful_count", 0)
                        failed = stats.get("failed_count", 0)
                        incomplete = stats.get("incomplete_count", 0)
                    else:
                        success = getattr(stats, "successful_count", 0)
                        failed = getattr(stats, "failed_count", 0)
                        incomplete = getattr(stats, "incomplete_count", 0)
                    
                    total = success + failed + incomplete
                    if total > 0:
                        stats_str = f"Processed: {success}/{total} (Failed: {failed})"
            except Exception:
                pass  # Ignore stat extraction errors

            logger.info(
                "Batch job running",
                job=job_name.split("/")[-1],
                state=getattr(job.state, "name", "UNKNOWN"),
                stats=stats_str,
            )
            last_log_time = current_time

        await asyncio.sleep(10)
    raise TimeoutError("Batch job timed out")


def _download_results(client: genai.Client, result_file: str, count: int) -> list[FeedEnrichmentResponse | None]:
    results: list[FeedEnrichmentResponse | None] = [None] * count
    try:
        content = client.files.download(file=result_file)
        for line in content.decode("utf-8").strip().split("\n"):
            try:
                data = orjson.loads(line)
                idx = int(data["key"])
                if "response" in data:
                    text = data["response"]["candidates"][0]["content"]["parts"][0]["text"]
                    results[idx] = FeedEnrichmentResponse.model_validate_json(text)
            except (KeyError, ValueError, IndexError) as e:
                logger.debug("Failed to parse batch result item", error=str(e))
                continue
            except Exception as e:
                logger.debug("Failed to parse batch result item", error=str(e))
                continue
    except Exception as e:
        logger.error("Error parsing batch results", error=str(e))
    return results


def _cleanup(client: genai.Client, temp_path: str | None, uploaded_file: Any):
    if temp_path and os.path.exists(temp_path):
        os.unlink(temp_path)
    if uploaded_file and client and hasattr(uploaded_file, "name") and uploaded_file.name:
        try:
            client.files.delete(name=uploaded_file.name)
        except Exception as e:
            logger.debug(
                "Failed to delete uploaded file",
                file_name=uploaded_file.name,
                error=str(e),
            )
