import { useCallback, useState } from "react"
import {
    useClearRefinements,
    useCurrentRefinements,
    useMenu,
    useSearchBox,
} from "react-instantsearch"
import { usePersistentState } from "@/hooks/use-persistent-state"
import { useFeedPreview } from "@/components/features/discover/hooks/use-feed-preview"

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

    // Use a single clear refinements hook (clears category; language is applied
    // via <Configure>, not as a menu refinement)
    const { refine: clearRefinementsBase } = useClearRefinements()

    // Use current refinements to reliably detect active filters
    const { items: currentRefinements } = useCurrentRefinements()

    const clearAllRefinements = useCallback(() => {
        clearRefinementsBase()
    }, [clearRefinementsBase])

    // Persistent language preference — defaults to "en". Applied downstream as a
    // raw Meilisearch `filters` string on <Configure> (see DiscoverContent),
    // NOT as an InstantSearch menu refinement: the menu approach raced against
    // its own "restore persisted default" effect and silently dropped the
    // filter, so switching away from English appeared to do nothing.
    const [persistedLanguage, setPersistedLanguage] = usePersistentState(
        "discover-language",
        "en"
    )
    const displayLanguage = persistedLanguage || "en"
    const languageFilter =
        displayLanguage && displayLanguage !== "all"
            ? `language = ${displayLanguage}`
            : undefined

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

    const handleLanguageChange = useCallback(
        (newLanguage: string) => {
            setPersistedLanguage(newLanguage)
        },
        [setPersistedLanguage]
    )

    const clearSearch = useCallback(() => {
        setIsPopularSelected(false)
        // Clear the search query
        refineQuery("")
        // Clear category refinements (language preference is intentionally kept)
        clearAllRefinements()
    }, [refineQuery, clearAllRefinements, setIsPopularSelected])

    // Determine if we should show search results or categories
    // Show search results if there's a query OR active category OR popular is selected, but NOT if it's a URL query (show preview instead)
    const hasActiveSearch = Boolean(
        (query && !isUrlQuery) || activeCategory || isPopularSelected
    )

    const effectiveCategory = isPopularSelected
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
        languageFilter,

        // Actions
        handleCategoryClick,
        handleLanguageChange,
        clearSearch,
    }
}
