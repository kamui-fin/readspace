// HTML entity decoding map for common entities
const HTML_ENTITIES: Record<string, string> = {
    '&nbsp;': ' ',
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&apos;': "'",
    '&cent;': '¢',
    '&pound;': '£',
    '&yen;': '¥',
    '&euro;': '€',
    '&copy;': '©',
    '&reg;': '®',
    '&trade;': '™',
    '&hellip;': '…',
    '&mdash;': '—',
    '&ndash;': '–',
    '&lsquo;': "'",
    '&rsquo;': "'",
    '&ldquo;': '"',
    '&rdquo;': '"',
    '&bull;': '•',
};

/**
 * Strips HTML tags and decodes HTML entities from a string
 * @param html - The HTML string to clean
 * @returns The cleaned text with HTML tags removed and entities decoded
 */
export function stripHtml(html: string): string {
    let text = html;

    // Remove HTML tags
    text = text.replace(/<[^>]*>/g, ' ');

    // Decode numeric entities (e.g., &#8216;, &#x2019;)
    text = text.replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)));
    text = text.replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));

    // Decode named entities
    text = text.replace(/&[a-z]+;/gi, (entity) => HTML_ENTITIES[entity] || entity);

    // Clean up whitespace
    text = text.replace(/\s+/g, ' ').trim();

    return text;
}

