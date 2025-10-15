import { ArticlesSuspenseWrapper } from "@/components/articles/ArticlesSuspenseWrapper"

export default function ReadLaterPage() {
    return (
        <ArticlesSuspenseWrapper
            mode="readLater"
            initialSidebarTitle="Read Later"
        />
    )
}
