import "@/lib/configure-api-client"
import { getQueryClient } from "@/lib/get-query-client"
import { ApiClient, RSS_QUERY_KEYS } from "@readspace/shared"
import { dehydrate, HydrationBoundary } from "@tanstack/react-query"
import ImportOPMLPageClient from "./import-opml-client"

// Force dynamic rendering since we're fetching user-specific data
export const dynamic = "force-dynamic"

export const metadata = {
    title: "OPML Import | Readspace",
    description:
        "Import feeds from an OPML file exported from another RSS reader",
}

export default async function ImportOPMLPage() {
    const queryClient = getQueryClient()

    // Prefetch active import tasks
    await queryClient.prefetchQuery({
        queryKey: [RSS_QUERY_KEYS.OPML_IMPORT_TASKS],
        queryFn: () => ApiClient.rss.listImportTasks(),
    })

    return (
        <HydrationBoundary state={dehydrate(queryClient)}>
            <ImportOPMLPageClient />
        </HydrationBoundary>
    )
}
