import { ArticlesSuspenseWrapper } from "@/components/articles/ArticlesSuspenseWrapper"

interface PageProps {
    params: Promise<{ id: string }>
}

export default async function FeedArticlesPage({ params }: PageProps) {
    const { id: feedId } = await params

    return <ArticlesSuspenseWrapper showUnreadBadge feedId={feedId} />
}
