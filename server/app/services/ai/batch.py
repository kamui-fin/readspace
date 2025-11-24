"""
Functional Feed Enrichment via Gemini Batch API.
"""

import asyncio
import json
import os
import tempfile
import time
from typing import Any

import structlog
from google import genai
from google.genai import types

from app.core.config import get_settings
from app.schemas import FeedEnrichmentResponse
from app.services.ai.prompts import ENRICHMENT_SYSTEM_PROMPT
from app.services.ai.service import _get_client  # Re-use the singleton

logger = structlog.get_logger(__name__)


async def enrich_feeds_batch(feeds: list[dict[str, Any]]) -> list[FeedEnrichmentResponse | None]:
    """
    Process a list of feeds via Gemini Batch API.
    """
    client = _get_client()
    if not client or not feeds:
        return [None] * len(feeds)

    temp_file_path = None
    uploaded_file = None

    try:
        # 1. Create Request File
        temp_file_path = _create_batch_file(feeds)

        # 2. Upload
        uploaded_file = client.files.upload(file=temp_file_path, config=types.UploadFileConfig(mime_type="jsonl"))

        # 3. Start Job
        job = await _start_batch_job(client, uploaded_file.name)
        logger.info("Batch job started", job=job.name, size=len(feeds))

        # 4. Poll
        job = await _poll_job(client, job.name)

        if job.state.name != "JOB_STATE_SUCCEEDED":
            logger.error("Batch job failed", state=job.state.name)
            return [None] * len(feeds)

        # 5. Download & Parse
        return _download_results(client, job.dest.file_name, len(feeds))

    except Exception as e:
        logger.error("Batch enrichment failed", error=str(e))
        return [None] * len(feeds)

    finally:
        _cleanup(client, temp_file_path, uploaded_file)


# --- Internal Helpers ---


def _create_batch_file(feeds: list[dict[str, Any]]) -> str:
    """Write requests to temp JSONL file."""
    with tempfile.NamedTemporaryFile(mode="w", suffix=".jsonl", delete=False) as f:
        for idx, feed in enumerate(feeds):
            lang_note = f"Content Language: {feed.get('language', 'en')}. "
            user_prompt = f"{lang_note}\nTitle: {feed.get('title')}\nDesc: {feed.get('description')}\nDomain: {feed.get('domain')}\n\n{ENRICHMENT_SYSTEM_PROMPT}"

            request_obj = {
                "key": f"{idx}",
                "request": {
                    "contents": [{"parts": [{"text": user_prompt}]}],
                    "generationConfig": {
                        "temperature": 0.2,
                        "maxOutputTokens": 400,
                        "responseMimeType": "application/json",
                        "responseJsonSchema": FeedEnrichmentResponse.model_json_schema(),
                    },
                },
            }
            f.write(json.dumps(request_obj) + "\n")
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


async def _poll_job(client: genai.Client, job_name: str) -> Any:
    """Poll until done or 10m timeout."""
    start = time.time()
    while (time.time() - start) < 600:
        job = client.batches.get(name=job_name)
        if job.state.name in ("JOB_STATE_SUCCEEDED", "JOB_STATE_FAILED", "JOB_STATE_CANCELLED"):
            return job
        await asyncio.sleep(10)
    raise TimeoutError("Batch job timed out")


def _download_results(client: genai.Client, result_file: str, count: int) -> list[FeedEnrichmentResponse | None]:
    results = [None] * count
    try:
        content = client.files.download(file=result_file)
        for line in content.decode("utf-8").strip().split("\n"):
            try:
                data = json.loads(line)
                idx = int(data["key"])
                if "response" in data:
                    text = data["response"]["candidates"][0]["content"]["parts"][0]["text"]
                    results[idx] = FeedEnrichmentResponse.model_validate_json(text)
            except Exception:
                continue
    except Exception as e:
        logger.error("Error parsing batch results", error=str(e))
    return results


def _cleanup(client: genai.Client, temp_path: str | None, uploaded_file: Any):
    if temp_path and os.path.exists(temp_path):
        os.unlink(temp_path)
    if uploaded_file and client:
        try:
            client.files.delete(name=uploaded_file.name)
        except Exception:
            pass
