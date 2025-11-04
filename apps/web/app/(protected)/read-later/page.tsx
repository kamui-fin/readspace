"use client"

import { ArticlesView } from "@/components/articles"

export default function ReadLaterPage() {
    return (
        <ArticlesView
            mode="readLater"
            initialSidebarTitle="Read Later"
        />
    )
}
