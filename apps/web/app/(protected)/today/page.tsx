import { ArticlesSuspenseWrapper } from "@/components/articles/ArticlesSuspenseWrapper"

export default function TodayPage() {
    return (
        <ArticlesSuspenseWrapper
            showUnreadBadge={true}
            initialSidebarTitle="Today"
            mode="today"
        />
    )
}
