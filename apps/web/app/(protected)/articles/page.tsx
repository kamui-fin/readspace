import { cookies } from "next/headers"
import { ArticlesPageClient } from "./client"
import { getLayoutFromCookie, LAYOUT_COOKIE_NAME } from "@/lib/cookies"

export default async function ArticlesPage() {
    const cookieStore = await cookies()
    const layout = getLayoutFromCookie(
        cookieStore.get(LAYOUT_COOKIE_NAME)?.value
    )

    return <ArticlesPageClient defaultLayout={layout} />
}
