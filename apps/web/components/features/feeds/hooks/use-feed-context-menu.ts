import { useUpdateFeed } from "@readspace/shared"
import { useState } from "react"

interface UseFeedContextMenuProps {
    itemId?: string
    itemTitle?: string
    isFolder: boolean
    isFavorite?: boolean
}

export function useFeedContextMenu({
    itemId,
    itemTitle,
    isFolder,
    isFavorite,
}: UseFeedContextMenuProps) {
    // Modal states
    const [isRenameModalOpen, setIsRenameModalOpen] = useState(false)
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
    const [isDropdownOpen, setIsDropdownOpen] = useState(false)

    // Hooks
    const updateFeed = useUpdateFeed()

    /**
     * Handle rename button click
     */
    const handleRename = (e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setIsDropdownOpen(false)
        if (itemTitle) {
            setIsRenameModalOpen(true)
        }
    }

    /**
     * Handle delete button click
     */
    const handleDelete = (e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setIsDropdownOpen(false)
        setIsDeleteModalOpen(true)
    }

    /**
     * Handle toggle favorite status
     */
    const handleToggleFavorite = (e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setIsDropdownOpen(false)
        if (itemId && !isFolder) {
            updateFeed.mutate({
                feedId: itemId,
                data: { is_favorite: !isFavorite },
            })
        }
    }

    return {
        isRenameModalOpen,
        setIsRenameModalOpen,
        isDeleteModalOpen,
        setIsDeleteModalOpen,
        isDropdownOpen,
        setIsDropdownOpen,
        handleRename,
        handleDelete,
        handleToggleFavorite,
    }
}
