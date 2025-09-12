import { getQueryClient } from "@/lib/get-query-client"
import { ServerApiClient } from "@/lib/api/server"
import DiscoverPageClient from "./discover-client"
import { dehydrate, HydrationBoundary } from "@tanstack/react-query"

// Force dynamic rendering since we're fetching data
export const dynamic = 'force-dynamic'

export const metadata = {
    title: "Discover Feeds | Readspace",
    description: "Discover and explore RSS feeds across different categories",
}

export default async function DiscoverPage({
    searchParams,
}: {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
    const queryClient = getQueryClient()
    const params = await searchParams
    const query = Array.isArray(params.q) ? params.q[0] : params.q
    const category = Array.isArray(params.category) ? params.category[0] : params.category
    const language = Array.isArray(params.language) ? params.language[0] : (params.language || 'en')

    // Prefetch data that the page needs
    if (query || category) {
        try {
            // If there's a search query or category, prefetch search results
            await queryClient.prefetchQuery({
                queryKey: ['discover', 'search', { q: query, category, language }],
                queryFn: () => ServerApiClient.searchFeeds({ 
                    q: query,
                    category,
                    language,
                    limit: 50 
                }),
            })
        } catch (error) {
            // If prefetch fails, continue without error to avoid breaking SSR
            console.error('Failed to prefetch search results:', error)
        }
    }

    return (
        <HydrationBoundary state={dehydrate(queryClient)}>
            <DiscoverPageClient 
                initialQuery={query}
                initialCategory={category}
                initialLanguage={language}
            />
        </HydrationBoundary>
    )
}