import { notFound } from "next/navigation"
import { getQueryClient } from "@/lib/get-query-client"
import { ServerApiClient } from "@/lib/api/server"
import CategoryPageClient from "./category-client"
import { dehydrate, HydrationBoundary } from "@tanstack/react-query"

// Force dynamic rendering since we're fetching data
export const dynamic = 'force-dynamic'

export async function generateMetadata({
    params,
}: {
    params: { slug: string }
}) {
    const categoryName = decodeURIComponent(params.slug)
    
    return {
        title: `${categoryName} Feeds | Readspace`,
        description: `Discover RSS feeds in the ${categoryName} category`,
    }
}

export default async function CategoryPage({
    params,
    searchParams,
}: {
    params: { slug: string }
    searchParams: { [key: string]: string | string[] | undefined }
}) {
    const categoryName = decodeURIComponent(params.slug)
    const language = Array.isArray(searchParams.language) 
        ? searchParams.language[0] 
        : (searchParams.language || 'en')
    
    const queryClient = getQueryClient()

    try {
        // Prefetch category feeds
        await queryClient.prefetchQuery({
            queryKey: ['discover', 'category', categoryName, { language }],
            queryFn: () => ServerApiClient.getCategoryFeeds(categoryName, { 
                language,
                limit: 20 
            }),
        })

        // Categories are predefined in the frontend - no need to prefetch
    } catch (error) {
        console.error("Error prefetching category data:", error)
        notFound()
    }

    return (
        <HydrationBoundary state={dehydrate(queryClient)}>
            <CategoryPageClient 
                categoryName={categoryName}
                initialLanguage={language}
            />
        </HydrationBoundary>
    )
}