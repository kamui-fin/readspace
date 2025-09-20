"use client"

import { BulkEditFolderModal } from "@/components/feeds/BulkEditFolderModal"
import { FeedDeleteModal } from "@/components/feeds/FeedDeleteModal"
import { FeedEditModal } from "@/components/feeds/FeedEditModal"
import { FeedFiltersPanel } from "@/components/feeds/FeedFiltersPanel"
import { FeedTableRow } from "@/components/feeds/FeedTableRow"
import { ManageFeedsPageSkeleton } from "@/components/feeds/ManageFeedsSkeleton"
import Header from "@/components/navigation/Header"
import { Checkbox } from "@/components/ui/checkbox"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import {
    exportFeedsToOPML,
    fuzzySearch,
    useDeleteFeed,
    useFeeds,
    useFolders,
    useUpdateFeed,
    type Feed,
} from "@readspace/shared"
import { useMemo, useState } from "react"
import { toast } from "react-hot-toast"
import { useDebounce } from "use-debounce"

/**
 * Main client component for managing RSS feeds.
 * Provides comprehensive feed management including search, filtering, bulk operations, and OPML export.
 */
export default function ManageFeedsPageClient() {
    // Data queries
    const {
        data: feeds = [],
        isLoading: isLoadingFeeds,
        error: feedsError,
    } = useFeeds()
    const { data: folders = [], isLoading: isLoadingFolders } = useFolders()

    // Search and filter state
    const [searchTerm, setSearchTerm] = useState("")
    const [debouncedSearchTerm] = useDebounce<string>(searchTerm, 300)
    const [filterFolderId, setFilterFolderId] = useState<string | "all">("all")

    // Selection state
    const [selectedFeedIds, setSelectedFeedIds] = useState<string[]>([])

    // Modal states
    const [currentFeed, setCurrentFeed] = useState<Feed | null>(null)
    const [isEditModalOpen, setIsEditModalOpen] = useState(false)
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
    const [isBulkEditFolderModalOpen, setIsBulkEditFolderModalOpen] =
        useState(false)

    // Mutations
    const updateFeedMutation = useUpdateFeed()
    const deleteFeedMutation = useDeleteFeed()

    // Type-safe folder data
    const typedFolders = (folders as Array<{ id: string; name: string }>) || []

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
            silent: false,
        })
    }

    /**
     * Handle edit feed action
     */
    const handleEditFeed = (feed: Feed) => {
        setCurrentFeed(feed)
        setIsEditModalOpen(true)
    }

    /**
     * Handle delete feed action
     */
    const handleDeleteFeed = (feed: Feed) => {
        setCurrentFeed(feed)
        setIsDeleteModalOpen(true)
    }

    /**
     * Handle successful feed deletion
     */
    const handleFeedDeleted = (feedId: string) => {
        // Remove from selection if it was selected
        if (selectedFeedIds.includes(feedId)) {
            setSelectedFeedIds((prev) => prev.filter((id) => id !== feedId))
        }
        setCurrentFeed(null)
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
            const deletionPromises = selectedFeedIds.map((id) =>
                deleteFeedMutation.mutateAsync({ feedId: id, silent: true })
            )

            toast.promise(Promise.allSettled(deletionPromises), {
                loading: "Deleting feeds...",
                success: (results) => {
                    const successful = results.filter(
                        (r) => r.status === "fulfilled"
                    ).length
                    const failed = results.length - successful
                    setSelectedFeedIds([])
                    return `Deleted ${successful} feeds. ${
                        failed > 0 ? `${failed} failed.` : ""
                    }`
                },
                error: "An unexpected error occurred while deleting feeds.",
            })
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

    /**
     * Handle bulk operation completion
     */
    const handleBulkOperationComplete = () => {
        setSelectedFeedIds([])
    }

    // Show loading state
    if (isLoadingFeeds || isLoadingFolders) {
        return <ManageFeedsPageSkeleton />
    }

    // Show error state
    if (feedsError) {
        return (
            <div className="container mx-auto p-4 text-red-500">
                Error loading feeds: {(feedsError as Error).message}
            </div>
        )
    }

    const isAllSelected =
        selectedFeedIds.length === filteredFeeds.length &&
        filteredFeeds.length > 0

    return (
        <div className="flex flex-col h-full">
            <Header
                breadcrumbItems={[
                    { href: "/manage-feeds", label: "Manage Feeds" },
                ]}
            />
            <main className="flex-1 p-4 md:p-8 overflow-hidden">
                <div className="h-full space-y-6 overflow-y-auto">
                    {/* Header */}
                    <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div>
                            <h1 className="text-2xl sm:text-3xl font-bold">
                                Manage Feeds
                            </h1>
                            <p className="text-muted-foreground">
                                View, edit, and organize your RSS feeds.
                            </p>
                        </div>
                    </header>

                    {/* Filters and bulk actions */}
                    <FeedFiltersPanel
                        searchTerm={searchTerm}
                        onSearchChange={setSearchTerm}
                        filterFolderId={filterFolderId}
                        onFolderFilterChange={setFilterFolderId}
                        folders={typedFolders}
                        selectedCount={selectedFeedIds.length}
                        exportableCount={filteredFeeds.length}
                        onExportOPML={handleExportOPML}
                        onBulkChangeFolder={() =>
                            setIsBulkEditFolderModalOpen(true)
                        }
                        onBulkDelete={handleBulkDelete}
                    />

                    {/* Feeds table */}
                    <div className="w-full overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[50px]">
                                        <Checkbox
                                            checked={isAllSelected}
                                            onCheckedChange={handleSelectAll}
                                            aria-label="Select all rows"
                                        />
                                    </TableHead>
                                    <TableHead>Feed Title & URL</TableHead>
                                    <TableHead>Folder</TableHead>
                                    <TableHead className="text-center w-[90px]">
                                        Status
                                    </TableHead>
                                    <TableHead className="text-right">
                                        Last Post
                                    </TableHead>
                                    <TableHead className="w-[100px] text-right">
                                        Actions
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredFeeds.length === 0 && (
                                    <TableRow>
                                        <TableCell
                                            colSpan={6}
                                            className="text-center h-24"
                                        >
                                            No feeds match your criteria.
                                        </TableCell>
                                    </TableRow>
                                )}
                                {filteredFeeds.map((feed) => (
                                    <FeedTableRow
                                        key={feed.id}
                                        feed={feed}
                                        isSelected={selectedFeedIds.includes(
                                            feed.id
                                        )}
                                        folders={typedFolders}
                                        onSelectionChange={handleSelectFeed}
                                        onFolderChange={handleFolderChange}
                                        onEdit={handleEditFeed}
                                        onDelete={handleDeleteFeed}
                                    />
                                ))}
                            </TableBody>
                        </Table>
                    </div>

                    {/* Modals */}
                    <FeedEditModal
                        isOpen={isEditModalOpen}
                        feed={currentFeed}
                        onClose={() => {
                            setIsEditModalOpen(false)
                            setCurrentFeed(null)
                        }}
                    />

                    <FeedDeleteModal
                        isOpen={isDeleteModalOpen}
                        feed={currentFeed}
                        onClose={() => {
                            setIsDeleteModalOpen(false)
                            setCurrentFeed(null)
                        }}
                        onDeleted={handleFeedDeleted}
                    />

                    <BulkEditFolderModal
                        isOpen={isBulkEditFolderModalOpen}
                        selectedFeedIds={selectedFeedIds}
                        folders={typedFolders}
                        onClose={() => setIsBulkEditFolderModalOpen(false)}
                        onComplete={handleBulkOperationComplete}
                    />
                </div>
            </main>
        </div>
    )
}
