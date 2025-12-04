import { DiscoveredFeed } from '@readspace/shared'

/**
 * Generate a user-friendly feed name from the URL if no title is provided
 */
export const getFeedDisplayName = (feed: DiscoveredFeed): string => {
  if (feed.title) return feed.title

  try {
    const url = new URL(feed.url)
    const path = url.pathname

    // Extract meaningful name from path
    // E.g., /rss → "RSS Feed", /blog/feed → "Blog Feed", /news/rss → "News Feed"
    const parts = path
      .split('/')
      .filter((p) => p && p !== 'feed' && p !== 'rss' && p !== 'atom')

    if (parts.length > 0) {
      // Capitalize first letter of each part
      const name = parts[parts.length - 1]
        .split(/[-_]/)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ')
      return `${name} Feed`
    }

    // Fallback to domain name
    const domain = url.hostname.replace('www.', '')
    return `${domain} Feed`
  } catch {
    return 'RSS Feed'
  }
}
