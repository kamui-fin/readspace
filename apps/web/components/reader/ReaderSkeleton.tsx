import { Skeleton } from "@/components/ui/skeleton"

export function ReaderSkeleton() {
    return (
        <div className="flex flex-col h-full bg-background">
            {/* Header skeleton */}
            <div className="flex items-center justify-between p-4 border-b">
                <div className="flex items-center gap-3">
                    <Skeleton className="h-4 w-4" />
                    <Skeleton className="h-4 w-24" />
                </div>
                <div className="flex items-center gap-2">
                    <Skeleton className="h-8 w-8" />
                    <Skeleton className="h-8 w-8" />
                    <Skeleton className="h-8 w-8" />
                </div>
            </div>

            {/* Article content skeleton */}
            <div className="flex-1 overflow-hidden">
                <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
                    {/* Title */}
                    <div className="space-y-3">
                        <Skeleton className="h-8 w-full" />
                        <Skeleton className="h-8 w-3/4" />
                    </div>

                    {/* Meta info */}
                    <div className="flex items-center gap-4">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-4 w-16" />
                    </div>

                    {/* Featured image */}
                    <Skeleton className="h-64 w-full rounded-lg" />

                    {/* Content paragraphs */}
                    <div className="space-y-4">
                        {Array.from({ length: 8 }).map((_, index) => (
                            <div key={index} className="space-y-2">
                                <Skeleton className="h-4 w-full" />
                                <Skeleton className="h-4 w-full" />
                                <Skeleton className="h-4 w-3/4" />
                                {index === 3 && <div className="py-4" />}{" "}
                                {/* Spacing variation */}
                            </div>
                        ))}
                    </div>

                    {/* Quote block skeleton */}
                    <div className="my-6 p-4 border-l-4 border-muted">
                        <Skeleton className="h-4 w-full mb-2" />
                        <Skeleton className="h-4 w-5/6" />
                    </div>

                    {/* More content */}
                    <div className="space-y-4">
                        {Array.from({ length: 5 }).map((_, index) => (
                            <div key={index} className="space-y-2">
                                <Skeleton className="h-4 w-full" />
                                <Skeleton className="h-4 w-4/5" />
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )
}
