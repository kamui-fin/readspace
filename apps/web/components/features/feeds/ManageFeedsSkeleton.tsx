import { Skeleton } from "@/components/ui/skeleton"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"

/**
 * Loading skeleton for the manage feeds page.
 * Provides visual feedback while data is being fetched.
 */
export function ManageFeedsPageSkeleton() {
    return (
        <div className="container mx-auto p-4 md:p-8 space-y-6">
            {/* Header Skeleton */}
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="space-y-2">
                    <Skeleton className="h-9 w-48" />
                    <Skeleton className="h-5 w-80" />
                </div>
            </header>

            {/* Filters and Bulk Actions Skeleton */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                <div className="md:col-span-1">
                    <Skeleton className="h-9 w-full" />
                </div>
                <div className="md:col-span-1">
                    <Skeleton className="h-9 w-full max-w-xs" />
                </div>
                <div className="md:col-span-1 flex justify-end gap-2">
                    <Skeleton className="h-9 w-32" />
                    <Skeleton className="h-9 w-24" />
                </div>
            </div>

            {/* Table Skeleton */}
            <div className="rounded-lg border overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[50px]">
                                <Skeleton className="h-4 w-4" />
                            </TableHead>
                            <TableHead>
                                <Skeleton className="h-4 w-32" />
                            </TableHead>
                            <TableHead>
                                <Skeleton className="h-4 w-16" />
                            </TableHead>
                            <TableHead className="text-center">
                                <Skeleton className="h-4 w-16 mx-auto" />
                            </TableHead>
                            <TableHead className="text-right">
                                <Skeleton className="h-4 w-20 ml-auto" />
                            </TableHead>
                            <TableHead className="w-[100px] text-right">
                                <Skeleton className="h-4 w-16 ml-auto" />
                            </TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {Array.from({ length: 8 }).map((_, index) => (
                            <TableRow key={index}>
                                <TableCell>
                                    <Skeleton className="h-4 w-4" />
                                </TableCell>
                                <TableCell>
                                    <div className="flex items-center gap-2">
                                        <Skeleton className="h-5 w-5 rounded-sm" />
                                        <div className="flex flex-col gap-1">
                                            <Skeleton className="h-4 w-48" />
                                            <Skeleton className="h-3 w-64" />
                                        </div>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <Skeleton className="h-8 w-32" />
                                </TableCell>
                                <TableCell className="text-center">
                                    <div className="flex justify-center">
                                        <Skeleton className="h-6 w-16 rounded-full" />
                                    </div>
                                </TableCell>
                                <TableCell className="text-right">
                                    <Skeleton className="h-3 w-20 ml-auto" />
                                </TableCell>
                                <TableCell className="text-right">
                                    <Skeleton className="h-8 w-8 ml-auto rounded-md" />
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </div>
    )
}
