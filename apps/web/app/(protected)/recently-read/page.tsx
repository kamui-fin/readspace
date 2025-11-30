import { cookies } from "next/headers"
import { ArticlesView } from "@/components/features/articles/ArticlesView"
import { ArticleFilterMode } from "@readspace/shared"
import { getLayoutFromCookie, LAYOUT_COOKIE_NAME } from "@/lib/cookies"

export default async function RecentlyReadPage() {
    const cookieStore = await cookies()
    const layout = getLayoutFromCookie(cookieStore.get(LAYOUT_COOKIE_NAME)?.value)

    return (
        <ArticlesView
            mode={ArticleFilterMode.RecentlyRead}
            initialSidebarTitle="Recently Read"
            defaultLayout={layout}
        />
    )
}
