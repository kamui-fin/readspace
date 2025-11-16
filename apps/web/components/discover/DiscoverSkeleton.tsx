import { FeedCardSkeleton } from "@/components/feeds/FeedCardSkeleton"
import { Skeleton } from "@/components/ui/skeleton"

interface DiscoverSkeletonProps {
    title?: string
    showCategories?: boolean
}

export function DiscoverSkeleton({
    title,
    showCategories = false,
}: DiscoverSkeletonProps) {
    return (
        <div className="flex flex-col min-h-screen">
            <main className="flex-1 px-4 py-4 md:px-6 md:py-6">
                <div className="max-w-full md:max-w-4xl mx-auto">
                    {/* Header */}
                    <div className="flex flex-col items-start md:items-center mb-8 md:mb-12">
                        <div className="mb-4 hidden md:block">
                            <Skeleton className="w-32 h-32 rounded-full" />
                        </div>

                        {/* Mobile: Sidebar Toggle, Title and Language Selector */}
                        <div className="flex md:hidden items-center w-full max-w-2xl mb-6 gap-3">
                            <Skeleton className="w-8 h-8 rounded" />
                            <h1 className="text-3xl font-semibold text-black dark:text-foreground min-h-[2.5rem] flex items-center truncate break-words flex-1">
                                {title || "Loading..."}
                            </h1>
                            <Skeleton className="w-16 h-8 rounded" />
                        </div>

                        {/* Desktop: Title centered */}
                        <h1 className="hidden md:flex text-5xl font-semibold text-black dark:text-foreground mb-10 min-h-[3.5rem] items-center justify-center max-w-2xl truncate break-words">
                            {title || "Loading..."}
                        </h1>

                        {/* Search Section */}
                        <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-3 w-full max-w-2xl min-w-0">
                            <div className="relative flex-1 min-w-0">
                                <Skeleton className="h-12 md:h-14 rounded" />
                            </div>
                            <div className="hidden md:block">
                                <Skeleton className="h-14 w-24 rounded" />
                            </div>
                        </div>
                    </div>

                    {/* Content Section */}
                    {showCategories ? (
                        /* Categories Skeleton */
                        <div className="grid grid-cols-2 gap-2 justify-center mb-8 md:flex md:flex-wrap md:gap-3 md:justify-center">
                            {Array.from({ length: 12 }).map((_, i) => (
                                <div
                                    key={i}
                                    className="h-14 w-full md:h-10 md:w-32 bg-muted rounded-lg animate-pulse transition-colors duration-200"
                                />
                            ))}
                        </div>
                    ) : (
                        /* Search Results Skeleton */
                        <div className="space-y-4">
                            {Array.from({ length: 3 }).map((_, i) => (
                                <FeedCardSkeleton key={i} />
                            ))}
                        </div>
                    )}
                </div>
            </main>
        </div>
    )
}
