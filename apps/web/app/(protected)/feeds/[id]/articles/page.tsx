import { cookies } from "next/headers"
import { FeedArticlesPageClient } from "./client"
import { getLayoutFromCookie, LAYOUT_COOKIE_NAME } from "@/lib/cookies"

interface PageProps {
    params: Promise<{ id: string }>
}

export default async function FeedArticlesPage({ params }: PageProps) {
    const { id: feedId } = await params
    const cookieStore = await cookies()
    const layout = getLayoutFromCookie(
        cookieStore.get(LAYOUT_COOKIE_NAME)?.value
    )

    return <FeedArticlesPageClient feedId={feedId} defaultLayout={layout} />
}
