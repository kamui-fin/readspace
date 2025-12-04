/**
 * Feed discovery utilities for content script
 * Scans the DOM for potential RSS/Atom feeds using multiple strategies.
 */

export interface DetectedFeed {
  url: string
  type: 'rss' | 'atom' | 'json' | 'unknown'
  title?: string
  source: 'link-tag' | 'anchor-tag' | 'guess'
  score: number // Confidence score: 10 (high) to 1 (low)
}

/**
 * Scans the current document for potential feeds.
 * This runs in the content script context.
 */
export function scanForFeeds(): DetectedFeed[] {
  const feeds: DetectedFeed[] = []
  const seenUrls = new Set<string>()

  // Helper to add unique feeds
  const addFeed = (feed: DetectedFeed) => {
    try {
      // Resolve relative URLs
      const absoluteUrl = new URL(feed.url, document.baseURI).href

      // Skip duplicates
      if (seenUrls.has(absoluteUrl)) return

      // Skip common non-feed file extensions
      if (
        absoluteUrl.match(
          /\.(jpg|jpeg|png|gif|svg|css|js|woff|woff2|ttf|eot|mp4|webm|pdf|zip|tar|gz)$/i
        )
      ) {
        return
      }

      // Skip common asset directories
      if (
        absoluteUrl.match(
          /\/(static|assets|images?|img|media|js|css|fonts?|dist|build|node_modules)\//i
        )
      ) {
        return
      }

      seenUrls.add(absoluteUrl)
      feeds.push({ ...feed, url: absoluteUrl })
    } catch {
      // Invalid URL, ignore
    }
  }

  // 1. Autodiscovery via <link> tags (High Confidence)
  // Look for standard RSS/Atom discovery tags
  const linkTags = document.querySelectorAll('link[rel="alternate"]')
  linkTags.forEach((link) => {
    const type = link.getAttribute('type')?.toLowerCase() || ''
    const href = link.getAttribute('href')
    const title = link.getAttribute('title') || undefined

    if (
      href &&
      (type.includes('rss') || type.includes('atom') || type.includes('xml'))
    ) {
      addFeed({
        url: href,
        type: type.includes('atom') ? 'atom' : 'rss',
        title,
        source: 'link-tag',
        score: 10,
      })
    }
  })

  // 2. Scan explicit <a> tags (Medium Confidence)
  // Look for visible links to feeds
  const anchors = document.querySelectorAll('a')
  anchors.forEach((a) => {
    const href = a.getAttribute('href')
    if (!href) return

    const hrefLower = href.toLowerCase()
    const text = a.textContent?.trim() || ''

    // Check for keywords in href
    const isFeedLink =
      hrefLower.includes('/feed') ||
      hrefLower.includes('/rss') ||
      hrefLower.includes('/atom') ||
      hrefLower.endsWith('.xml') ||
      hrefLower.endsWith('.rss')

    if (isFeedLink) {
      addFeed({
        url: href,
        type: hrefLower.includes('atom') ? 'atom' : 'rss', // Best guess
        title: text || undefined,
        source: 'anchor-tag',
        score: 5,
      })
    }
  })

  // 3. Guess Common URLs (Low Confidence)
  // These must be validated by the background script
  const commonPaths = [
    '/feed',
    '/rss',
    '/atom.xml',
    '/rss.xml',
    '/feed.xml',
    '/feeds/posts/default', // Blogger
  ]

  // Add blog-specific patterns if we are in a subpath
  const pathParts = window.location.pathname.split('/').filter(Boolean)
  if (pathParts.length > 0) {
    // e.g. /blog/feed
    commonPaths.push(`/${pathParts[0]}/feed`)
    commonPaths.push(`/${pathParts[0]}/rss`)
  }

  commonPaths.forEach((path) => {
    addFeed({
      url: path,
      type: 'unknown',
      source: 'guess',
      score: 1,
    })
  })

  // Sort by confidence score
  return feeds.sort((a, b) => b.score - a.score)
}
