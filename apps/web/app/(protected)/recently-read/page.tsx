import { cookies } from "next/headers"
import { RecentlyReadPageClient } from "./client"
import { getLayoutFromCookie, LAYOUT_COOKIE_NAME } from "@/lib/cookies"

export default async function RecentlyReadPage() {
    const cookieStore = await cookies()
    const layout = getLayoutFromCookie(cookieStore.get(LAYOUT_COOKIE_NAME)?.value)

    return <RecentlyReadPageClient defaultLayout={layout} />
}
