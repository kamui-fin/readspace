import {
    fuzzySearch,
    useFeeds,
    useUnreadCounts,
    type Subscription,
    type Folder,
} from "@readspace/shared"
import { useMemo, useState } from "react"

export function useFeedSearch() {
    const [searchValue, setSearchValue] = useState("")

    // Data queries
    const { data: feeds = [] } = useFeeds()
    const { data: unreadCounts } = useUnreadCounts()
    const feedUnreadCounts = unreadCounts?.feed_counts

    // Type-safe folder data
    const typedFolders = useMemo(() => {
        const folderMap = new Map<string, Folder>()
            ; ((feeds as unknown as Subscription[]) || []).forEach((sub) => {
                if (sub.folder) {
                    folderMap.set(sub.folder.id, sub.folder)
                }
            })
        return Array.from(folderMap.values())
    }, [feeds])

    // Filter feeds with fuzzy search (limit to 100 results for performance)
    const filteredFeeds = useMemo(() => {
        if (!searchValue.trim()) {
            return feeds.slice(0, 100)
        }
        // Create a searchable array
        const searchableItems = feeds.map((feed) => ({
            original: feed,
            title: feed.custom_title || feed.feed.title,
            url: feed.feed.url,
        }))

        return fuzzySearch(searchableItems, searchValue, ["title", "url"])
            .slice(0, 100)
            .map((item) => item.original)
    }, [feeds, searchValue])

    // Group feeds by folder
    const groupedFeeds = useMemo(() => {
        const groups: Record<string, typeof feeds> = {
            no_folder: [],
        }

        // Initialize groups for each folder
        typedFolders.forEach((folder) => {
            groups[folder.id] = []
        })

        // Group feeds
        filteredFeeds.forEach((feed) => {
            if (feed.folder?.id) {
                groups[feed.folder.id]?.push(feed)
            } else {
                groups.no_folder!.push(feed)
            }
        })

        return groups
    }, [filteredFeeds, typedFolders])

    return {
        searchValue,
        setSearchValue,
        typedFolders,
        groupedFeeds,
        feedUnreadCounts,
    }
}
