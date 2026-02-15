import "@/lib/api-client"
import DiscoverView from "@/components/features/discover/DiscoverView"

export const metadata = {
    title: "Discover Feeds | Readspace",
    description: "Discover and explore RSS feeds across different categories",
}

export default async function DiscoverPage({
    searchParams,
}: {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
    const params = await searchParams
    const language = Array.isArray(params.language)
        ? params.language[0]
        : params.language || "en"

    return <DiscoverView initialLanguage={language} />
}
