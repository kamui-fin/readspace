from app.typing.feeds import ArticleStats, FeedScoringData


def calculate_quality_score(
    feed_data: FeedScoringData,
    article_stats: ArticleStats | None = None,
) -> float:
    """
    Calculate a quality score (0.0 - 1.0) based on metadata completeness and content quality.

    Args:
        feed_data: Feed metadata (title, description, etc.)
        article_stats: Statistics about recent articles (image_count, avg_length, etc.)
    """
    score = 0.0

    # 1. Metadata Completeness (Max 0.6)
    # Title (0.15)
    if feed_data.title and feed_data.title != "Unknown Feed":
        score += 0.15

    # Description (0.15) - Increased weight
    if feed_data.description:
        score += 0.15

    # Image (0.15) - Increased weight
    if feed_data.image_url:
        score += 0.15

    # Language (0.05)
    if feed_data.language:
        score += 0.05

    # 2. Content Quality (Max 0.5)
    if article_stats:
        # Visuals: Do articles have images?
        if article_stats.image_ratio > 0.5:
            score += 0.15
        elif article_stats.image_ratio > 0.0:
            score += 0.05

        # Depth: Are articles substantial?
        if article_stats.avg_content_length > 1000:
            score += 0.15
        elif article_stats.avg_content_length > 300:
            score += 0.05

        # Activity: Is it active? (implied if we have recent articles)
        if article_stats.count >= 5:
            score += 0.1
        elif article_stats.count > 0:
            score += 0.05

        # Recency bonus
        if article_stats.days_since_last_article < 3:
            score += 0.1

    return min(score, 1.0)


def calculate_hybrid_popularity_score(
    feed_data: FeedScoringData,
    llm_popularity_estimate: int,
    domain_authority_score: float = 0.0,
    article_stats: ArticleStats | None = None,
) -> dict[str, float]:
    """Calculate hybrid popularity score combining LLM estimate, domain authority, and quality.

    Scoring weights:
    - 40% LLM brand recognition estimate
    - 30% Domain authority (Tranco rankings)
    - 30% Quality score (metadata + content)

    Args:
        feed_data: Feed metadata object
        llm_popularity_estimate: LLM-provided popularity estimate (1-100)
        domain_authority_score: Domain authority score (0.0-1.0), defaults to 0.0
        article_stats: Optional stats about recent articles

    Returns:
        Dictionary with popularity_score, llm_popularity_score, domain_authority_score, quality_score
    """
    # Normalize LLM score to 0-1 range (domain_authority_score already normalized)
    llm_score = llm_popularity_estimate / 100.0
    quality_score = calculate_quality_score(feed_data, article_stats)

    # Hybrid score: weighted combination
    # 40% LLM estimate, 30% domain authority, 30% quality
    popularity_score = (
        (llm_score * 0.4) + (domain_authority_score * 0.3) + (quality_score * 0.3)
    )

    return {
        "popularity_score": popularity_score,
        "llm_popularity_score": llm_score,
        "domain_authority_score": domain_authority_score,
        "quality_score": quality_score,
    }
