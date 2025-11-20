"""Feed enrichment functionality using Gemini Batch API."""

import asyncio
import json
import os
import tempfile
from typing import Any

import structlog
from google.genai import types

from app.core.config import get_settings
from app.schemas import FeedEnrichmentResponse
from app.services.ai.client import get_gemini_client

logger = structlog.get_logger(__name__)


class FeedEnrichmentService:
    """Handles batch feed enrichment using Gemini."""

    def __init__(self) -> None:
        self.gemini_client = get_gemini_client()
        self.settings = get_settings()
        self.model = self.settings.GEMINI_MODEL

    async def enrich_feeds_batch(
        self,
        feed_data_list: list[dict[str, Any]],
    ) -> list[FeedEnrichmentResponse | None]:
        """
        Use Gemini Batch API to enrich multiple feeds with structured output.

        Args:
            feed_data_list: List of dicts with keys: title, description, domain, sample_articles, language

        Returns:
            List of FeedEnrichmentResponse or None for failed enrichments
        """
        self.gemini_client.check_availability()

        if not feed_data_list:
            return []

        try:
            temp_file = None
            uploaded_file = None

            try:
                batch_requests = self._build_batch_requests(feed_data_list)
                temp_file = self._create_jsonl_file(batch_requests)

                logger.info("Created batch request file", file_path=temp_file.name, batch_size=len(batch_requests))

                uploaded_file = self._upload_file(temp_file.name, len(batch_requests))
                logger.info(
                    "Uploaded batch file to Gemini", file_name=uploaded_file.name, batch_size=len(batch_requests)
                )

                batch_job = await self._create_batch_job_with_retry(uploaded_file.name, len(batch_requests))
                logger.info("Batch enrichment job created", job_name=batch_job.name, batch_size=len(batch_requests))

                batch_status = await self._poll_for_completion(batch_job.name)

                if batch_status.state.name != "JOB_STATE_SUCCEEDED":
                    logger.error(
                        "Batch job did not succeed",
                        job_name=batch_job.name,
                        state=batch_status.state.name,
                        error=getattr(batch_status, "error", None),
                    )
                    return [None] * len(feed_data_list)

                results = self._parse_results(batch_status, len(feed_data_list))

                logger.info(
                    "Batch enrichment completed",
                    total_requests=len(feed_data_list),
                    successful_results=sum(1 for r in results if r is not None),
                )

                return results

            finally:
                self._cleanup_files(temp_file, uploaded_file)

        except Exception as e:
            logger.error("Error in batch feed enrichment", error=str(e), exc_info=True)
            return [None] * len(feed_data_list)

    def _build_batch_requests(self, feed_data_list: list[dict[str, Any]]) -> list[dict[str, Any]]:
        """Build batch requests in JSONL format."""
        batch_requests = []
        for idx, feed_data in enumerate(feed_data_list):
            prompt = self._build_enrichment_prompt(feed_data)
            batch_requests.append(
                {
                    "key": f"feed-{idx}",
                    "request": {
                        "contents": [{"parts": [{"text": prompt}]}],
                        "generationConfig": {
                            "temperature": 0.2,
                            "maxOutputTokens": 400,
                            "responseMimeType": "application/json",
                            "responseJsonSchema": FeedEnrichmentResponse.model_json_schema(),
                        },
                    },
                }
            )
        return batch_requests

    @staticmethod
    def _build_enrichment_prompt(feed_data: dict[str, Any]) -> str:
        """Build enrichment prompt for a single feed."""
        title = feed_data.get("title", "")
        description = feed_data.get("description", "")
        domain = feed_data.get("domain", "")
        language = feed_data.get("language", "en")

        lang_instruction = ""
        if language == "zh":
            lang_instruction = "The content is in Chinese. Keep all outputs in Chinese. "
        elif language != "en":
            lang_instruction = f"The content is in {language}. Keep all outputs in {language}. "

        return f"""Analyze this RSS feed and provide enrichment metadata.
{lang_instruction}Return ONLY a valid JSON object with no markdown formatting.

Feed Information:
Title: {title}
Description: {description}
Domain: {domain}

IMPORTANT: Use your existing knowledge of this website/publication (if you have any) to provide accurate enrichment.

Your task is to:
1. Generate an ENHANCED description that expands on the existing one (if present) to make it more complete and useful for unfamiliar readers. Use your existing knowledge of this website/publication along with the provided information. If the original description is empty or very short, create a helpful description. Keep it concise (max 200 chars).

2. Extract 5-10 SPECIFIC tags/keywords that describe the FEED'S GENERAL THEMES. Use your existing knowledge of this website/publication to identify its typical topics and focus areas. Tags should be:
   - Based on what this feed typically covers (use your knowledge of the source)
   - Specific enough to be useful (e.g., "javascript", "machine-learning", "climate-science", "indie-games")
   - General enough to apply to most content from this feed
   - Representative of the feed's core focus areas
   - Avoid overly specific article topics that may not generalize
   - Avoid generic terms like "news", "blog", "updates"

3. Categorize the feed into ONE of these 12 categories (use your knowledge of the source):
   - Technology & Programming
   - Artificial Intelligence
   - Design & Creativity
   - Business & Finance
   - News & Politics
   - Gaming & Entertainment
   - Science & Research
   - Lifestyle & Personal
   - Culture & Arts
   - Security & Privacy
   - Education & Learning
   - Miscellaneous

4. Rate the popularity and influence of this RSS feed on a scale of 1–100 (use your knowledge of the source's reach and reputation):
   90–100: Extremely popular & influential (e.g., CNN, Hacker News, TechCrunch)
   80–89: Very popular, well-established (e.g., Ars Technica, Wired, The Verge)
   70–79: Popular within niche (e.g., Smashing Magazine, popular subreddits)
   60–69: Moderately popular, steady readership
   50–59: Some recognition, mid-sized audience
   40–49: Limited reach, small following
   30–39: Very small audience
   20–29: Minimal recognition
   10–19: Barely read, obscure
   1–9: Effectively no audience

Return a JSON object with exactly these keys:
{{"enhanced_description": "Enhanced/expanded description, max 200 chars", "tags": ["specific", "keywords", "5-10", "tags"], "category": "ONE of the 12 categories above", "popularity_estimate": numeric_score_1_to_100}}"""  # noqa: E501

    @staticmethod
    def _create_jsonl_file(batch_requests: list[dict[str, Any]]) -> tempfile._TemporaryFileWrapper:
        """Create temporary JSONL file with batch requests."""
        temp_file = tempfile.NamedTemporaryFile(mode="w", suffix=".jsonl", delete=False)
        for request in batch_requests:
            temp_file.write(json.dumps(request) + "\n")
        temp_file.close()
        return temp_file

    def _upload_file(self, file_path: str, batch_size: int) -> Any:
        """Upload file to Gemini File API."""
        return self.gemini_client.client.files.upload(
            file=file_path,
            config=types.UploadFileConfig(
                display_name=f"feed-enrichment-batch-{batch_size}",
                mime_type="jsonl",
            ),
        )

    async def _create_batch_job_with_retry(self, file_name: str, batch_size: int) -> Any:
        """Create batch job with retry logic for quota errors."""
        max_retries = 3
        retry_delay = 60

        for attempt in range(max_retries):
            try:
                return self.gemini_client.client.batches.create(
                    model=self.model,
                    src=file_name,
                    config={"display_name": f"feed-enrichment-batch-{batch_size}"},
                )
            except Exception as e:
                error_str = str(e)
                if "429" in error_str or "RESOURCE_EXHAUSTED" in error_str:
                    if attempt < max_retries - 1:
                        logger.warning(
                            "Quota exceeded, retrying after delay",
                            attempt=attempt + 1,
                            retry_delay=retry_delay,
                            error=error_str,
                        )
                        await asyncio.sleep(retry_delay)
                        retry_delay *= 2
                    else:
                        logger.error("Quota exceeded after all retries", attempts=max_retries, error=error_str)
                        raise
                else:
                    raise

    async def _poll_for_completion(self, job_name: str) -> Any:
        """Poll for batch job completion with timeout."""
        max_wait_seconds = 4 * 60  # 4 minutes
        poll_interval = 60
        elapsed = 0

        completed_states = {
            "JOB_STATE_SUCCEEDED",
            "JOB_STATE_FAILED",
            "JOB_STATE_CANCELLED",
            "JOB_STATE_EXPIRED",
        }

        while elapsed < max_wait_seconds:
            batch_status = self.gemini_client.client.batches.get(name=job_name)

            if batch_status.state.name in completed_states:
                return batch_status

            logger.debug(
                "Batch job still running",
                job_name=job_name,
                state=batch_status.state.name,
                elapsed_seconds=elapsed,
            )

            await asyncio.sleep(poll_interval)
            elapsed += poll_interval

        return self.gemini_client.client.batches.get(name=job_name)

    def _parse_results(self, batch_status: Any, num_feeds: int) -> list[FeedEnrichmentResponse | None]:
        """Parse results from batch job."""
        results: list[FeedEnrichmentResponse | None] = [None] * num_feeds

        if not batch_status.dest or not batch_status.dest.file_name:
            logger.error("No result file in batch response")
            return results

        result_file_name = batch_status.dest.file_name
        logger.info("Downloading batch results", file_name=result_file_name)

        file_content = self.gemini_client.client.files.download(file=result_file_name)
        result_text = file_content.decode("utf-8")

        for line in result_text.strip().split("\n"):
            if not line:
                continue

            try:
                result_obj = json.loads(line)
                key = result_obj.get("key", "")

                if key.startswith("feed-"):
                    idx = int(key.split("-")[1])

                    if "response" in result_obj:
                        try:
                            response_text = (
                                result_obj["response"]
                                .get("candidates", [{}])[0]
                                .get("content", {})
                                .get("parts", [{}])[0]
                                .get("text", "")
                            )
                            if response_text:
                                enrichment = FeedEnrichmentResponse.model_validate_json(response_text)
                                results[idx] = enrichment
                            else:
                                logger.warning("Empty response text in batch result", key=key)
                        except (KeyError, IndexError, TypeError) as e:
                            logger.warning("Failed to extract text from batch response", key=key, error=str(e))
                    elif "error" in result_obj:
                        logger.warning("Batch request failed", key=key, error=result_obj["error"])
                    else:
                        logger.warning(
                            "Unexpected batch result structure", key=key, result_keys=list(result_obj.keys())
                        )
            except Exception as e:
                logger.warning("Failed to parse batch result line", error=str(e), line=line[:100])

        return results

    def _cleanup_files(self, temp_file: Any, uploaded_file: Any) -> None:
        """Cleanup temporary and uploaded files."""
        if temp_file and os.path.exists(temp_file.name):
            try:
                os.unlink(temp_file.name)
                logger.debug("Cleaned up temporary batch file", file_path=temp_file.name)
            except Exception as e:
                logger.warning("Failed to cleanup temp file", error=str(e))

        if uploaded_file:
            try:
                self.gemini_client.client.files.delete(name=uploaded_file.name)
                logger.debug("Deleted uploaded batch file", file_name=uploaded_file.name)
            except Exception as e:
                logger.warning("Failed to delete uploaded file", error=str(e))
