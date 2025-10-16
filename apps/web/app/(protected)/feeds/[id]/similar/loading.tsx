import { ArrowLeft, Sparkles } from "lucide-react"

import { FeedCardSkeleton } from "@/components/feeds/FeedCardSkeleton"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"

export default function SimilarFeedsLoading() {
    return (
        <div className="min-h-screen bg-background">
            <div className="max-w-4xl mx-auto px-6 py-8">
                {/* Back Button */}
                <div className="mb-6">
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-9 w-9 p-0"
                        disabled
                    >
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                </div>

                {/* Header Section */}
                <div className="mb-8">
                    <div className="text-center space-y-4">
                        <div className="flex items-center justify-center gap-2 mb-4">
                            <Sparkles className="h-8 w-8 text-primary" />
                            <h1 className="text-3xl font-bold">
                                Similar Feeds
                            </h1>
                        </div>

                        <div className="bg-muted/50 rounded-lg p-4 max-w-2xl mx-auto">
                            <p className="text-muted-foreground mb-2">
                                Feeds similar to:
                            </p>
                            <div className="flex items-center justify-center gap-3">
                                <Skeleton className="h-6 w-6 rounded" />
                                <Skeleton className="h-6 w-48" />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Similar Feeds Skeleton */}
                <div className="space-y-4">
                    {Array.from({ length: 5 }).map((_, i) => (
                        <FeedCardSkeleton key={i} />
                    ))}
                </div>
            </div>
        </div>
    )
}
