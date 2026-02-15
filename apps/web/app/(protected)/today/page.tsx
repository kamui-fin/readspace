import { cookies } from "next/headers"
import { TodayPageClient } from "./client"
import { getLayoutFromCookie, LAYOUT_COOKIE_NAME } from "@/lib/cookies"

export default async function TodayPage() {
    const cookieStore = await cookies()
    const layout = getLayoutFromCookie(
        cookieStore.get(LAYOUT_COOKIE_NAME)?.value
    )

    return <TodayPageClient defaultLayout={layout} />
}
