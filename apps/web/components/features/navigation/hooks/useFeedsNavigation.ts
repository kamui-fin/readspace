import { useModalStore } from "@/stores/modal-store"
import { useEffect, useState } from "react"
import { useFeedTree, type FeedItem } from "./useFeedTree"

export type { FeedItem }

export function useFeedsNavigation() {
    // Data transformation
    const { isFoldersLoading, typedFolders, favoriteFeedItems, feedItems } =
        useFeedTree()

    // Loading state
    const isSidebarLoading = isFoldersLoading

    // Modal state management
    const { isFolderModalOpen, openFolderModal, closeFolderModal } =
        useModalStore()
    const [isFeedModalOpen, setIsFeedModalOpen] = useState(false)
    const [selectedFolderId, setSelectedFolderId] = useState<string | null>(
        null
    )
    const [feedError, setFeedError] = useState<string | null>(null)
    const [isSearchOpen, setIsSearchOpen] = useState(false)

    // Keyboard shortcut for search (Cmd+K or Ctrl+K)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "k") {
                e.preventDefault()
                setIsSearchOpen(true)
            }
        }

        document.addEventListener("keydown", handleKeyDown)
        return () => document.removeEventListener("keydown", handleKeyDown)
    }, [])

    /**
     * Handle adding a new folder
     */
    const handleAddFolder = () => {
        openFolderModal()
    }

    /**
     * Handle adding a new feed to a specific folder
     */
    const handleAddFeed = (folderId: string) => {
        setSelectedFolderId(folderId)
        setFeedError(null)
        setIsFeedModalOpen(true)
    }

    /**
     * Clear feed modal state
     */
    const handleClearFeedError = () => {
        setFeedError(null)
    }

    return {
        isSidebarLoading,
        favoriteFeedItems,
        feedItems,
        typedFolders,
        isFolderModalOpen,
        closeFolderModal,
        isFeedModalOpen,
        setIsFeedModalOpen,
        selectedFolderId,
        setSelectedFolderId,
        feedError,
        handleClearFeedError,
        isSearchOpen,
        setIsSearchOpen,
        handleAddFolder,
        handleAddFeed,
    }
}
