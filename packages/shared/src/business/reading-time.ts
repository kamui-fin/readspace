/**
 * Utility functions for calculating reading time with proper CJK support.
 */

/**
 * Check if text contains significant CJK (Chinese, Japanese, Korean) characters.
 * Returns true if more than 20% of non-whitespace characters are CJK.
 */
export function isCjkText(text: string): boolean {
    if (!text.trim()) {
        return false
    }

    // CJK Unicode ranges:
    // - CJK Unified Ideographs: \u4e00-\u9fff
    // - Hiragana: \u3040-\u309f
    // - Katakana: \u30a0-\u30ff
    // - CJK Symbols and Punctuation: \u3000-\u303f
    // - Hangul Syllables: \uac00-\ud7af
    // - Halfwidth and Fullwidth Forms: \uff00-\uffef
    const cjkPattern = /[\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\u4e00-\u9fff\uac00-\ud7af\uff00-\uffef]/g

    // Remove whitespace and count total characters
    const nonWhitespace = text.replace(/\s+/g, "")
    if (nonWhitespace.length === 0) {
        return false
    }

    // Count CJK characters
    const cjkMatches = text.match(cjkPattern)
    const cjkChars = cjkMatches ? cjkMatches.length : 0

    // Consider text CJK if more than 20% of characters are CJK
    return (cjkChars / nonWhitespace.length) > 0.2
}

/**
 * Calculate estimated reading time in minutes with proper CJK support.
 *
 * For CJK text, uses character-based calculation.
 * For non-CJK text, uses word-based calculation.
 */
export function calculateReadingTime(
    content: string,
    defaultWpm: number = 230,
    cjkCpm: number = 300  // characters per minute for CJK
): number {
    if (!content || !content.trim()) {
        return 1
    }

    // Clean HTML tags if present
    let cleanText = content.replace(/<[^>]*>/g, " ").trim()

    if (!cleanText) {
        return 1
    }

    if (isCjkText(cleanText)) {
        // For CJK text, count characters (excluding whitespace)
        const charCount = cleanText.replace(/\s+/g, "").length
        return Math.max(1, Math.round(charCount / cjkCpm))
    } else {
        // For non-CJK text, count words
        cleanText = cleanText.replace(/[^\w\s]/g, " ")  // Remove punctuation
        const wordCount = cleanText.split(/\s+/).filter(word => word.length > 0).length
        return Math.max(1, Math.round(wordCount / defaultWpm))
    }
}

/**
 * Calculate reading time from HTML content with better text extraction.
 * Returns null if content is empty.
 */
export function calculateReadingTimeFromHtml(
    htmlContent: string,
    defaultWpm: number = 230,
    cjkCpm: number = 300
): number | null {
    if (!htmlContent || !htmlContent.trim()) {
        return null
    }

    let textOnly: string

    // Try to use DOMParser if available (browser environment)
    if (typeof DOMParser !== 'undefined') {
        try {
            const parser = new DOMParser()
            const doc = parser.parseFromString(htmlContent, 'text/html')
            textOnly = doc.body?.textContent || doc.textContent || ""
        } catch {
            // Fallback to regex
            textOnly = htmlContent.replace(/<[^>]+>/g, " ")
            textOnly = textOnly.split(/\s+/).join(" ")
        }
    } else {
        // Node.js environment fallback to regex
        textOnly = htmlContent.replace(/<[^>]+>/g, " ")
        textOnly = textOnly.split(/\s+/).join(" ")
    }

    if (!textOnly.trim()) {
        return null
    }

    return calculateReadingTime(textOnly, defaultWpm, cjkCpm)
}