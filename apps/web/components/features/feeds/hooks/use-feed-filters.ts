import { useMemo, useState } from "react"
import type { FeedRowData } from "./use-feed-data"

export function useFeedFilters(feeds: FeedRowData[]) {
    // Filter state
    const [filterFolderId, setFilterFolderId] = useState<string | "all">("all")

    /**
     * Filter feeds based on current criteria
     */
    const filteredFeeds = useMemo(() => {
        let tempFeeds = feeds

        // Filter by folder
        if (filterFolderId !== "all") {
            tempFeeds = tempFeeds.filter(
                (feed) => feed.folder_id === filterFolderId
            )
        }

        return tempFeeds
    }, [feeds, filterFolderId])

    return {
        filterFolderId,
        setFilterFolderId,
        filteredFeeds,
    }
}
