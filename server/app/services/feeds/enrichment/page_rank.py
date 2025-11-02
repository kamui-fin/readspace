"""PageRank service for domain authority scoring."""

import json
from pathlib import Path
from typing import Any

import structlog

from app.core.config import get_settings
from app.core.constants import DOMAIN_LOOKUP_CACHE_TTL
from app.core.redis_cache import get_redis_cache

logger = structlog.get_logger(__name__)


class PageRankService:
    """Service for domain authority scoring using merged PageRank datasets."""

    def __init__(self) -> None:
        self.settings = get_settings()
        self._domain_scores: dict[str, float] | None = None
        self._load_dataset()

    def _load_dataset(self) -> None:
        """Load the merged PageRank dataset."""
        try:
            # Look for merged dataset in app/data/
            dataset_path = Path(__file__).parent.parent / "data" / "merged_pagerank.json"

            if dataset_path.exists():
                with dataset_path.open(encoding="utf-8") as f:
                    self._domain_scores = json.load(f)

                logger.info(
                    "PageRank dataset loaded",
                    total_domains=len(self._domain_scores),
                    file_size_mb=round(dataset_path.stat().st_size / 1024 / 1024, 1),
                )
            else:
                logger.warning(
                    "PageRank dataset not found, using empty dataset",
                    expected_path=dataset_path,
                )
                self._domain_scores = {}

        except Exception as e:
            logger.error("Failed to load PageRank dataset", error=str(e), exc_info=True)
            self._domain_scores = {}

    async def get_domain_score_cached(self, domain: str) -> float:
        """
        Get PageRank score for a domain with Redis caching.

        This method caches domain lookups in Redis for 1 hour to improve performance.
        Domain lookups can be expensive when done repeatedly for the same domains.

        Args:
            domain: Domain to score (e.g., 'example.com')

        Returns:
            Score from 0.0 to 100.0 (higher = more authoritative)
        """
        if not domain:
            return 0.0

        from app.utils.domain_helpers import extract_clean_domain

        # Clean domain for cache key
        domain_clean = extract_clean_domain(domain)
        if not domain_clean:
            return 0.0

        # Check cache first
        cache = get_redis_cache()
        cache_key = f"pagerank:domain:{domain_clean}"

        try:
            cached_score = await cache.get(cache_key)
            if cached_score is not None:
                logger.debug("PageRank cache hit", domain=domain_clean, score=cached_score)
                return float(cached_score)
        except Exception as e:
            logger.warning("Failed to get cached PageRank score", domain=domain_clean, error=str(e))

        # Cache miss - compute score
        score = self.get_domain_score(domain_clean)

        # Cache the result
        try:
            await cache.set(cache_key, score, ttl_seconds=DOMAIN_LOOKUP_CACHE_TTL)
            logger.debug("PageRank cached", domain=domain_clean, score=score, ttl=DOMAIN_LOOKUP_CACHE_TTL)
        except Exception as e:
            logger.warning("Failed to cache PageRank score", domain=domain_clean, error=str(e))

        return score

    def get_domain_score(self, domain: str) -> float:
        """
        Get PageRank score for a domain (synchronous, non-cached version).

        For async code with caching, use get_domain_score_cached() instead.

        Args:
            domain: Domain to score (e.g., 'example.com')

        Returns:
            Score from 0.0 to 100.0 (higher = more authoritative)
        """
        if not self._domain_scores:
            return 0.0

        from app.utils.domain_helpers import extract_clean_domain

        if not domain:
            return 0.0

        # Clean domain
        domain_clean = extract_clean_domain(domain)

        # Direct lookup
        if domain_clean in self._domain_scores:
            return self._domain_scores[domain_clean]

        # Try subdomain fallback (e.g., blog.example.com -> example.com)
        if "." in domain_clean:
            parts = domain_clean.split(".")
            if len(parts) > 2:
                # Try parent domain
                parent_domain = ".".join(parts[-2:])
                if parent_domain in self._domain_scores:
                    # Give subdomain slightly lower score
                    return self._domain_scores[parent_domain] * 0.8

        return 0.0

    def is_loaded(self) -> bool:
        """Check if PageRank dataset is loaded."""
        return self._domain_scores is not None and len(self._domain_scores) > 0

    def get_stats(self) -> dict[str, Any]:
        """Get dataset statistics."""
        if not self._domain_scores:
            return {"loaded": False, "total_domains": 0}

        scores = list(self._domain_scores.values())
        return {
            "loaded": True,
            "total_domains": len(self._domain_scores),
            "min_score": min(scores) if scores else 0,
            "max_score": max(scores) if scores else 0,
            "avg_score": sum(scores) / len(scores) if scores else 0,
        }


# Singleton instance
_page_rank_service: PageRankService | None = None


def get_page_rank_service() -> PageRankService:
    """Get the singleton PageRank service instance."""
    global _page_rank_service
    if _page_rank_service is None:
        _page_rank_service = PageRankService()
    return _page_rank_service
