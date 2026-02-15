import { Skeleton } from "@/components/ui/skeleton"

/**
 * Skeleton loader for article content view
 * Displays a placeholder while article content is being loaded
 */
export function ArticleContentSkeleton() {
    return (
        <div className="flex-1 overflow-hidden flex flex-col h-full">
            {/* Mobile Toolbar Skeleton */}
            <div className="md:hidden bg-background/95 backdrop-blur-sm border-b px-4 py-3 flex-shrink-0">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1">
                        <Skeleton className="h-8 w-8" />
                        <Skeleton className="h-8 w-8" />
                        <Skeleton className="h-8 w-8" />
                    </div>
                    <div className="flex items-center gap-2">
                        <Skeleton className="h-8 w-8" />
                        <Skeleton className="h-8 w-8" />
                        <Skeleton className="h-8 w-8" />
                    </div>
                </div>
            </div>

            {/* Article Content Skeleton */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden">
                <div className="mx-auto max-w-4xl px-6 py-8">
                    {/* Article Header */}
                    <div className="mb-8 space-y-6">
                        {/* Title */}
                        <div className="space-y-3">
                            <Skeleton className="h-10 w-full" />
                            <Skeleton className="h-10 w-4/5" />
                        </div>

                        {/* Meta info and toolbar */}
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-border pb-6 gap-4">
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                                <Skeleton className="h-4 w-32" />
                                <Skeleton className="h-4 w-24" />
                                <Skeleton className="h-4 w-20" />
                            </div>
                            {/* Desktop toolbar */}
                            <div className="hidden md:flex items-center gap-2">
                                <Skeleton className="h-8 w-8" />
                                <Skeleton className="h-8 w-8" />
                                <Skeleton className="h-8 w-8" />
                                <Skeleton className="h-8 w-8" />
                                <Skeleton className="h-8 w-8" />
                            </div>
                        </div>
                    </div>

                    {/* Content Paragraphs */}
                    <div className="space-y-6">
                        {/* First paragraph group */}
                        <div className="space-y-3">
                            <Skeleton className="h-5 w-full" />
                            <Skeleton className="h-5 w-full" />
                            <Skeleton className="h-5 w-11/12" />
                            <Skeleton className="h-5 w-full" />
                            <Skeleton className="h-5 w-10/12" />
                        </div>

                        {/* Second paragraph group */}
                        <div className="space-y-3">
                            <Skeleton className="h-5 w-full" />
                            <Skeleton className="h-5 w-full" />
                            <Skeleton className="h-5 w-9/12" />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
