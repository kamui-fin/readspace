"""Shared enums for schema validation."""

from enum import Enum


class LanguageCode(str, Enum):
    """ISO 639-1 language codes for translation and content processing.

    This enum contains the most commonly used languages for translation.
    For a complete list of ISO 639-1 codes, see: https://en.wikipedia.org/wiki/List_of_ISO_639-1_codes
    """

    # Major Languages
    ENGLISH = "en"
    SPANISH = "es"
    FRENCH = "fr"
    GERMAN = "de"
    ITALIAN = "it"
    PORTUGUESE = "pt"
    DUTCH = "nl"
    RUSSIAN = "ru"
    POLISH = "pl"

    # Asian Languages
    CHINESE_SIMPLIFIED = "zh"
    CHINESE_TRADITIONAL = "zh-TW"
    JAPANESE = "ja"
    KOREAN = "ko"
    VIETNAMESE = "vi"
    THAI = "th"
    INDONESIAN = "id"
    MALAY = "ms"
    HINDI = "hi"
    BENGALI = "bn"
    TAMIL = "ta"
    TELUGU = "te"
    MARATHI = "mr"
    GUJARATI = "gu"

    # Middle Eastern Languages
    ARABIC = "ar"
    HEBREW = "he"
    PERSIAN = "fa"
    TURKISH = "tr"
    URDU = "ur"

    # Nordic Languages
    SWEDISH = "sv"
    DANISH = "da"
    NORWEGIAN = "no"
    FINNISH = "fi"
    ICELANDIC = "is"

    # Eastern European Languages
    UKRAINIAN = "uk"
    CZECH = "cs"
    ROMANIAN = "ro"
    HUNGARIAN = "hu"
    BULGARIAN = "bg"
    CROATIAN = "hr"
    SERBIAN = "sr"
    SLOVAK = "sk"
    SLOVENIAN = "sl"

    # Other European Languages
    GREEK = "el"
    CATALAN = "ca"
    BASQUE = "eu"
    GALICIAN = "gl"

    # African Languages
    SWAHILI = "sw"
    AFRIKAANS = "af"
    ZULU = "zu"
    XHOSA = "xh"

    # Other Languages
    ESPERANTO = "eo"
    LATIN = "la"
