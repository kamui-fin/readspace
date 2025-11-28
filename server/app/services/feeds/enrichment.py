"""
Feed enrichment service functions.
Pure business logic for feed metadata enrichment.

Features:
- Language detection using feed metadata + recent article content (fetched via CRUD)
- Favicon extraction from feed website with fallback to Google favicon service
- Hybrid popularity scoring combining:
  * 40% LLM brand recognition estimate
  * 30% Domain authority (Tranco rankings - top 1M domains)
  * 30% Quality score (metadata + content stats)
- HTML cleaning utilities for text extraction

Zero dependencies on Database or Redis.
HTTP requests only for favicon extraction (async).
"""

from datetime import datetime, timezone
from typing import Any

import structlog

from app.models.enums import FeedCategory
from app.models.feed import Feed
from app.services.feeds.language_detection import detect_feed_language
from app.services.feeds.scoring import calculate_hybrid_popularity_score
from app.typing.feeds import (
    ArticleStats,
    FaviconResult,
    FeedEnrichmentInput,
    FeedEnrichmentResponse,
    FeedEnrichmentSnapshot,
)
from app.utils.urls import extract_domain_from_url

logger = structlog.get_logger(__name__)


def _calculate_article_stats(articles: list[dict[str, Any]] | None) -> ArticleStats:
    """Calculate statistics from a list of article dictionaries."""
    if not articles:
        return ArticleStats()

    count = len(articles)
    image_count = sum(1 for a in articles if a.get("image_url"))

    total_length = 0
    latest_date = None

    for a in articles:
        content = a.get("content") or a.get("description") or ""
        total_length += len(content)

        pub_date = a.get("published_at")
        if pub_date:
            if not latest_date or pub_date > latest_date:
                latest_date = pub_date

    avg_length = total_length / count if count > 0 else 0

    days_since = 999
    if latest_date:
        # Ensure timezone awareness
        if latest_date.tzinfo is None:
            latest_date = latest_date.replace(tzinfo=timezone.utc)
        delta = datetime.now(timezone.utc) - latest_date
        days_since = delta.days

    return ArticleStats(
        count=count,
        image_ratio=image_count / count if count > 0 else 0.0,
        avg_content_length=avg_length,
        days_since_last_article=days_since,
    )


def prepare_feed_snapshots(
    feeds: list[Feed],
    article_texts_by_feed: dict[Any, list[str]] | None = None,
    recent_articles_by_feed: dict[Any, list[dict[str, Any]]] | None = None,
) -> tuple[list[FeedEnrichmentInput], list[FeedEnrichmentSnapshot]]:
    """Extract feed data into snapshots for processing.

    This extracts all data from ORM objects while we have them,
    so we can release the DB connection during API calls.

    Args:
        feeds: List of Feed ORM objects
        article_texts_by_feed: Optional dict mapping feed_id to list of recent article texts
                               for improved language detection
        recent_articles_by_feed: Optional dict mapping feed_id to list of recent article dicts
                                 (with 'content', 'image_url', 'published_at') for quality scoring

    Returns:
        Tuple of (feed_data_list, feed_snapshot_list)
        - feed_data_list: Minimal data for AI enrichment (FeedEnrichmentInput objects)
        - feed_snapshot_list: Complete feed data for later processing
    """
    feed_data_list: list[FeedEnrichmentInput] = []
    feed_snapshot_list: list[FeedEnrichmentSnapshot] = []

    for feed in feeds:
        # Get article texts for this feed if available
        article_texts = None
        if article_texts_by_feed:
            article_texts = article_texts_by_feed.get(feed.id, [])

        # Get recent articles for stats
        recent_articles = []
        if recent_articles_by_feed:
            recent_articles = recent_articles_by_feed.get(feed.id, [])

        # Detect language with article content for better accuracy
        language = feed.language
        if not language:
            language = detect_feed_language(
                title=feed.title,
                description=feed.description,
                articles=article_texts or [],
            )

        # Extract domain
        domain = extract_domain_from_url(feed.link or feed.url)

        # Calculate article stats
        article_stats = _calculate_article_stats(recent_articles)

        # Store all feed data needed for later processing
        feed_snapshot = FeedEnrichmentSnapshot(
            id=feed.id,
            title=feed.title or "Unknown Feed",
            description=feed.description or "",
            domain=domain,
            language=language,
            link=feed.link,
            url=feed.url,
            image_url=feed.image_url,
            author=getattr(feed, "author", None),
            article_stats=article_stats,
        )
        feed_snapshot_list.append(feed_snapshot)

        # Prepare data for AI service
        feed_data_list.append(
            FeedEnrichmentInput(
                title=feed_snapshot.title,
                description=feed_snapshot.description,
                domain=domain,
                language=language,
                link=feed.link,
                url=feed.url,
                articles=article_texts or [],
            )
        )

    return feed_data_list, feed_snapshot_list


def build_feed_update_mapping(
    feed_snapshot: FeedEnrichmentSnapshot,
    language: str | None,
    llm_result: FeedEnrichmentResponse | None,
    domain_authority_score: float = 0.0,
    favicon_result: FaviconResult | None = None,
) -> dict[str, Any]:
    """Build update mapping for a single feed from enrichment results.

    Args:
        feed_snapshot: Feed data snapshot
        language: Detected language
        llm_result: LLM enrichment result
        domain_authority_score: Domain authority score (0.0-1.0) from Tranco rankings
        favicon_result: Optional favicon extraction result
    """
    update_mapping = {
        "id": feed_snapshot.id,
        "updated_at": datetime.now(timezone.utc),
    }

    # Add language
    if language:
        update_mapping["language"] = language

    # Add Favicon
    if favicon_result and favicon_result.image_url:
        update_mapping["image_url"] = favicon_result.image_url
        # Update snapshot for scoring accuracy
        feed_snapshot.image_url = favicon_result.image_url

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
                feed_id=feed_snapshot.id,
            )
            update_mapping["top_level_category"] = FeedCategory.MISCELLANEOUS

        if llm_result.enhanced_description:
            update_mapping["description"] = llm_result.enhanced_description

        # Calculate hybrid popularity score with domain authority
        popularity_data = calculate_hybrid_popularity_score(
            feed_snapshot,
            llm_result.popularity_estimate,
            domain_authority_score,
            article_stats=feed_snapshot.article_stats,
        )

        update_mapping["popularity_score"] = float(
            popularity_data.get("popularity_score", 0.5)
        )

    return update_mapping


def prepare_bulk_updates(
    feed_snapshot_list: list[FeedEnrichmentSnapshot],
    feed_data_list: list[FeedEnrichmentInput],
    llm_results: list[FeedEnrichmentResponse | None],
    domain_authority_scores: dict[str, float] | None = None,
    favicon_results: list[FaviconResult | None] | None = None,
) -> tuple[list[dict[str, Any]], int, int]:
    """Prepare bulk update mappings from enrichment results.

    Args:
        feed_snapshot_list: List of feed data snapshots
        feed_data_list: List of feed data for AI (for language lookup)
        llm_results: List of LLM enrichment results
        domain_authority_scores: Optional dict mapping domain to authority score (0.0-1.0)
        favicon_results: Optional list of favicon extraction results

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
                    feed_id=str(feed_snapshot.id),
                    feed_title=feed_snapshot.title,
                )
                failed_count += 1
                continue

            language = feed_data_list[i].language

            # Get domain authority score if available
            domain_authority = 0.0
            if domain_authority_scores:
                domain = feed_snapshot.domain or ""
                domain_authority = domain_authority_scores.get(domain, 0.0)

            # Get favicon result if available
            favicon_result = None
            if favicon_results and i < len(favicon_results):
                favicon_result = favicon_results[i]

            update_mapping = build_feed_update_mapping(
                feed_snapshot=feed_snapshot,
                language=language,
                llm_result=llm_result,
                domain_authority_score=domain_authority,
                favicon_result=favicon_result,
            )

            bulk_update_mappings.append(update_mapping)
            enriched_count += 1

        except Exception as e:
            logger.error(
                "Failed to prepare feed enrichment",
                feed_id=str(feed_snapshot.id),
                error=str(e),
                exc_info=True,
            )
            failed_count += 1

    return bulk_update_mappings, enriched_count, failed_count
