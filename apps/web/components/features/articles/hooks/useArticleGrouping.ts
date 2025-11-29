import type { Article } from "@readspace/shared"
import { format, parseISO } from "date-fns"
import { useMemo } from "react"

interface UseArticleGroupingProps {
    articles: Article[]
    showUnreadOnly: boolean
    isRecentlyReadMode: boolean
    isTodayMode: boolean
}

export type ArticleRow =
    | Article
    | { type: "header"; label: string; dateGroup: string }

export function useArticleGrouping({
    articles,
    showUnreadOnly,
    isRecentlyReadMode,
    isTodayMode,
}: UseArticleGroupingProps) {
    // Filter articles based on unread toggle
    const filteredArticles = useMemo(() => {
        return showUnreadOnly
            ? articles.filter((article) => !article.is_read)
            : articles
    }, [articles, showUnreadOnly])

    // For virtualization, we need a flat list of all items
    const allRows = useMemo(() => {
        if (
            isRecentlyReadMode ||
            isTodayMode ||
            filteredArticles.length === 0
        ) {
            return filteredArticles
        }

        // Create flat list with date headers and articles
        const rows: ArticleRow[] = []
        const groups: Record<string, { label: string; articles: Article[] }> =
            {}

        // Group articles by date
        filteredArticles.forEach((article) => {
            if (!article.published_at) return

            const date = parseISO(article.published_at)
            const today = new Date()
            const yesterday = new Date()
            yesterday.setDate(today.getDate() - 1)

            let dateGroup: string
            let dateLabel: string

            if (date.toDateString() === today.toDateString()) {
                dateGroup = "today"
                dateLabel = "Today"
            } else if (date.toDateString() === yesterday.toDateString()) {
                dateGroup = "yesterday"
                dateLabel = "Yesterday"
            } else {
                dateGroup = format(date, "yyyy-MM-dd")
                dateLabel = format(date, "EEEE, MMMM d")
            }

            if (!groups[dateGroup]) {
                groups[dateGroup] = {
                    label: dateLabel,
                    articles: [],
                }
            }
            groups[dateGroup]?.articles.push(article)
        })

        // Flatten groups into rows with headers
        Object.entries(groups)
            .sort(([a], [b]) => {
                if (a === "today") return -1
                if (b === "today") return 1
                if (a === "yesterday") return -1
                if (b === "yesterday") return 1
                return b.localeCompare(a)
            })
            .forEach(([dateGroup, group]) => {
                rows.push({ type: "header", label: group.label, dateGroup })
                // Sort articles within each date group by published time (newest first)
                const sortedArticles = group.articles.sort((a, b) => {
                    if (!a.published_at) return 1
                    if (!b.published_at) return -1
                    return (
                        parseISO(b.published_at).getTime() -
                        parseISO(a.published_at).getTime()
                    )
                })
                rows.push(...sortedArticles)
            })

        return rows
    }, [filteredArticles, isRecentlyReadMode, isTodayMode])

    return {
        filteredArticles,
        allRows,
    }
}
