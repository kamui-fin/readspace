import DiscoverPageClient from "./discover-client"

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
    const query = Array.isArray(params.q) ? params.q[0] : params.q
    const category = Array.isArray(params.category)
        ? params.category[0]
        : params.category
    const language = Array.isArray(params.language)
        ? params.language[0]
        : params.language || "en"

    return (
        <DiscoverPageClient
            initialQuery={query}
            initialCategory={category}
            initialLanguage={language}
        />
    )
}
