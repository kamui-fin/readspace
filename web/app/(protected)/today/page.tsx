'use client'

import { ArticlesView } from "@/components/articles"

export default function TodayPage() {
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

    return (
        <ArticlesView
            initialSidebarTitle="Today"
            publishedSince={startOfDay.toISOString()}
            publishedUntil={endOfDay.toISOString()}
        />
    );
} 