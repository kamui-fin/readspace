import { useExtensionStore } from '@/store'
import { sendMessage } from '@/shared/messaging'
import { PageMetadata } from '@readspace/shared'
import { useCallback, useEffect, useState } from 'react'

// Helper to send message to tab with timeout
const sendTabMessage = <T>(tabId: number, type: string, timeout = 5000): Promise<T> => {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            reject(new Error(`Timeout: ${type} took longer than ${timeout}ms`))
        }, timeout)

        chrome.tabs.sendMessage(tabId, { type }, (response) => {
            clearTimeout(timer)
            if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message))
            } else {
                resolve(response)
            }
        })
    })
}

export function useCurrentPage() {
    const { currentPageMetadata, setCurrentPageMetadata } = useExtensionStore()
    const [currentTab, setCurrentTab] = useState<chrome.tabs.Tab | null>(null)
    const [readingTime, setReadingTime] = useState<number | undefined>()
    const [isUnsupportedPage, setIsUnsupportedPage] = useState(false)
    const [isMetadataLoading, setIsMetadataLoading] = useState(true)
    const [isFeedDataLoading, setIsFeedDataLoading] = useState(true)

    const extractPageMetadata = useCallback(
        async (tab: chrome.tabs.Tab) => {
            if (!tab.id || !tab.url) return

            // 1. Show basic tab info immediately
            setCurrentPageMetadata({
                title: tab.title,
                canonical_url: tab.url,
                favicon: tab.favIconUrl,
            })
            setIsMetadataLoading(false)
            setIsFeedDataLoading(false)

            // 2. Check persistent cache
            let foundCacheWithFeeds = false
            try {
                const cachedPage = await sendMessage<any>({
                    type: 'getCachedPageByUrl',
                    payload: tab.url,
                })

                if (cachedPage) {
                    if (cachedPage.metadata) {
                        setCurrentPageMetadata(cachedPage.metadata)
                        if (cachedPage.metadata.feeds?.length > 0) {
                            foundCacheWithFeeds = true
                        }
                    }
                    if (cachedPage.content?.estimated_read_time) {
                        setReadingTime(cachedPage.content.estimated_read_time)
                    }
                }
            } catch {
                // Ignore cache errors
            }

            if (foundCacheWithFeeds) return

            // 3. Extract metadata from page (non-blocking)
            try {
                const metadata = await sendTabMessage<PageMetadata>(tab.id, 'extractMetadata', 3000)
                if (metadata) {
                    setCurrentPageMetadata(metadata)
                }
            } catch (e) {
                // Ignore extraction errors, we have basic info
            }

            // 4. Extract content for reading time (non-blocking)
            try {
                const contentData = await sendTabMessage<{ estimated_read_time?: number }>(
                    tab.id,
                    'extractContent',
                    10000
                )
                if (contentData?.estimated_read_time) {
                    setReadingTime(contentData.estimated_read_time)
                }
            } catch (e) {
                // Ignore content extraction errors
            }
        },
        [setCurrentPageMetadata]
    )

    useEffect(() => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const tab = tabs[0]
            if (tab) {
                setCurrentTab(tab)
                const url = tab.url
                if (url && !url.startsWith('http://') && !url.startsWith('https://')) {
                    setIsUnsupportedPage(true)
                    return
                }
                setIsUnsupportedPage(false)
                extractPageMetadata(tab)
            }
        })
    }, [extractPageMetadata])

    return {
        currentTab,
        currentPageMetadata,
        readingTime,
        isUnsupportedPage,
        isMetadataLoading,
        isFeedDataLoading,
    }
}
