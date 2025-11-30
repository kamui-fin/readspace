import { cookies } from "next/headers"
import { ArticlesView } from "@/components/features/articles/ArticlesView"
import { getLayoutFromCookie, LAYOUT_COOKIE_NAME } from "@/lib/cookies"

interface PageProps {
    params: Promise<{ id: string }>
}

export default async function FeedArticlesPage({ params }: PageProps) {
    const { id: feedId } = await params
    const cookieStore = await cookies()
    const layout = getLayoutFromCookie(cookieStore.get(LAYOUT_COOKIE_NAME)?.value)

    return <ArticlesView feedId={feedId} defaultLayout={layout} />
}
