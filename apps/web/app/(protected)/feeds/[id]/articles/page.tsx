import { ArticlesView } from "@/components/features/articles/ArticlesView"

interface PageProps {
    params: Promise<{ id: string }>
}

export default async function FeedArticlesPage({ params }: PageProps) {
    const { id: feedId } = await params

    return <ArticlesView feedId={feedId} />
}
