"use client"

import { ManageFeedsModals } from "@/components/features/feeds/ManageFeedsModals"
import { ManageFeedsTable } from "@/components/features/feeds/ManageFeedsTable"
import { ManageFeedsToolbar } from "@/components/features/feeds/ManageFeedsToolbar"
import { ManageFeedsProvider } from "@/components/features/feeds/ManageFeedsContext"
import { ManageFeedsPageSkeleton } from "@/components/features/feeds/ManageFeedsSkeleton"
import Header from "@/components/features/navigation/Header"
import { useFeedManagement } from "@/components/features/feeds/hooks/use-feed-management"

/**
 * Main client component for managing RSS feeds.
 * Provides comprehensive feed management including search, filtering, bulk operations, and OPML export.
 */
export default function ManageFeedsView() {
    const controller = useFeedManagement()
    const { isLoading, error } = controller

    // Show loading state
    if (isLoading) {
        return <ManageFeedsPageSkeleton />
    }

    // Show error state
    if (error) {
        return (
            <div className="container mx-auto p-4 text-red-500">
                Error loading feeds: {(error as Error).message}
            </div>
        )
    }

    return (
        <ManageFeedsProvider value={controller}>
            <div className="flex flex-col h-full">
                <Header
                    breadcrumbItems={[
                        { href: "/manage-feeds", label: "Manage Feeds" },
                    ]}
                />
                <main className="flex-1 p-4 md:p-8 overflow-hidden">
                    <div className="h-full space-y-6 overflow-y-auto">
                        {/* Header */}
                        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                            <div>
                                <h1 className="text-2xl sm:text-3xl font-bold">
                                    Manage Feeds
                                </h1>
                                <p className="text-muted-foreground">
                                    View, edit, and organize your RSS feeds.
                                </p>
                            </div>
                        </header>

                        {/* Filters and bulk actions */}
                        <ManageFeedsToolbar />

                        {/* Feeds table */}
                        <ManageFeedsTable />

                        {/* Modals */}
                        <ManageFeedsModals />
                    </div>
                </main>
            </div>
        </ManageFeedsProvider>
    )
}
