"use client"

import type { ReactNode } from "react"

import { FeedCard } from "@/components/features/feeds/FeedCard"
import { FeedCardSkeleton } from "@/components/features/feeds/FeedCardSkeleton"
import { useSimilarFeedsById } from "@/components/features/discover/hooks/use-similar-feeds-by-id"

interface SimilarFeedsClientProps {
    feedId: string
}

function PageHeader() {
    return (
        <div className="mt-8 mb-12 flex items-center gap-3 justify-center w-full">
            <h1 className="tracking-tight text-4xl font-semibold text-foreground">
                You may also like
            </h1>
        </div>
    )
}

interface PageLayoutProps {
    children: ReactNode
}

function PageLayout({ children }: PageLayoutProps) {
    return (
        <div className="flex flex-col min-h-screen">
            <main className="flex-1 px-4 py-4 md:px-6 md:py-6">
                <div className="max-w-full md:max-w-4xl mx-auto">
                    {children}
                </div>
            </main>
        </div>
    )
}

interface ErrorMessageProps {
    error: Error
}

function ErrorMessage({ error }: ErrorMessageProps) {
    const isNotFound =
        error.message?.includes("404") || error.message?.includes("not found")

    return (
        <div className="flex flex-col items-center justify-center py-16">
            <h3 className="text-lg font-medium mb-2 text-foreground">
                {isNotFound ? "Feed not found" : "Error loading similar feeds"}
            </h3>
            <p className="text-sm text-muted-foreground text-center max-w-md">
                {isNotFound
                    ? "The requested feed could not be found."
                    : error.message || "Please try again later."}
            </p>
        </div>
    )
}

function EmptyState() {
    return (
        <div className="flex flex-col items-center justify-center py-16">
            <h3 className="text-lg font-medium mb-2 text-foreground">
                No similar feeds found
            </h3>
            <p className="text-sm text-muted-foreground text-center max-w-md">
                This feed might be unique, or similar feeds may not have
                embeddings yet.
            </p>
        </div>
    )
}

export default function SimilarFeedsView({
    feedId,
}: SimilarFeedsClientProps) {
    const { similarFeeds, error, isLoading } = useSimilarFeedsById(feedId)

    const renderContent = () => {
        if (isLoading) {
            return (
                <div className="space-y-4">
                    {Array.from({ length: 5 }).map((_, index) => (
                        <FeedCardSkeleton key={index} />
                    ))}
                </div>
            )
        }

        if (error) {
            return <ErrorMessage error={error as Error} />
        }

        if (similarFeeds.length === 0) {
            return <EmptyState />
        }

        return (
            <div className="flex flex-col divide-y divide-border/40">
                {similarFeeds.map((feed) => (
                    <FeedCard
                        key={feed.id}
                        feed={feed}
                        showSimilarButton={true}
                        showPreviewButton={true}
                        showFollowButton={true}
                        className="py-8"
                    />
                ))}
            </div>
        )
    }

    return (
        <PageLayout>
            <PageHeader />
            {renderContent()}
        </PageLayout>
    )
}
