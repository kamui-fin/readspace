import { useCallback, useEffect, useState } from "react"
import {
    useClearRefinements,
    useCurrentRefinements,
    useMenu,
    useSearchBox,
} from "react-instantsearch"
import { useFeedPreview } from "@/components/features/discover/hooks/use-feed-preview"
import { usePersistentState } from "@/hooks/use-persistent-state"

/** Languages selectable in Discover search — kept intentionally small. */
export const DISCOVER_LANGUAGES = [
    { value: "en", label: "English" },
    { value: "zh", label: "中文" },
] as const

export type DiscoverLanguage = (typeof DISCOVER_LANGUAGES)[number]["value"]

const DEFAULT_DISCOVER_LANGUAGE: DiscoverLanguage = "en"

function getInitialLanguageState(): DiscoverLanguage {
    if (typeof window !== "undefined") {
        const params = new URLSearchParams(window.location.search)
        const lang = params.get("lang")
        if (lang === "en" || lang === "zh") {
            return lang
        }
    }
    return DEFAULT_DISCOVER_LANGUAGE
}

export function useDiscoverController() {
    const { query, refine: refineQuery } = useSearchBox()

    // Feed preview hook for URL detection
    const {
        previewFeed,
        isLoading: isPreviewLoading,
        error: previewError,
        isUrlQuery,
        isError: isPreviewError,
    } = useFeedPreview(query)

    // Use InstantSearch's menu widget for category filtering
    const { refine: refineCategory } = useMenu({
        attribute: "top_level_category",
        limit: 100,
    })

    // Use a single clear refinements hook (clears category and content_type; language is applied
    // via <Configure>, not as an InstantSearch refinement)
    const { refine: clearRefinementsBase } = useClearRefinements()

    // Use current refinements to reliably detect active filters
    const { items: currentRefinements } = useCurrentRefinements()

    const clearAllRefinements = useCallback(() => {
        clearRefinementsBase()
    }, [clearRefinementsBase])

    // Language preference, persisted to localStorage and synced with URL `?lang=`.
    // `isInitialized` gates when <Configure> is allowed to render its `filters` string.
    const [displayLanguage, setDisplayLanguage, isLanguageInitialized] =
        usePersistentState<DiscoverLanguage>(
            "discover-language",
            getInitialLanguageState()
        )
    const languageFilter = `language = ${displayLanguage}`

    // Sync from URL if present on mount
    useEffect(() => {
        if (typeof window === "undefined") return
        const params = new URLSearchParams(window.location.search)
        const lang = params.get("lang")
        if (lang === "en" || lang === "zh") {
            if (lang !== displayLanguage) {
                setDisplayLanguage(lang)
            }
        }
    }, [displayLanguage, setDisplayLanguage])

    // Sync on popstate
    useEffect(() => {
        const handlePopState = () => {
            const params = new URLSearchParams(window.location.search)
            const lang = params.get("lang")
            if (lang === "en" || lang === "zh") {
                setDisplayLanguage(lang)
            }
        }
        window.addEventListener("popstate", handlePopState)
        return () => window.removeEventListener("popstate", handlePopState)
    }, [setDisplayLanguage])

    const handleLanguageChange = useCallback(
        (newLang: DiscoverLanguage) => {
            setDisplayLanguage(newLang)
            if (typeof window !== "undefined") {
                const url = new URL(window.location.href)
                if (newLang === "zh") {
                    url.searchParams.set("lang", "zh")
                } else {
                    url.searchParams.delete("lang")
                }
                window.history.replaceState(null, "", url.toString())
            }
        },
        [setDisplayLanguage]
    )

    // Get active category from current refinements
    const activeCategoryRefinement = currentRefinements.find(
        (item) => item.attribute === "top_level_category"
    )
    const activeCategory = activeCategoryRefinement?.refinements[0]?.value || ""

    const [isPopularSelected, setIsPopularSelected] = useState<boolean>(false)

    const handleCategoryClick = useCallback(
        (categoryName: string) => {
            if (categoryName === "popular") {
                refineCategory("popular")
                setIsPopularSelected((prev) => !prev)
            } else {
                if (isPopularSelected) {
                    setIsPopularSelected(false)
                    refineCategory("popular")
                }
                refineCategory(categoryName)
            }
        },
        [isPopularSelected, refineCategory, setIsPopularSelected]
    )

    const clearSearch = useCallback(() => {
        setIsPopularSelected(false)
        // Clear the search query
        refineQuery("")
        // Clear category and content_type refinements
        clearAllRefinements()
    }, [refineQuery, clearAllRefinements, setIsPopularSelected])

    const resetFilters = useCallback(() => {
        if (currentRefinements.length > 0 || isPopularSelected) {
            setIsPopularSelected(false)
            clearAllRefinements()
        } else {
            clearSearch()
        }
    }, [currentRefinements.length, isPopularSelected, clearAllRefinements, clearSearch])

    // Determine if we should show search results or categories
    // Show search results if there's a query OR active category OR popular is selected, but NOT if it's a URL query (show preview instead)
    const hasActiveSearch = Boolean(
        (query && !isUrlQuery) || activeCategory || isPopularSelected
    )

    const effectiveCategory =
        isPopularSelected || activeCategory === "popular"
            ? "Popular Feeds"
            : activeCategory

    return {
        // Search State
        query,
        activeCategory: effectiveCategory,
        isPopularSelected,
        hasActiveSearch,
        isUrlQuery,

        // Preview State
        previewFeed,
        isPreviewLoading,
        previewError,
        isPreviewError,

        // Settings State
        displayLanguage,
        setDisplayLanguage: handleLanguageChange,
        isLanguageInitialized,
        languageFilter,

        // Actions
        handleCategoryClick,
        clearSearch,
        resetFilters,
        refineQuery,
    }
}
