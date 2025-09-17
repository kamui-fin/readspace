"""Language code normalization utilities."""

import re

import structlog
from iso639 import Lang

logger = structlog.get_logger(__name__)


def normalize_language_code(language_code: str | None) -> str | None:
    """
    Normalize language codes to simple two-letter ISO 639-1 codes.

    Examples:
        en-US -> en
        zh-Hans -> zh
        en-GB -> en
        zh-CN -> zh
        fr-FR -> fr
        Spanish -> es (if iso639 can map it)

    Args:
        language_code: Raw language code from feed or other source

    Returns:
        Normalized two-letter language code or None if invalid
    """
    if not language_code:
        return None

    language_code = str(language_code).strip()
    if not language_code:
        return None

    # Handle common complex language codes first
    # Extract base language from codes like en-US, zh-Hans, etc.
    base_code = _extract_base_language(language_code)
    if base_code:
        try:
            # Try to validate/normalize using iso639
            lang = Lang(base_code)
            if lang.pt1:  # pt1 is the two-letter code
                logger.debug(
                    "Language normalized",
                    original=language_code,
                    base=base_code,
                    normalized=lang.pt1,
                )
                return lang.pt1
        except Exception:
            # If iso639 fails, but we have a valid-looking base code, use it
            if len(base_code) == 2 and base_code.isalpha():
                logger.debug(
                    "Using base language code directly",
                    original=language_code,
                    normalized=base_code,
                )
                return base_code.lower()

    # Try to parse the original code with iso639
    try:
        lang = Lang(language_code)
        if lang.pt1:
            logger.debug(
                "Language normalized via iso639",
                original=language_code,
                normalized=lang.pt1,
            )
            return lang.pt1
    except Exception:
        logger.debug("Failed to normalize language code", language_code=language_code)
        return None

    return None


def _extract_base_language(language_code: str) -> str | None:
    """
    Extract the base language code from complex language tags.

    Examples:
        en-US -> en
        zh-Hans -> zh
        zh-CN -> zh
        pt-BR -> pt
        fr-FR -> fr
    """
    # Common patterns for language tags
    patterns = [
        r"^([a-z]{2,3})-[a-z]{2}$",  # en-us, zh-cn (after lowercase)
        r"^([a-z]{2,3})-[a-z]{4}$",  # zh-hans, zh-hant (after lowercase)
        r"^([a-z]{2,3})-[a-z]+$",  # other variants (after lowercase)
        r"^([a-z]{2,3})_[a-z]{2}$",  # en_us (underscore variant, after lowercase)
    ]

    language_code_lower = language_code.lower()

    for pattern in patterns:
        match = re.match(pattern, language_code_lower)
        if match:
            base = match.group(1)
            # Validate that it looks like a language code
            if 2 <= len(base) <= 3 and base.isalpha():
                return base

    # If it's already a simple 2-3 letter code, return it
    if 2 <= len(language_code_lower) <= 3 and language_code_lower.isalpha():
        return language_code_lower

    return None
