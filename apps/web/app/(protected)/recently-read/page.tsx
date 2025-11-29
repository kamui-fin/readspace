"use client"

import { ArticlesView } from "@/components/features/articles/ArticlesView"

export default function RecentlyReadPage() {
    return (
        <ArticlesView mode="recentlyRead" initialSidebarTitle="Recently Read" />
    )
}
