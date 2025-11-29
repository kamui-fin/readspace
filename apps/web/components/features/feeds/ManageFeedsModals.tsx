"use client"

import { BulkEditFolderModal } from "@/components/features/feeds/BulkEditFolderModal"
import { FeedDeleteModal } from "@/components/features/feeds/FeedDeleteModal"
import { FeedEditModal } from "@/components/features/feeds/FeedEditModal"
import { useManageFeedsContext } from "./ManageFeedsContext"

export function ManageFeedsModals() {
    const {
        currentFeed,
        isEditModalOpen,
        isDeleteModalOpen,
        isBulkEditFolderModalOpen,
        selectedFeedIds,
        folders,
        setIsBulkEditFolderModalOpen,
        closeModals,
        handleFeedDeleted,
        handleBulkOperationComplete,
    } = useManageFeedsContext()

    return (
        <>
            <FeedEditModal
                isOpen={isEditModalOpen}
                feed={currentFeed}
                onClose={closeModals}
            />

            <FeedDeleteModal
                isOpen={isDeleteModalOpen}
                feed={currentFeed}
                onClose={closeModals}
                onDeleted={handleFeedDeleted}
            />

            <BulkEditFolderModal
                isOpen={isBulkEditFolderModalOpen}
                selectedFeedIds={selectedFeedIds}
                folders={folders}
                onClose={() => setIsBulkEditFolderModalOpen(false)}
                onComplete={handleBulkOperationComplete}
            />
        </>
    )
}
