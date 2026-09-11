import { ArticleReaderPageClient } from "./client"

interface PageProps {
    params: Promise<{ id: string }>
}

export default async function ArticleReaderPage({ params }: PageProps) {
    const { id } = await params
    return <ArticleReaderPageClient articleId={id} />
}
