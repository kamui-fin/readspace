import {
    fuzzySearch,
    useBulkDeleteFeeds,
    useFeeds,
    useFolders,
    useUpdateFeed,
    type SubscriptionExtended,
} from "@readspace/shared"
import { useMemo, useState } from "react"
import { toast } from "react-hot-toast"
import { useDebounce } from "@/hooks/use-debounce"
import { exportFeedsToOPML } from "@/lib/opml-export"

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

export function useFeedManagement() {
    // Data queries
    const {
        data: subscriptions = [],
        isLoading: isLoadingFeeds,
        error: feedsError,
    } = useFeeds({ extended: true })
    const { data: folders = [], isLoading: isLoadingFolders } = useFolders()

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

    // Search and filter state
    const [searchTerm, setSearchTerm] = useState("")
    const [debouncedSearchTerm] = useDebounce<string>(searchTerm, 300)
    const [filterFolderId, setFilterFolderId] = useState<string | "all">("all")

    // Selection state
    const [selectedFeedIds, setSelectedFeedIds] = useState<string[]>([])

    // Mutations
    const updateFeedMutation = useUpdateFeed()
    const bulkDeleteFeedsMutation = useBulkDeleteFeeds()

    // Type-safe folder data
    const typedFolders = folders || []

    /**
     * Filter and search feeds based on current criteria
     */
    const filteredFeeds = useMemo(() => {
        let tempFeeds = feeds

        // Filter by folder
        if (filterFolderId !== "all") {
            tempFeeds = tempFeeds.filter(
                (feed) => feed.folder_id === filterFolderId
            )
        }

        // Search by title or URL
        if (debouncedSearchTerm) {
            tempFeeds = fuzzySearch(tempFeeds, debouncedSearchTerm, [
                "title",
                "url",
            ])
        }

        return tempFeeds
    }, [feeds, debouncedSearchTerm, filterFolderId])

    /**
     * Handle select all checkbox
     */
    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            setSelectedFeedIds(filteredFeeds.map((feed) => feed.id))
        } else {
            setSelectedFeedIds([])
        }
    }

    /**
     * Handle individual feed selection
     */
    const handleSelectFeed = (feedId: string, checked: boolean) => {
        if (checked) {
            setSelectedFeedIds((prev) => [...prev, feedId])
        } else {
            setSelectedFeedIds((prev) => prev.filter((id) => id !== feedId))
        }
    }

    /**
     * Handle folder change for individual feed
     */
    const handleFolderChange = (feedId: string, newFolderId: string | null) => {
        updateFeedMutation.mutate({
            feedId,
            data: {
                folder_id: newFolderId === null ? undefined : newFolderId,
            },
        })
    }

    /**
     * Handle bulk delete with confirmation
     */
    const handleBulkDelete = () => {
        if (selectedFeedIds.length === 0) return

        if (
            window.confirm(
                `Are you sure you want to delete ${selectedFeedIds.length} feed(s)?`
            )
        ) {
            bulkDeleteFeedsMutation.mutate(
                { feedIds: selectedFeedIds },
                {
                    onSuccess: () => {
                        setSelectedFeedIds([])
                    },
                }
            )
        }
    }

    /**
     * Handle OPML export
     */
    const handleExportOPML = () => {
        if (filteredFeeds.length === 0) {
            toast.error("No feeds to export")
            return
        }

        try {
            exportFeedsToOPML(filteredFeeds, typedFolders)
            toast.success(`Exported ${filteredFeeds.length} feeds to OPML`)
        } catch (error) {
            toast.error("Failed to export OPML")
            console.error("OPML export error:", error)
        }
    }

    return {
        feeds: filteredFeeds,
        folders: typedFolders,
        isLoading: isLoadingFeeds || isLoadingFolders,
        error: feedsError,
        searchTerm,
        setSearchTerm,
        filterFolderId,
        setFilterFolderId,
        selectedFeedIds,
        setSelectedFeedIds,
        handleSelectAll,
        handleSelectFeed,
        handleFolderChange,
        handleBulkDelete,
        handleExportOPML,
        isAllSelected:
            selectedFeedIds.length === filteredFeeds.length &&
            filteredFeeds.length > 0,
    }
}
