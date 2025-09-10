#!/usr/bin/env python3
"""
RSS Feed Popularity Scoring Framework

This module implements a comprehensive popularity scoring system that blends:
1. LLM-based popularity assessment (50% weight)
2. Domain authority/traffic rank (30% weight) 
3. Quality score including activity metrics (20% weight)

Final score range: 0-100 (higher = more popular)
"""

from typing import Any

import structlog

logger = structlog.get_logger(__name__)


class DomainAuthorityScorer:
    """Handles domain authority and traffic ranking."""

    def __init__(self, page_rank_loader=None):
        self.page_rank_loader = page_rank_loader

    def score_domain_authority(self, domain: str, xml_url: str = "") -> int:
        """
        Score domain authority based on recognition and patterns.
        
        Returns score 0-100 (higher = higher authority/traffic)
        """
        if not domain:
            return 0  # Zero score for missing domain

        domain = domain.lower().strip()

        # Remove www prefix for matching
        clean_domain = domain.replace('www.', '')

        # Use PageRank datasets if available
        if self.page_rank_loader:
            page_rank_score = self.page_rank_loader.get_domain_score(clean_domain)
            if page_rank_score > 0.0:
                logger.debug(f"  PageRank found for '{clean_domain}': {page_rank_score}")
                return int(page_rank_score)
            else:
                logger.debug(f"  PageRank NOT found for '{clean_domain}' (score: 0)")

        # Default to 0 if not found in datasets
        return 0


class PopularityScorer:
    """Main popularity scoring system that combines all components."""

    def __init__(self, page_rank_loader=None):
        self.domain_scorer = DomainAuthorityScorer(page_rank_loader)

        # Weights for composite score (must sum to 1.0)
        self.weights = {
            'llm': 0.5,      # 50% - LLM brand recognition (most important)
            'domain': 0.3,   # 30% - Domain authority/traffic
            'quality': 0.2   # 20% - Quality score (includes activity metrics)
        }

    def calculate_popularity_score(self, feed_data: dict[str, Any]) -> dict[str, Any]:
        """
        Calculate comprehensive popularity score for a feed.
        
        Args:
            feed_data: Feed metadata dictionary
            
        Returns:
            Dictionary with individual scores and final composite score
        """
        # Get LLM score from feed data if available (from AI enrichment)
        llm_score = feed_data.get('popularity_estimate', 50)  # Default to middle

        # Log domain being used for PageRank lookup
        domain = feed_data.get('domain', '')
        xml_url = feed_data.get('xmlUrl', '')
        logger.debug(f"PopularityScorer: Looking up domain '{domain}' for feed: {feed_data.get('title', 'Unknown')[:50]}")
        if xml_url:
            logger.debug(f"  xmlUrl: {xml_url}")

        domain_score = self.domain_scorer.score_domain_authority(domain, xml_url)

        # Get quality score (0-1 scale) and convert to 0-100 for consistency
        quality_score_raw = feed_data.get('quality_score', 0.5)  # Default 0.5 if missing
        quality_score = quality_score_raw * 100  # Convert 0-1 to 0-100

        # Calculate weighted composite score
        final_score = (
            self.weights['llm'] * llm_score +
            self.weights['domain'] * domain_score +
            self.weights['quality'] * quality_score
        )

        return {
            'popularity_score': round(final_score, 1),
            'llm_popularity_score': llm_score,
            'domain_authority_score': domain_score,
            'quality_score': quality_score,
            'scoring_weights': self.weights.copy()
        }
