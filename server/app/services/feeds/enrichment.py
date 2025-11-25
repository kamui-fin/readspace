"""
Feed enrichment service functions.
Pure business logic for feed metadata enrichment.
Zero dependencies on Database, Redis, or HTTP requests.
"""

from typing import Any
from urllib.parse import urlparse

import structlog

from app.models.enums import FeedCategory
from app.models.feed import Feed
from app.typing.feeds import FeedEnrichmentResponse

logger = structlog.get_logger(__name__)


def extract_domain_from_url(url: str) -> str:
    """Extract domain from URL.

    Args:
        url: Feed URL or link

    Returns:
        Domain name or original URL if parsing fails
    """
    try:
        parsed = urlparse(url)
        return parsed.netloc or url
    except Exception:
        return url


def detect_language(feed: Feed) -> str:
    """Detect language from feed metadata.

    Falls back to 'en' if no language information is available.

    Args:
        feed: Feed ORM object

    Returns:
        Language code (e.g., 'en', 'es', 'fr')
    """
    # Try feed language first
    if feed.language:
        return feed.language.split("-")[0].lower()

    # Try to detect from title/description (simple heuristic)
    # For now, default to English
    # TODO: Could use a language detection library here if needed
    return "en"


def calculate_hybrid_popularity_score(
    feed_data: dict[str, Any],
    llm_popularity_estimate: int,
) -> dict[str, float]:
    """Calculate hybrid popularity score combining LLM estimate with feed metadata.

    Args:
        feed_data: Dictionary with feed metadata (id, title, description, domain, etc.)
        llm_popularity_estimate: LLM-provided popularity estimate (1-100)

    Returns:
        Dictionary with popularity_score, llm_popularity_score, domain_authority_score, quality_score
    """
    # Normalize LLM estimate to 0-1 range
    llm_score = llm_popularity_estimate / 100.0

    # Simple domain authority heuristic (could be enhanced with actual domain data)
    # For now, assume all domains have similar authority
    domain_authority_score = 0.5

    # Quality score based on feed completeness
    quality_score = 0.5
    if feed_data.get("title") and feed_data.get("description"):
        quality_score = 0.7
    if feed_data.get("image_url"):
        quality_score += 0.1
    quality_score = min(quality_score, 1.0)

    # Hybrid score: weighted combination
    # 60% LLM estimate, 20% domain authority, 20% quality
    popularity_score = (llm_score * 0.6) + (domain_authority_score * 0.2) + (quality_score * 0.2)

    return {
        "popularity_score": popularity_score,
        "llm_popularity_score": llm_score,
        "domain_authority_score": domain_authority_score,
        "quality_score": quality_score,
    }


def prepare_feed_snapshots(
    feeds: list[Feed],
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """Extract feed data into snapshots for processing.

    This extracts all data from ORM objects while we have them,
    so we can release the DB connection during API calls.

    Args:
        feeds: List of Feed ORM objects

    Returns:
        Tuple of (feed_data_list, feed_snapshot_list)
        - feed_data_list: Minimal data for AI enrichment
        - feed_snapshot_list: Complete feed data for later processing
    """
    feed_data_list = []
    feed_snapshot_list = []

    for feed in feeds:
        # Detect language if not set
        language = feed.language or detect_language(feed)

        # Extract domain
        domain = extract_domain_from_url(feed.link or feed.url)

        # Store all feed data needed for later processing
        feed_snapshot = {
            "id": feed.id,
            "title": feed.title or "Unknown Feed",
            "description": feed.description or "",
            "domain": domain,
            "language": language,
            "link": feed.link,
            "url": feed.url,
            "image_url": feed.image_url,
        }
        feed_snapshot_list.append(feed_snapshot)

        # Prepare data for AI service
        feed_data_list.append(
            {
                "title": feed_snapshot["title"],
                "description": feed_snapshot["description"],
                "domain": domain,
                "language": language,
            }
        )

    return feed_data_list, feed_snapshot_list


def build_feed_update_mapping(
    feed_snapshot: dict[str, Any],
    language: str | None,
    llm_result: FeedEnrichmentResponse | None,
) -> dict[str, Any]:
    """Build update mapping for a single feed from enrichment results.

    Args:
        feed_snapshot: Feed data snapshot
        language: Detected language
        llm_result: LLM enrichment result

    Returns:
        Dictionary of fields to update in database
    """
    from datetime import datetime, timezone

    update_mapping = {
        "id": feed_snapshot["id"],
        "updated_at": datetime.now(timezone.utc),
    }

    # Add language
    if language:
        update_mapping["language"] = language

    # Add LLM enrichment data
    if llm_result:
        update_mapping["tags"] = llm_result.tags

        # Convert category string to enum
        try:
            category_enum = FeedCategory(llm_result.category)
            update_mapping["top_level_category"] = category_enum
        except ValueError:
            logger.warning(
                "Invalid category",
                category=llm_result.category,
                feed_id=feed_snapshot["id"],
            )
            update_mapping["top_level_category"] = FeedCategory.MISCELLANEOUS

        if llm_result.enhanced_description:
            update_mapping["description"] = llm_result.enhanced_description

        # Calculate hybrid popularity score
        popularity_data = calculate_hybrid_popularity_score(
            feed_snapshot,
            llm_result.popularity_estimate,
        )
        update_mapping.update(
            {
                "popularity_score": float(popularity_data.get("popularity_score", 0.5)),
                "llm_popularity_score": popularity_data.get("llm_popularity_score"),
                "domain_authority_score": popularity_data.get("domain_authority_score"),
                "quality_score": popularity_data.get("quality_score"),
            }
        )

    return update_mapping


def prepare_bulk_updates(
    feed_snapshot_list: list[dict[str, Any]],
    feed_data_list: list[dict[str, Any]],
    llm_results: list[FeedEnrichmentResponse | None],
) -> tuple[list[dict[str, Any]], int, int]:
    """Prepare bulk update mappings from enrichment results.

    Args:
        feed_snapshot_list: List of feed data snapshots
        feed_data_list: List of feed data for AI (for language lookup)
        llm_results: List of LLM enrichment results

    Returns:
        Tuple of (bulk_update_mappings, enriched_count, failed_count)
    """
    bulk_update_mappings = []
    enriched_count = 0
    failed_count = 0

    for i, feed_snapshot in enumerate(feed_snapshot_list):
        try:
            llm_result = llm_results[i]

            # Skip feeds where enrichment failed (None results)
            if llm_result is None:
                logger.warning(
                    "Skipping feed with failed enrichment",
                    feed_id=str(feed_snapshot["id"]),
                    feed_title=feed_snapshot.get("title"),
                )
                failed_count += 1
                continue

            language = feed_data_list[i]["language"]

            update_mapping = build_feed_update_mapping(
                feed_snapshot=feed_snapshot,
                language=language,
                llm_result=llm_result,
            )

            bulk_update_mappings.append(update_mapping)
            enriched_count += 1

        except Exception as e:
            logger.error(
                "Failed to prepare feed enrichment",
                feed_id=str(feed_snapshot["id"]),
                error=str(e),
                exc_info=True,
            )
            failed_count += 1

    return bulk_update_mappings, enriched_count, failed_count
