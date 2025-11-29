import "@/lib/api-client"
import { getQueryClient } from "@/lib/get-query-client"
import { ApiClient, RSS_QUERY_KEYS } from "@readspace/shared"
import { dehydrate, HydrationBoundary } from "@tanstack/react-query"
import ImportOPMLPageClient from "./import-opml-client"

// Force dynamic rendering since we're using cookies for auth
export const dynamic = "force-dynamic"

export default async function ImportOPMLPage() {
    const queryClient = getQueryClient()

    // Prefetch active import tasks
    await queryClient.prefetchQuery({
        queryKey: [RSS_QUERY_KEYS.OPML_IMPORT_TASKS],
        queryFn: () => ApiClient.getActiveImportTask(),
    })

    return (
        <HydrationBoundary state={dehydrate(queryClient)}>
            <ImportOPMLPageClient />
        </HydrationBoundary>
    )
}
