"use client"

import { Suspense } from "react"
import { useParams } from "next/navigation"
import SimilarFeedsView from "@/components/features/feeds/SimilarFeedsView"
import { FeedCardSkeleton } from "@/components/features/feeds/FeedCardSkeleton"
import { DiscoverLayout } from "@/components/features/discover/DiscoverLayout"

function SimilarFeedsFallback() {
    return (
        <DiscoverLayout>
            <div className="w-full mx-auto max-w-3xl pt-3 md:pt-6 pb-20">
                <div className="flex flex-col divide-y divide-border/40 mt-16">
                    {Array.from({ length: 8 }).map((_, i) => (
                        <FeedCardSkeleton key={i} />
                    ))}
                </div>
            </div>
        </DiscoverLayout>
    )
}

export default function SimilarFeedsPage() {
    const params = useParams()
    const feedId = params.id as string

    return (
        <Suspense fallback={<SimilarFeedsFallback />}>
            <SimilarFeedsView feedId={feedId} />
        </Suspense>
    )
}
