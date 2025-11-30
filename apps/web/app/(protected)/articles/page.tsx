import { cookies } from "next/headers"
import { ArticlesView } from "@/components/features/articles/ArticlesView"
import { getLayoutFromCookie, LAYOUT_COOKIE_NAME } from "@/lib/cookies"

export default async function ArticlesPage() {
    const cookieStore = await cookies()
    const layout = getLayoutFromCookie(cookieStore.get(LAYOUT_COOKIE_NAME)?.value)

    return <ArticlesView initialSidebarTitle="All Articles" defaultLayout={layout} />
}
