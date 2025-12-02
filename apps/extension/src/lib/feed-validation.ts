import { DetectedFeed } from '@/types'

/**
 * Validates a list of potential feeds by fetching them.
 * Uses HEAD requests first, falling back to GET if necessary.
 * Checks Content-Type and/or response body for RSS/Atom signatures.
 */
export async function validateFeeds(feeds: DetectedFeed[]): Promise<DetectedFeed[]> {
    const validFeeds: DetectedFeed[] = []
    const uniqueUrls = new Set<string>()

    // Sort by confidence score
    const sortedFeeds = [...feeds].sort((a, b) => b.score - a.score)

    // Limit to top 10 candidates to avoid excessive network requests
    const candidates = sortedFeeds.slice(0, 10)

    await Promise.all(candidates.map(async (feed) => {
        if (uniqueUrls.has(feed.url)) return

        try {
            const controller = new AbortController()
            const timeoutId = setTimeout(() => controller.abort(), 5000)

            // 1. Try HEAD first to check Content-Type
            let response = await fetch(feed.url, {
                method: 'HEAD',
                signal: controller.signal,
                headers: { 'User-Agent': 'Readspace Extension Feed Validator' }
            })
            clearTimeout(timeoutId)

            // If HEAD not allowed, try GET (but only for headers)
            if (response.status === 405) {
                const getController = new AbortController()
                const getTimeoutId = setTimeout(() => getController.abort(), 5000)
                response = await fetch(feed.url, {
                    method: 'GET',
                    signal: getController.signal,
                    headers: { 'User-Agent': 'Readspace Extension Feed Validator' }
                })
                clearTimeout(getTimeoutId)
            }

            if (!response.ok) return

            const contentType = response.headers.get('content-type')?.toLowerCase() || ''

            // Check if content type indicates a feed
            // We are more permissive here since we are not checking the body
            const isFeedType =
                contentType.includes('application/rss+xml') ||
                contentType.includes('application/atom+xml') ||
                contentType.includes('application/feed+json') ||
                contentType.includes('text/xml') ||
                contentType.includes('application/xml')

            if (isFeedType) {
                if (!uniqueUrls.has(feed.url)) {
                    uniqueUrls.add(feed.url)

                    // Update type if unknown and we can guess from content-type
                    let type = feed.type
                    if (type === 'unknown') {
                        if (contentType.includes('rss')) type = 'rss'
                        else if (contentType.includes('atom')) type = 'atom'
                        else if (contentType.includes('json')) type = 'json'
                        else type = 'rss' // Default fallback
                    }

                    validFeeds.push({ ...feed, type })
                }
            }

        } catch (e) {
            // Fetch failed, ignore
        }
    }))

    return validFeeds
}
