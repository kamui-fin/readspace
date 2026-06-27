/**
 * Normalizes a URL for comparison purposes.
 * Removes trailing slashes, normalizes protocol, and removes www prefix.
 *
 * @param url - The URL to normalize
 * @returns The normalized URL string
 *
 * @example
 * normalizeUrl('https://www.example.com/feed/') // 'https://example.com/feed'
 * normalizeUrl('http://example.com/rss') // 'https://example.com/rss'
 */
export function normalizeUrl(url: string): string {
  try {
    const urlObj = new URL(url);

    // Normalize protocol to https (most feeds use https)
    urlObj.protocol = 'https:';

    // Remove www prefix from hostname
    urlObj.hostname = urlObj.hostname.replace(/^www\./, '');

    // Remove trailing slash from pathname
    urlObj.pathname = urlObj.pathname.replace(/\/$/, '') || '/';

    // Sort query parameters for consistent comparison
    urlObj.searchParams.sort();

    return urlObj.toString();
  } catch {
    // If URL parsing fails, return the original URL trimmed
    return url.trim();
  }
}

/**
 * Compares two URLs for equality after normalization.
 *
 * @param url1 - First URL to compare
 * @param url2 - Second URL to compare
 * @returns True if URLs are equivalent after normalization
 *
 * @example
 * areUrlsEqual('https://example.com/feed/', 'http://www.example.com/feed') // true
 */
export function areUrlsEqual(url1: string, url2: string): boolean {
  return normalizeUrl(url1) === normalizeUrl(url2);
}
