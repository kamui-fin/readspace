import browser from 'webextension-polyfill'
import { pageCache } from '@/lib/page-cache'
import { CachedPageContent, CachedPageMetadata } from '@/types'
import { validateFeeds } from '@/lib/feed-validation'

function isSupportedUrl(url: string): boolean {
    return url.startsWith('http://') || url.startsWith('https://')
}

async function updateFeedBadge(tabId: number, feedCount: number) {
    try {
        if (feedCount > 0) {
            await browser.action.setBadgeText({
                text: feedCount.toString(),
                tabId,
            })
            await browser.action.setBadgeBackgroundColor({
                color: '#FF6B35',
                tabId,
            })
        } else {
            await browser.action.setBadgeText({ text: '', tabId })
        }
    } catch (error) {
        console.error('Failed to update badge:', error)
    }
}

async function handleTabUpdated(
    tabId: number,
    changeInfo: browser.Tabs.OnUpdatedChangeInfoType,
    tab: browser.Tabs.Tab
) {
    if (changeInfo.status === 'complete' && tab.url && isSupportedUrl(tab.url)) {
        try {
            // 0. Check cache for instant feedback
            const cached = await pageCache.get(tab.url)
            if (cached?.metadata?.feeds) {
                await updateFeedBadge(tabId, cached.metadata.feeds.length)
            }

            // Give the page a moment to settle
            setTimeout(async () => {
                try {
                    // 1. Extract Metadata & Potential Feeds
                    const metadata = (await browser.tabs.sendMessage(tabId, {
                        type: 'extractMetadata',
                    })) as CachedPageMetadata

                    const potentialFeeds = metadata?.feeds || []

                    // 2. Optimistic Badge Update (High confidence only)
                    // Only do this if we didn't already show a cached value, 
                    // or if we want to update the cached value with a "fresh" guess before validation
                    const highConfidenceCount = potentialFeeds.filter(f => f.score >= 5).length
                    if (highConfidenceCount > 0) {
                        await updateFeedBadge(tabId, highConfidenceCount)
                    }

                    // 3. Validate Feeds in Background
                    const validFeeds = await validateFeeds(potentialFeeds)

                    // 4. Update Metadata with Validated Feeds
                    const updatedMetadata = { ...metadata, feeds: validFeeds }
                    await pageCache.setMetadata(tab.url!, updatedMetadata)

                    // 5. Final Badge Update
                    await updateFeedBadge(tabId, validFeeds.length)

                    // 6. Extract Full Content (Lazy)
                    const content = (await browser.tabs.sendMessage(tabId, {
                        type: 'extractContent',
                    })) as CachedPageContent

                    if (content) {
                        await pageCache.setContent(tab.url!, content)
                    }
                } catch {
                    // Only clear if we didn't have a cached value? 
                    // Or clear if extraction failed implies page is broken/no feeds?
                    // Safer to clear or leave existing if it was just a script error.
                    // But if extraction fails, we probably can't get feeds.
                    await updateFeedBadge(tabId, 0)
                }
            }, 500)
        } catch (error) {
            console.error('Error checking for RSS feeds:', error)
        }
    } else if (changeInfo.status === 'loading') {
        // Clear badge while loading
        await updateFeedBadge(tabId, 0)
    }
}

async function handleTabActivated(activeInfo: browser.Tabs.OnActivatedActiveInfoType) {
    try {
        const tab = await browser.tabs.get(activeInfo.tabId)
        if (tab.url && isSupportedUrl(tab.url)) {
            // Check cache first
            const cached = await pageCache.get(tab.url)
            if (cached?.metadata?.feeds) {
                await updateFeedBadge(activeInfo.tabId, cached.metadata.feeds.length)
            } else {
                // If not cached, we might want to trigger a scan? 
                // Usually handleTabUpdated catches it, but if we switch back to a tab 
                // that was loaded before extension started, we might miss it.
                // For now, just clear or leave as is.
            }
        } else {
            await updateFeedBadge(activeInfo.tabId, 0)
        }
    } catch (error) {
        console.error('Error handling tab activation:', error)
    }
}

export function initTabs() {
    browser.tabs.onUpdated.addListener(handleTabUpdated)
    browser.tabs.onActivated.addListener(handleTabActivated)
}
