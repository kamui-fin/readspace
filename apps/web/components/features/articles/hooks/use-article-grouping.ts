import type { Article } from "@readspace/shared"
import { format, parseISO } from "date-fns"
import { useMemo } from "react"

interface UseArticleGroupingProps {
    articles: Article[]
    showUnreadOnly: boolean
    isRecentlyReadMode: boolean
    isReadLaterMode?: boolean
    isTodayMode: boolean
}

/**
 * Date an article is listed under. Read later lists by when the article was
 * saved (`created_at`), everything else by when it was published.
 */
export function getArticleListDate(
    article: Pick<Article, "published_at" | "created_at">,
    isReadLaterMode: boolean
): string | null {
    return isReadLaterMode ? article.created_at : article.published_at
}

export type ArticleRow =
    | Article
    | { type: "header"; label: string; dateGroup: string }

export function useArticleGrouping({
    articles,
    showUnreadOnly,
    isRecentlyReadMode,
    isReadLaterMode = false,
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
            const listDate = getArticleListDate(article, isReadLaterMode)
            if (!listDate) return

            const date = parseISO(listDate)
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
                // Sort articles within each date group by list date (newest first)
                const sortedArticles = group.articles.sort((a, b) => {
                    const aDate = getArticleListDate(a, isReadLaterMode)
                    const bDate = getArticleListDate(b, isReadLaterMode)
                    if (!aDate) return 1
                    if (!bDate) return -1
                    return parseISO(bDate).getTime() - parseISO(aDate).getTime()
                })
                rows.push(...sortedArticles)
            })

        return rows
    }, [filteredArticles, isRecentlyReadMode, isReadLaterMode, isTodayMode])

    return {
        filteredArticles,
        allRows,
    }
}
