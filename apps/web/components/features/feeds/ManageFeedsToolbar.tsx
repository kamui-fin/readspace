"use client"

import { FeedFiltersPanel } from "@/components/features/feeds/FeedFiltersPanel"
import { useManageFeedsContext } from "./ManageFeedsContext"

export function ManageFeedsToolbar() {
    const {

        filterFolderId,
        setFilterFolderId,
        folders,
        selectedFeedIds,
        feeds,
        handleExportOPML,
        setIsBulkEditFolderModalOpen,
        handleBulkDelete,
    } = useManageFeedsContext()

    return (
        <FeedFiltersPanel

            filterFolderId={filterFolderId}
            onFolderFilterChange={setFilterFolderId}
            folders={folders}
            selectedCount={selectedFeedIds.length}
            exportableCount={feeds.length}
            onExportOPML={handleExportOPML}
            onBulkChangeFolder={() => setIsBulkEditFolderModalOpen(true)}
            onBulkDelete={handleBulkDelete}
        />
    )
}
