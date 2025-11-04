"use client"

import { ArticlesView } from "@/components/articles"

export default function RecentlyReadPage() {
    return (
        <ArticlesView
            mode="recentlyRead"
            initialSidebarTitle="Recently Read"
        />
    )
}
