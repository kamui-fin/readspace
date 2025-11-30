import { cookies } from "next/headers"
import { ArticlesView } from "@/components/features/articles/ArticlesView"
import { getLayoutFromCookie, LAYOUT_COOKIE_NAME } from "@/lib/cookies"

interface PageProps {
    params: Promise<{ id: string }>
}

export default async function FolderArticlesPage({ params }: PageProps) {
    const { id: folderId } = await params
    const cookieStore = await cookies()
    const layout = getLayoutFromCookie(cookieStore.get(LAYOUT_COOKIE_NAME)?.value)

    return <ArticlesView folderId={folderId} defaultLayout={layout} />
}
