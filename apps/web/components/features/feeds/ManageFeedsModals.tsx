"use client"

import { BulkDeleteConfirmDialog } from "@/components/features/feeds/BulkDeleteConfirmDialog"
import { BulkEditFolderModal } from "@/components/features/feeds/BulkEditFolderModal"
import { DeleteConfirmDialog } from "@/components/features/feeds/DeleteConfirmDialog"
import { RenameDialog } from "@/components/features/feeds/RenameDialog"
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
        handleBulkOperationComplete,
        isBulkDeleteModalOpen,
        setIsBulkDeleteModalOpen,
        handleBulkDeleteConfirm,
        isBulkDeleting,
    } = useManageFeedsContext()

    return (
        <>
            <RenameDialog
                isOpen={isEditModalOpen}
                onOpenChange={(open) => !open && closeModals()}
                itemId={currentFeed?.id || ""}
                itemTitle={currentFeed?.title || ""}
                isFolder={false}
            />

            <DeleteConfirmDialog
                isOpen={isDeleteModalOpen}
                onOpenChange={(open) => !open && closeModals()}
                itemId={currentFeed?.id || ""}
                itemTitle={currentFeed?.title || ""}
                isFolder={false}
            />

            <BulkEditFolderModal
                isOpen={isBulkEditFolderModalOpen}
                selectedFeedIds={selectedFeedIds}
                folders={folders}
                onClose={() => setIsBulkEditFolderModalOpen(false)}
                onComplete={handleBulkOperationComplete}
            />

            <BulkDeleteConfirmDialog
                isOpen={isBulkDeleteModalOpen}
                onOpenChange={setIsBulkDeleteModalOpen}
                count={selectedFeedIds.length}
                onConfirm={handleBulkDeleteConfirm}
                isProcessing={isBulkDeleting}
            />
        </>
    )
}
