import {
    useFeeds,
    type SubscriptionExtended,
    type Folder,
} from "@readspace/shared"
import { useMemo } from "react"

export interface FeedRowData {
    id: string
    title: string
    url: string
    link: string | null
    folder_id: string | null
    image_url: string | null
    is_favorite: boolean
    error_count: number
    last_updated_at: string | null
    last_error_message: string | null
}

export function useFeedData() {
    // Data queries
    const {
        data: subscriptions = [],
        isLoading: isLoadingFeeds,
        error: feedsError,
    } = useFeeds({ extended: true })

    // Map subscriptions to flat Feed objects
    const feeds: FeedRowData[] = useMemo(() => {
        return (subscriptions as unknown as SubscriptionExtended[]).map(
            (sub) => ({
                id: sub.feed.id,
                title: sub.custom_title || sub.feed.title,
                url: sub.feed.url,
                link: sub.feed.link,
                folder_id: sub.folder?.id || null,
                image_url: sub.feed.image_url || null,
                is_favorite: sub.is_favorite,
                error_count: sub.feed.error_count,
                last_updated_at: sub.feed.last_updated_at,
                last_error_message: sub.feed.last_error_message,
            })
        )
    }, [subscriptions])

    // Derive folders from subscriptions
    const folders = useMemo(() => {
        const folderMap = new Map<string, Folder>()
            ; (subscriptions as unknown as SubscriptionExtended[]).forEach((sub) => {
                if (sub.folder) {
                    folderMap.set(sub.folder.id, sub.folder)
                }
            })
        return Array.from(folderMap.values())
    }, [subscriptions])

    return {
        feeds,
        folders,
        isLoading: isLoadingFeeds,
        error: feedsError,
    }
}
