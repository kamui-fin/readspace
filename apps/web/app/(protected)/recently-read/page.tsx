import { ArticlesSuspenseWrapper } from "@/components/articles/ArticlesSuspenseWrapper"

export default function RecentlyReadPage() {
    return (
        <ArticlesSuspenseWrapper
            mode="recentlyRead"
            initialSidebarTitle="Recently Read"
        />
    )
}
