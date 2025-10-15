import { ArticlesSuspenseWrapper } from "@/components/articles/ArticlesSuspenseWrapper"

export default function ArticlesPage() {
    return (
        <ArticlesSuspenseWrapper
            showUnreadBadge={true}
            initialSidebarTitle="All Articles"
        />
    )
}
