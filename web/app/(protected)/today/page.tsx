'use client'

import { endOfToday, startOfToday } from 'date-fns'
import ArticlesPage from '../articles/page'

export default function TodayPage() {
    const today = startOfToday().toISOString()
    const endOfTodayDate = endOfToday().toISOString()

    return (
        <ArticlesPage
            sidebarTitle="Today"
            publishedSince={today}
            publishedUntil={endOfTodayDate}
        />
    )
} 