"""
Functional Feed Enrichment via Vertex AI Batch API.
"""

import asyncio
import os
import tempfile
import time
from typing import Any

import orjson
import structlog
from google import genai
from google.cloud import storage
from google.genai import types

from app.core.config import get_settings
from app.services.ai.prompts import ENRICHMENT_SYSTEM_PROMPT
from app.typing.feeds import FeedEnrichmentInput, FeedEnrichmentResponse

logger = structlog.get_logger(__name__)


def _get_vertex_client() -> genai.Client:
    """Initialize Gemini client configured for Vertex AI."""
    settings = get_settings()
    project = settings.GOOGLE_CLOUD_PROJECT or os.getenv("GOOGLE_CLOUD_PROJECT")
    location = settings.GOOGLE_CLOUD_LOCATION or os.getenv("GOOGLE_CLOUD_LOCATION", "us-central1")

    logger.info("Initializing Vertex AI Client", project=project, location=location)
    return genai.Client(
        vertexai=True,
        project=project,
        location=location,
    )


async def enrich_feeds_batch(
    feeds: list[FeedEnrichmentInput],
    timeout_seconds: int = 3600,  # 1 hour maximum timeout for safety
) -> list[FeedEnrichmentResponse | None]:
    """
    Process a list of feeds via Vertex AI Batch API using GCS.

    Requires GOOGLE_CLOUD_PROJECT to be configured; enrichment is not supported
    without GCP billing. Self-hosted deployments should disable AI if GCP is unavailable.
    """
    if not feeds:
        return []

    settings = get_settings()
    project = settings.GOOGLE_CLOUD_PROJECT or os.getenv("GOOGLE_CLOUD_PROJECT")

    if not project:
        logger.warning("Vertex AI enrichment skipped: GOOGLE_CLOUD_PROJECT not configured")
        return [None] * len(feeds)

    bucket_name = settings.GCS_BUCKET or os.getenv("GCS_BUCKET")
    if not bucket_name:
        # Generate a fallback bucket name using the project ID
        bucket_name = f"readspace-batch-bucket-{project.split('-')[-1]}"
        logger.warning("GCS_BUCKET not configured. Using fallback bucket name", bucket=bucket_name)

    client = _get_vertex_client()
    storage_client = storage.Client()

    temp_file_path = None
    gcs_input_uri = None
    gcs_output_prefix = None
    job_id = f"feed-enrich-{int(time.time())}"
    gcs_job_prefix = f"batch-jobs/{job_id}/"

    try:
        # Ensure the bucket exists or attempt to create it
        try:
            if not storage_client.lookup_bucket(bucket_name):
                logger.info("Creating GCS bucket", bucket=bucket_name)
                storage_client.create_bucket(bucket_name, location=settings.GOOGLE_CLOUD_LOCATION)
        except Exception as e:
            logger.debug("Automatic bucket check/creation bypassed", bucket=bucket_name, error=str(e))

        # 2. Create Request File Locally
        temp_file_path = _create_batch_file(feeds)

        # 3. Upload JSONL to GCS
        bucket = storage_client.bucket(bucket_name)
        input_blob_name = f"{gcs_job_prefix}input.jsonl"
        blob = bucket.blob(input_blob_name)
        blob.upload_from_filename(temp_file_path)
        gcs_input_uri = f"gs://{bucket_name}/{input_blob_name}"

        gcs_output_prefix = f"gs://{bucket_name}/{gcs_job_prefix}output/"
        logger.info("Uploaded input file to GCS", uri=gcs_input_uri)

        # 4. Submit Vertex Batch prediction job
        job = client.batches.create(
            model=settings.GEMINI_SMART_MODEL,
            src=gcs_input_uri,
            config=types.CreateBatchJobConfig(dest=gcs_output_prefix),
        )
        logger.info("Vertex AI Batch job submitted", job=job.name, size=len(feeds))

        # 5. Poll with 60s intervals to avoid client thread thrashing
        job = await _poll_job(client, job.name, timeout_seconds)

        if job.state.name != "JOB_STATE_SUCCEEDED":
            logger.error("Vertex AI Batch job failed", state=job.state.name)
            return [None] * len(feeds)

        # 6. Download & Parse results from GCS
        logger.info("Vertex AI Batch job succeeded. Downloading output files from GCS...")
        return _download_results_from_gcs(
            storage_client,
            bucket_name=bucket_name,
            output_prefix=f"{gcs_job_prefix}output/",
            count=len(feeds),
            feeds=feeds,
        )

    except Exception as e:
        logger.error("Vertex AI Batch enrichment failed", error=str(e), exc_info=True)
        return [None] * len(feeds)

    finally:
        # Cleanup local and GCS temporary resources to avoid recurring storage costs
        _cleanup_gcs(storage_client, bucket_name, temp_file_path, gcs_job_prefix)


# --- Helper Operations ---


def _create_batch_file(feeds: list[FeedEnrichmentInput]) -> str:
    """Write requests to temp JSONL file."""
    with tempfile.NamedTemporaryFile(mode="w", suffix=".jsonl", delete=False) as f:
        for feed in feeds:
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
                f"Feed ID: {feed.id}\n\n{lang_note}\nTitle: {feed.title}\nDesc: {feed.description}"
                f"\nDomain: {feed.domain}\n{extra_text}\n\n{ENRICHMENT_SYSTEM_PROMPT}"
            )

            request_obj = {
                "request": {
                    "contents": [{"role": "user", "parts": [{"text": user_prompt}]}],
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


async def _poll_job(client: genai.Client, job_name: str, timeout_seconds: int) -> Any:
    """Poll batch prediction job state with defensive timeouts."""
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


def _find_gemini_json_response(data: Any) -> str | None:
    """Recursively search for a JSON string response matching our FeedEnrichmentResponse structure."""
    if isinstance(data, str):
        cleaned = data.strip()
        # Clean markdown code block wraps if present
        import re

        cleaned = re.sub(r"^```(?:json)?\n|\n```$", "", cleaned, flags=re.MULTILINE).strip()
        if cleaned.startswith("{") and cleaned.endswith("}"):
            if "clean_title" in cleaned or "enhanced_description" in cleaned:
                return cleaned
    elif isinstance(data, dict):
        # If this dict is already the parsed schema, serialize it back to JSON (ensuring it's not a schema definition)
        if "clean_title" in data or "enhanced_description" in data:
            if "properties" not in data and "anyOf" not in data and "type" not in data:
                return orjson.dumps(data).decode("utf-8")

        # Check standard candidate blocks
        import contextlib

        with contextlib.suppress(Exception):
            candidates = data.get("candidates")
            if candidates and candidates[0].get("content"):
                parts = candidates[0]["content"].get("parts")
                if parts and parts[0].get("text"):
                    text = parts[0]["text"]
                    if result := _find_gemini_json_response(text):
                        return result

        # Recursive search in dict values (skipping the input "request" block to avoid the schema definition)
        for k, v in data.items():
            if k == "request":
                continue
            if result := _find_gemini_json_response(v):
                return result
    elif isinstance(data, list):
        for item in data:
            if result := _find_gemini_json_response(item):
                return result
    return None


def _download_results_from_gcs(
    storage_client: storage.Client, bucket_name: str, output_prefix: str, count: int, feeds: list[FeedEnrichmentInput]
) -> list[FeedEnrichmentResponse | None]:
    """Download and parse output prediction files from GCS by feed_id."""
    results: list[FeedEnrichmentResponse | None] = [None] * count
    feed_map = {feed.id: idx for idx, feed in enumerate(feeds)}

    try:
        bucket = storage_client.bucket(bucket_name)
        blobs = list(bucket.list_blobs(prefix=output_prefix))

        for blob in blobs:
            if not blob.name.endswith(".jsonl"):
                continue

            logger.info("Processing output result blob", blob=blob.name)
            content = blob.download_as_text()

            for line in content.strip().split("\n"):
                if not line.strip():
                    continue
                try:
                    data = orjson.loads(line)

                    # Extract the JSON response from nested structure
                    text = _find_gemini_json_response(data)
                    if not text:
                        logger.warning("Failed to find JSON response payload in result line")
                        continue

                    response_data = orjson.loads(text)
                    feed_id = response_data.get("feed_id")

                    if feed_id not in feed_map:
                        logger.warning("Unknown feed_id in result", feed_id=str(feed_id)[:50])
                        continue

                    idx = feed_map[feed_id]
                    results[idx] = FeedEnrichmentResponse.model_validate(response_data)
                    logger.info("Successfully parsed feed result", feed_id=str(feed_id)[:50])

                except Exception as e:
                    logger.warning("Failed to parse prediction result row", error=str(e), line_preview=line[:200])
                    continue

    except Exception as e:
        logger.error("Error during GCS output download and parsing", error=str(e), exc_info=True)

    return results


def _cleanup_gcs(storage_client: storage.Client, bucket_name: str, local_path: str | None, gcs_job_prefix: str):
    """Clean up GCS job files and local temporary files to preserve storage quotas and avoid costs."""
    if local_path and os.path.exists(local_path):
        import contextlib

        with contextlib.suppress(OSError):
            os.unlink(local_path)

    if bucket_name:
        try:
            bucket = storage_client.bucket(bucket_name)
            blobs = bucket.list_blobs(prefix=gcs_job_prefix)
            for blob in blobs:
                blob.delete()
            logger.info("Cleaned GCS files for batch job", prefix=gcs_job_prefix)
        except Exception as e:
            logger.debug("Failed to delete GCS files", prefix=gcs_job_prefix, error=str(e))


