import ClientLayout from "@/components/layout/ClientLayout"
import { AppSidebar } from "@/components/navigation/AppSidebar"
import { ReaderSidebar } from "@/components/reader/ReaderSidebar"
import { SidebarInset } from "@/components/ui/sidebar"
import { getQueryClient } from "@/lib/get-query-client"
import { ApiClient, RSS_QUERY_KEYS } from "@readspace/shared"
import { dehydrate, HydrationBoundary } from "@tanstack/react-query"

// Force dynamic rendering since we're fetching user-specific data
export const dynamic = "force-dynamic"

export default async function ProtectedLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const queryClient = getQueryClient()

    // Prefetch shared sidebar data that all protected pages need
    await Promise.all([
        queryClient.prefetchQuery({
            queryKey: [RSS_QUERY_KEYS.FOLDERS],
            queryFn: () => ApiClient.rss.getFolders(),
        }),
        queryClient.prefetchQuery({
            queryKey: [RSS_QUERY_KEYS.FEEDS, {}],
            queryFn: () => ApiClient.rss.getFeeds({}),
        }),
        queryClient.prefetchQuery({
            queryKey: [RSS_QUERY_KEYS.UNREAD_COUNTS, undefined],
            queryFn: () => ApiClient.rss.getUnreadCounts(),
        }),
    ])

    return (
        <HydrationBoundary state={dehydrate(queryClient)}>
            <ClientLayout>
                <AppSidebar />
                <SidebarInset>{children}</SidebarInset>
                <ReaderSidebar />
            </ClientLayout>
        </HydrationBoundary>
    )
}
