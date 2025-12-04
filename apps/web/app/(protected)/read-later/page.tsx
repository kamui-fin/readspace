import { cookies } from "next/headers"
import { ReadLaterPageClient } from "./client"
import { getLayoutFromCookie, LAYOUT_COOKIE_NAME } from "@/lib/cookies"

export default async function ReadLaterPage() {
    const cookieStore = await cookies()
    const layout = getLayoutFromCookie(
        cookieStore.get(LAYOUT_COOKIE_NAME)?.value
    )

    return <ReadLaterPageClient defaultLayout={layout} />
}
