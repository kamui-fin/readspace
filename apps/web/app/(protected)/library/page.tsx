import { getQueryClient } from "@/lib/get-query-client"
import { ApiClient } from "@readspace/shared"
import { BOOK_QUERY_KEYS } from "@readspace/shared"
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import LibraryClient from "./library-client"
import { dehydrate, HydrationBoundary } from "@tanstack/react-query"

// Force dynamic rendering since we're fetching user-specific data
export const dynamic = "force-dynamic"

export const metadata = {
    title: "Library | Readspace",
    description: "Your personal library of books",
}

export default async function LibraryPage() {
    const supabase = await createClient()
    const {
        data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
        redirect("/login")
    }

    const queryClient = getQueryClient()

    // Prefetch books data
    await queryClient.prefetchQuery({
        queryKey: [BOOK_QUERY_KEYS.BOOKS, user.id],
        queryFn: () => ApiClient.books.getUserBooks(),
    })

    return (
        <HydrationBoundary state={dehydrate(queryClient)}>
            <LibraryClient userId={user.id} />
        </HydrationBoundary>
    )
}
