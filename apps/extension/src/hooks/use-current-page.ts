import { useExtensionStore } from '@/store'
import { sendMessage, sendTabMessage } from '@/shared/messaging'
import { PageMetadata } from '@readspace/shared'
import { useCallback, useEffect, useState } from 'react'

export function useCurrentPage() {
    const { currentPageMetadata, setCurrentPageMetadata } = useExtensionStore()
    const [currentTab, setCurrentTab] = useState<chrome.tabs.Tab | null>(null)
    const [readingTime, setReadingTime] = useState<number | undefined>()
    const [isUnsupportedPage, setIsUnsupportedPage] = useState(false)
    const [isMetadataLoading, setIsMetadataLoading] = useState(true)
    const [isFeedDataLoading, setIsFeedDataLoading] = useState(true)

    const checkCache = async (url: string) => {
        try {
            const cachedPage = await sendMessage<any>({
                type: 'getCachedPageByUrl',
                payload: url,
            })
            if (cachedPage) {
                if (cachedPage.metadata) setCurrentPageMetadata(cachedPage.metadata)
                if (cachedPage.content?.estimated_read_time) setReadingTime(cachedPage.content.estimated_read_time)
                return !!(cachedPage.metadata?.feeds?.length > 0)
            }
        } catch { }
        return false
    }

    const extractFromPage = async (tabId: number) => {
        try {
            const metadata = await sendTabMessage<PageMetadata & { estimated_read_time?: number }>(
                tabId,
                'extractMetadata',
                3000
            )
            if (metadata) {
                setCurrentPageMetadata(metadata)
                if (metadata.estimated_read_time) setReadingTime(metadata.estimated_read_time)
            }
        } catch { }
    }

    const extractPageMetadata = useCallback(
        async (tab: chrome.tabs.Tab) => {
            if (!tab.id || !tab.url) return

            // 1. Basic info
            setCurrentPageMetadata({
                title: tab.title,
                canonical_url: tab.url,
                favicon: tab.favIconUrl,
            })
            setIsMetadataLoading(false)
            setIsFeedDataLoading(false)

            // 2. Cache
            const foundCacheWithFeeds = await checkCache(tab.url)
            if (foundCacheWithFeeds) return

            // 3. Extraction
            await extractFromPage(tab.id)
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
