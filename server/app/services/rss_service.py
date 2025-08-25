"""Backward-compatible alias for the refactored RSS service."""

from app.services.rss_orchestration_service import RssOrchestrationService

# Create a backward-compatible alias
RssService = RssOrchestrationService
