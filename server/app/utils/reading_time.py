"""Utility functions for calculating reading time with proper CJK support."""

import re


def is_cjk_text(text: str) -> bool:
    """
    Check if text contains significant CJK (Chinese, Japanese, Korean) characters.
    
    Returns True if more than 20% of non-whitespace characters are CJK.
    """
    if not text.strip():
        return False

    # CJK Unicode ranges:
    # - CJK Unified Ideographs: \u4e00-\u9fff
    # - Hiragana: \u3040-\u309f
    # - Katakana: \u30a0-\u30ff
    # - CJK Symbols and Punctuation: \u3000-\u303f
    # - Hangul Syllables: \uac00-\ud7af
    # - Halfwidth and Fullwidth Forms: \uff00-\uffef
    cjk_pattern = r'[\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\u4e00-\u9fff\uac00-\ud7af\uff00-\uffef]'

    # Remove whitespace and count total characters
    non_whitespace = re.sub(r'\s+', '', text)
    if len(non_whitespace) == 0:
        return False

    # Count CJK characters
    cjk_chars = len(re.findall(cjk_pattern, text))

    # Consider text CJK if more than 20% of characters are CJK
    return (cjk_chars / len(non_whitespace)) > 0.2


def calculate_reading_time(
    content: str,
    default_wpm: int = 230,
    cjk_cpm: int = 300  # characters per minute for CJK
) -> int:
    """
    Calculate estimated reading time in minutes with proper CJK support.
    
    For CJK text, uses character-based calculation.
    For non-CJK text, uses word-based calculation.
    
    Args:
        content: Text content to analyze
        default_wpm: Words per minute for non-CJK text
        cjk_cpm: Characters per minute for CJK text
        
    Returns:
        Reading time in minutes (minimum 1)
    """
    if not content or not content.strip():
        return 1

    # Clean HTML tags if present
    clean_text = re.sub(r'<[^>]*>', ' ', content)
    clean_text = clean_text.strip()

    if not clean_text:
        return 1

    if is_cjk_text(clean_text):
        # For CJK text, count characters (excluding whitespace)
        char_count = len(re.sub(r'\s+', '', clean_text))
        reading_time = max(1, round(char_count / cjk_cpm))
    else:
        # For non-CJK text, count words
        clean_text = re.sub(r'[^\w\s]', ' ', clean_text)  # Remove punctuation
        word_count = len(clean_text.split())
        reading_time = max(1, round(word_count / default_wpm))

    return reading_time


def calculate_reading_time_from_html(
    html_content: str,
    default_wpm: int = 230,
    cjk_cpm: int = 300
) -> int | None:
    """
    Calculate reading time from HTML content using BeautifulSoup for better text extraction.
    
    Args:
        html_content: HTML content to analyze
        default_wpm: Words per minute for non-CJK text  
        cjk_cpm: Characters per minute for CJK text
        
    Returns:
        Reading time in minutes or None if content is empty
    """
    if not html_content or not html_content.strip():
        return None

    try:
        from bs4 import BeautifulSoup
        soup = BeautifulSoup(html_content, 'html.parser')
        text_only = soup.get_text(separator=' ', strip=True)
    except Exception:
        # Fallback to regex if BeautifulSoup fails
        text_only = re.sub(r'<[^>]+>', ' ', html_content)
        text_only = ' '.join(text_only.split())

    if not text_only.strip():
        return None

    return calculate_reading_time(text_only, default_wpm, cjk_cpm)
