import { dehydrate, HydrationBoundary } from "@tanstack/react-query"
import { getQueryClient } from "@/lib/get-query-client"
import ClientLayout from "@/components/layout/client-layout"
import { AppSidebar } from "@/components/navigation/app-sidebar"
import { ReaderSidebar } from "@/components/reader/reader-sidebar"
import { SidebarInset } from "@/components/ui/sidebar"
import { ServerApiClient } from "@/lib/api/server"
import { RSS_QUERY_KEYS } from "@/lib/query-keys"

// Force dynamic rendering since we're fetching user-specific data
export const dynamic = 'force-dynamic'

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
            queryFn: () => ServerApiClient.getFolders(),
        }),
        queryClient.prefetchQuery({
            queryKey: [RSS_QUERY_KEYS.FEEDS, {}],
            queryFn: () => ServerApiClient.getFeeds({}),
        }),
        queryClient.prefetchQuery({
            queryKey: [RSS_QUERY_KEYS.UNREAD_COUNTS, undefined],
            queryFn: () => ServerApiClient.getUnreadCounts(),
        }),
    ])

    return (
        <HydrationBoundary state={dehydrate(queryClient)}>
        <ClientLayout>
            <AppSidebar />
            <SidebarInset>{children}</SidebarInset>
            <ReaderSidebar />
        </ClientLayout></HydrationBoundary>
    )
}
