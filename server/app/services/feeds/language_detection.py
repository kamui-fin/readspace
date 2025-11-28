from functools import lru_cache

import structlog
from lingua import LanguageDetectorBuilder

logger = structlog.get_logger(__name__)


@lru_cache(maxsize=1)
def _get_detector():
    """Cached loader for the heavy LanguageDetector object."""
    # Assuming 'from_all_languages' is desired for a generic feed reader
    return LanguageDetectorBuilder.from_all_spoken_languages().build()


def detect_language(text: str, min_confidence: float = 0.7) -> str | None:
    """Detects ISO 639-1 code from text if confidence threshold is met."""
    if not text or len(text) < 10:
        return None

    try:
        # compute_language_confidence_values returns a sorted list (best first)
        results = _get_detector().compute_language_confidence_values(text)

        if results and results[0].value >= min_confidence:
            return results[0].language.iso_code_639_1.name.lower()

    except Exception as e:
        logger.warning("Language detection error", error=str(e))

    return None


def detect_feed_language(title: str | None, description: str | None, articles: list[str], default: str = "en") -> str:
    """
    Aggregates feed metadata (title, desc, first 5 articles) to detect language.
    Defaults to 'en' if detection fails.
    """
    # Combine valid strings from title, description, and the first 5 articles
    candidates = [title, description] + articles[:5]
    combined_text = " ".join(filter(None, candidates))

    return detect_language(combined_text) or default
