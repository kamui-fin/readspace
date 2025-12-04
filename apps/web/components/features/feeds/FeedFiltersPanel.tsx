"use client"

import { Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"

interface FeedFiltersPanelProps {
    /** Current filter folder ID */
    filterFolderId: string | "all"
    /** Callback when folder filter changes */
    onFolderFilterChange: (folderId: string | "all") => void
    /** Available folders for filtering */
    folders: Array<{ id: string; name: string }>
    /** Number of selected feeds */
    selectedCount: number
    /** Number of feeds available for export */
    exportableCount: number
    /** Callback when export OPML is clicked */
    onExportOPML: () => void
    /** Callback when bulk folder change is requested */
    onBulkChangeFolder: () => void
    /** Callback when bulk delete is requested */
    onBulkDelete: () => void
}

/**
 * Panel component containing search, filter, and bulk action controls for feed management.
 * Provides a clean interface for filtering feeds and performing bulk operations.
 */
export function FeedFiltersPanel({
    filterFolderId,
    onFolderFilterChange,
    folders,
    selectedCount,
    exportableCount,
    onExportOPML,
    onBulkChangeFolder,
    onBulkDelete,
}: FeedFiltersPanelProps) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
            {/* Folder filter and export */}
            <div className="md:col-span-1 flex gap-2 items-center">
                <Select
                    value={filterFolderId}
                    onValueChange={onFolderFilterChange}
                >
                    <SelectTrigger className="max-w-xs h-10">
                        <SelectValue placeholder="Filter by folder" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Folders</SelectItem>
                        {folders.map((folder) => (
                            <SelectItem key={folder.id} value={folder.id}>
                                {folder.name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <Button
                    variant="outline"
                    onClick={onExportOPML}
                    disabled={exportableCount === 0}
                    className="whitespace-nowrap h-10"
                >
                    <Download className="h-4 w-4 mr-2" />
                    Export OPML
                </Button>
            </div>

            {/* Bulk actions */}
            <div className="md:col-span-1 flex justify-end gap-2 items-center">
                {selectedCount > 0 && (
                    <>
                        <Button
                            variant="outline"
                            onClick={onBulkChangeFolder}
                            className="h-10"
                        >
                            Change Folder ({selectedCount})
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={onBulkDelete}
                            className="h-10"
                        >
                            Delete ({selectedCount})
                        </Button>
                    </>
                )}
            </div>
        </div>
    )
}
