import { useFeedData, type FeedRowData } from "./use-feed-data"
import { useFeedFilters } from "./use-feed-filters"
import { useFeedModals } from "./use-feed-modals"
import { useFeedSelection } from "./use-feed-selection"

export type { FeedRowData }

export function useFeedManagement() {
    // 1. Fetch Data
    const { feeds, folders, isLoading, error } = useFeedData()

    // 2. Filter Data
    const {

        filterFolderId,
        setFilterFolderId,
        filteredFeeds,
    } = useFeedFilters(feeds)

    // 3. Handle Selection & Actions
    const {
        selectedFeedIds,
        setSelectedFeedIds,
        handleSelectAll,
        handleSelectFeed,
        handleFolderChange,
        performBulkDelete,
        isBulkDeleting,
        handleExportOPML,
        isAllSelected,
    } = useFeedSelection(filteredFeeds, folders)

    // 4. Handle Modals
    const {
        currentFeed,
        isEditModalOpen,
        isDeleteModalOpen,
        isBulkEditFolderModalOpen,
        setIsBulkEditFolderModalOpen,
        isBulkDeleteModalOpen,
        setIsBulkDeleteModalOpen,
        handleEditFeed,
        handleDeleteFeed,
        closeModals,
        handleFeedDeleted,
    } = useFeedModals()

    /**
     * Handle bulk delete click (opens modal)
     */
    const handleBulkDelete = () => {
        setIsBulkDeleteModalOpen(true)
    }

    /**
     * Handle bulk delete confirmation
     */
    const handleBulkDeleteConfirm = () => {
        performBulkDelete(() => {
            closeModals()
            // Selection is cleared by performBulkDelete
        })
    }

    /**
     * Handle completion of other bulk operations (like move)
     */
    const handleBulkOperationComplete = () => {
        closeModals()
        setSelectedFeedIds([])
    }

    return {
        // Data
        feeds: filteredFeeds,
        folders,
        isLoading,
        error,

        // Filter State

        filterFolderId,
        setFilterFolderId,

        // Selection State
        selectedFeedIds,
        setSelectedFeedIds,
        isAllSelected,
        isBulkDeleting,

        // Actions
        handleSelectAll,
        handleSelectFeed,
        handleFolderChange,
        handleBulkDelete,
        handleBulkDeleteConfirm,
        handleExportOPML,

        // Modal State & Handlers
        currentFeed,
        isEditModalOpen,
        isDeleteModalOpen,
        isBulkEditFolderModalOpen,
        setIsBulkEditFolderModalOpen,
        isBulkDeleteModalOpen,
        setIsBulkDeleteModalOpen,
        handleEditFeed,
        handleDeleteFeed,
        closeModals,
        handleFeedDeleted,
        handleBulkOperationComplete,
    }
}

export type UseFeedManagementResult = ReturnType<typeof useFeedManagement>
