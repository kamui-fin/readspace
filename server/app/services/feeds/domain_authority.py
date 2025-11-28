from functools import lru_cache

import structlog
from pydantic import BaseModel
from tranco import Tranco

logger = structlog.get_logger(__name__)

# Scoring tiers: (Rank Limit, Base Score, Score Width)
# Example: Top 100 gets a base of 0.95 plus a fraction of the 0.05 width
SCORING_TIERS = [
    (100, 0.95, 0.05),
    (1_000, 0.85, 0.10),
    (10_000, 0.70, 0.15),
    (100_000, 0.50, 0.20),
    (1_000_000, 0.00, 0.50),
]


class DomainScore(BaseModel):
    score: float
    rank: int | None = None
    source: str = "tranco"


@lru_cache(maxsize=1)
def _get_tranco_list():
    """Cached loader for the Tranco list to avoid file I/O on every call."""
    try:
        return Tranco(cache=True, cache_dir=".tranco").list()
    except Exception as e:
        logger.error("Failed to load Tranco list", error=str(e))
        return None


def get_domain_authority_score(domain: str) -> DomainScore:
    """Calculates domain authority (0.0-1.0) using Tranco rank."""
    if not domain or not (tranco := _get_tranco_list()):
        return DomainScore(score=0.0)

    # formatting: ensure clean domain
    rank = tranco.rank(domain)

    # Fallback: if not found, try the parent domain (e.g., blog.google.com -> google.com)
    if rank == -1 and domain.count(".") > 1:
        rank = tranco.rank(".".join(domain.split(".")[-2:]))

    if rank == -1:
        return DomainScore(score=0.0)

    # Calculate score based on tiers
    prev_limit = 0
    for limit, base, width in SCORING_TIERS:
        if rank <= limit:
            # Linear interpolation within the tier
            # The lower the rank (closer to 1), the higher the score
            bucket_size = limit - prev_limit
            score = base + ((limit - rank) / bucket_size * width)
            return DomainScore(score=score, rank=rank)
        prev_limit = limit

    return DomainScore(score=0.0, rank=rank)


def get_domain_authority_scores_batch(domains: list[str]) -> dict[str, float]:
    """
    Calculates domain authority scores for a batch of domains.
    Returns a dictionary mapping domain -> score (float).
    """
    if not domains:
        return {}

    # Ensure Tranco list is loaded once
    _get_tranco_list()

    scores = {}
    for domain in domains:
        if not domain:
            continue
        result = get_domain_authority_score(domain)
        scores[domain] = result.score

    return scores
