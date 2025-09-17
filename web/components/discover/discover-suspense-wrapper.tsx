import { Suspense } from "react"
import { DiscoverSearch } from "./discover-search"
import { DiscoverResults } from "./discover-results"
import { DiscoverSkeleton } from "./discover-skeleton"

interface DiscoverSuspenseWrapperProps {
    initialQuery?: string
    initialCategory?: string
    initialLanguage?: string
}

export function DiscoverSuspenseWrapper(props: DiscoverSuspenseWrapperProps) {
    const { initialQuery, initialCategory, initialLanguage } = props

    const hasSearchParams = Boolean(initialQuery || initialCategory)

    const getSkeletonTitle = () => {
        if (initialCategory) {
            return initialCategory
        }
        return "Discover Feeds"
    }

    return (
        <div className="flex flex-col min-h-screen">
            <main className="flex-1 px-4 py-4 md:px-6 md:py-6">
                <DiscoverSearch initialLanguage={initialLanguage} />

                {hasSearchParams && (
                    <Suspense
                        fallback={
                            <DiscoverSkeleton
                                title={getSkeletonTitle()}
                                showCategories={false}
                            />
                        }
                    >
                        <DiscoverResultsClient
                            query={initialQuery}
                            category={initialCategory}
                            language={initialLanguage}
                        />
                    </Suspense>
                )}
            </main>
        </div>
    )
}

// Client component that uses React Query for data fetching
function DiscoverResultsClient({
    query,
    category,
    language = "en",
}: {
    query?: string
    category?: string
    language?: string
}) {
    return (
        <DiscoverResults
            query={query}
            category={category}
            language={language}
        />
    )
}
