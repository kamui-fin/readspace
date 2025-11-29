import { useState, useCallback, useEffect } from "react"
import { useIsMobile } from "@/hooks/use-mobile"
import type { Article } from "@readspace/shared"

interface UseArticlesViewProps {
    articles: Article[]
    isArticlesLoading: boolean
    isFetching: boolean
    feedId?: string
    folderId?: string
    mode?: string
}

export function useArticlesView({
    articles,
    isArticlesLoading,
    isFetching,
    feedId,
    folderId,
    mode,
}: UseArticlesViewProps) {
    const isMobile = useIsMobile()
    const [selectedArticleId, setSelectedArticleId] = useState<string | null>(
        null
    )
    const [showContent, setShowContent] = useState(false)
    const [showUnreadOnly, setShowUnreadOnly] = useState(false)

    // Create a unique key for the current view to detect when we switch contexts
    // This helps in resetting state when navigating between feeds/folders
    const viewKey = `${feedId || "all"}-${folderId || "none"}-${mode}`

    // Reset state when view changes
    useEffect(() => {
        setSelectedArticleId(null)
        setShowContent(false)
    }, [viewKey])

    // Clear selected article if it's no longer in the articles list
    useEffect(() => {
        if (selectedArticleId && articles.length > 0) {
            const selectedArticleExists = articles.some(
                (article) => article.id === selectedArticleId
            )
            if (!selectedArticleExists) {
                setSelectedArticleId(null)
                if (isMobile) setShowContent(false)
            }
        }
    }, [selectedArticleId, articles, isMobile])

    // Auto-select first article on desktop
    useEffect(() => {
        if (isMobile) return

        // Only auto-select if we have articles and no selection
        // Check both isArticlesLoading and isFetching to ensure data is stable
        if (
            articles.length > 0 &&
            !selectedArticleId &&
            !showContent &&
            !isArticlesLoading &&
            !isFetching
        ) {
            // Sort articles by published date (newest first)
            const sortedArticles = [...articles].sort((a, b) => {
                if (!a.published_at) return 1
                if (!b.published_at) return -1
                return (
                    new Date(b.published_at).getTime() -
                    new Date(a.published_at).getTime()
                )
            })

            // Select first article (or first unread if filter is on)
            const firstArticle = showUnreadOnly
                ? sortedArticles.find((a) => !a.is_read) || sortedArticles[0]
                : sortedArticles[0]

            if (firstArticle?.id) {
                setSelectedArticleId(firstArticle.id)
            }
        }
    }, [
        viewKey,
        articles,
        selectedArticleId,
        isMobile,
        showContent,
        showUnreadOnly,
        isArticlesLoading,
        isFetching,
    ])

    const handleArticleSelect = useCallback(
        (articleId: string) => {
            setSelectedArticleId(articleId)
            if (isMobile) {
                setShowContent(true)
            }
        },
        [isMobile]
    )

    const handleBackToList = useCallback(() => {
        if (isMobile) {
            setShowContent(false)
        }
    }, [isMobile])

    const toggleShowUnreadOnly = useCallback(() => {
        setShowUnreadOnly((prev) => !prev)
    }, [])

    // Filter articles based on unread toggle
    // Note: Don't filter in Read Later mode
    const filteredArticles =
        showUnreadOnly && mode !== "readLater"
            ? articles.filter((article) => !article.is_read)
            : articles

    const selectedArticle = articles.find((a) => a.id === selectedArticleId)

    return {
        selectedArticleId,
        selectedArticle,
        showContent,
        showUnreadOnly,
        filteredArticles,
        handleArticleSelect,
        handleBackToList,
        toggleShowUnreadOnly,
    }
}
