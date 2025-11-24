"""PageRank service for domain authority scoring."""

import json
from pathlib import Path
from typing import Any

import structlog

from app.core.config import get_settings

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
            # Path: server/app/services/feeds/enrichment/page_rank.py -> server/app/data/
            dataset_path = Path(__file__).parent.parent.parent.parent / "data" / "merged_pagerank.json"

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

    def get_domain_score(self, domain: str) -> float:
        """
        Get PageRank score for a domain.

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
