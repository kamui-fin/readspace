/**
 * Estimate reading time for a given text.
 * Handles both CJK (Chinese, Japanese, Korean) and non-CJK text.
 */
export function estimateReadingTime(text: string): number {
  const cleanText = text.trim();
  if (!cleanText) return 1;

  // Check if text contains significant CJK characters
  const cjkPattern =
    /[\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\u4e00-\u9fff\uac00-\ud7af\uff00-\uffef]/g;
  const nonWhitespace = cleanText.replace(/\s+/g, '');

  if (nonWhitespace.length > 0) {
    const cjkMatches = cleanText.match(cjkPattern);
    const cjkChars = cjkMatches ? cjkMatches.length : 0;

    // Consider text CJK if more than 20% of characters are CJK
    if (cjkChars / nonWhitespace.length > 0.2) {
      // For CJK text, count characters (excluding whitespace)
      const charactersPerMinute = 300;
      const charCount = nonWhitespace.length;
      return Math.max(1, Math.round(charCount / charactersPerMinute));
    }
  }

  // For non-CJK text, count words
  const wordsPerMinute = 200;
  const wordCount = cleanText.split(/\s+/).length;
  return Math.max(1, Math.round(wordCount / wordsPerMinute));
}
