"use client"

import { FeedTableRow } from "@/components/features/feeds/FeedTableRow"
import { Checkbox } from "@/components/ui/checkbox"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { useManageFeedsContext } from "./ManageFeedsContext"

export function ManageFeedsTable() {
    const {
        feeds,
        selectedFeedIds,
        folders,
        isAllSelected,
        handleSelectAll,
        handleSelectFeed,
        handleFolderChange,
        handleEditFeed,
        handleDeleteFeed,
    } = useManageFeedsContext()

    return (
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
                        <TableHead className="text-right">Last Post</TableHead>
                        <TableHead className="w-[100px] text-right">
                            Actions
                        </TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {feeds.length === 0 && (
                        <TableRow>
                            <TableCell colSpan={6} className="text-center h-24">
                                No feeds match your criteria.
                            </TableCell>
                        </TableRow>
                    )}
                    {feeds.map((feed) => (
                        <FeedTableRow
                            key={feed.id}
                            feed={feed}
                            isSelected={selectedFeedIds.includes(feed.id)}
                            folders={folders}
                            onSelectionChange={handleSelectFeed}
                            onFolderChange={handleFolderChange}
                            onEdit={handleEditFeed}
                            onDelete={handleDeleteFeed}
                        />
                    ))}
                </TableBody>
            </Table>
        </div>
    )
}
