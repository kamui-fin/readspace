import { useState } from "react"
import type { FeedRowData } from "./use-feed-data"

export function useFeedModals() {
    // Modal states
    const [currentFeed, setCurrentFeed] = useState<FeedRowData | null>(null)
    const [isEditModalOpen, setIsEditModalOpen] = useState(false)
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
    const [isBulkEditFolderModalOpen, setIsBulkEditFolderModalOpen] =
        useState(false)
    const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false)

    /**
     * Handle edit feed action
     */
    const handleEditFeed = (feed: FeedRowData) => {
        setCurrentFeed(feed)
        setIsEditModalOpen(true)
    }

    /**
     * Handle delete feed action
     */
    const handleDeleteFeed = (feed: FeedRowData) => {
        setCurrentFeed(feed)
        setIsDeleteModalOpen(true)
    }

    /**
     * Close all modals
     */
    const closeModals = () => {
        setIsEditModalOpen(false)
        setIsDeleteModalOpen(false)
        setIsBulkEditFolderModalOpen(false)
        setIsBulkDeleteModalOpen(false)
        setCurrentFeed(null)
    }

    /**
     * Handle successful feed deletion
     */
    const handleFeedDeleted = () => {
        closeModals()
    }

    /**
     * Handle bulk operation completion
     */
    const handleBulkOperationComplete = () => {
        closeModals()
    }

    return {
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
