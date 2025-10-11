/**
 * OAuth utilities for browser extension authentication flows
 */

/**
 * Parse OAuth tokens from URL hash
 * Supabase OAuth callback includes tokens in URL fragment (#access_token=...&refresh_token=...)
 *
 * @param url - The OAuth callback URL containing token hash
 * @returns Map of token key-value pairs
 */
export function parseUrlHash(url: string): Map<string, string> {
  const hashPart = url.split('#')[1]
  if (!hashPart) {
    return new Map()
  }

  const params = new URLSearchParams(hashPart)
  return new Map(params.entries())
}

/**
 * Extract OAuth tokens from callback URL
 *
 * @param url - The OAuth callback URL
 * @returns Object containing access_token and refresh_token if present
 */
export function extractOAuthTokens(url: string): {
  access_token?: string
  refresh_token?: string
} {
  const hashMap = parseUrlHash(url)
  return {
    access_token: hashMap.get('access_token'),
    refresh_token: hashMap.get('refresh_token'),
  }
}
